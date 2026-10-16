import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { ProjectScopeService } from '../../common/project-scope/project-scope.service';
import { AuthUser } from '../../common/types';
import { Client } from '../../entities/client.entity';
import { Contact } from '../../entities/contact.entity';
import { Lead, LeadStatus } from '../../entities/lead.entity';
import { NumberingService } from '../numbering/numbering.service';
import {
  ConvertLeadDto,
  CreateClientDto,
  CreateContactDto,
  DuplicateQueryDto,
  QueryClientsDto,
  UpdateClientDto,
  UpdateContactDto,
} from './dto/client.dto';
import { GST_STATES, normalisePan, normalisePhone, parseGstin } from './gst';

export type CreditStatus = 'no_limit' | 'ok' | 'near' | 'over';

export interface ClientCredit {
  /** Receivables incl. retention, from the ledger (client party lines). */
  receivable: number;
  /** Advances received and not yet adjusted. */
  advance: number;
  /** receivable − advance: what the client actually owes. */
  outstanding: number;
  limit: number | null;
  /** outstanding / limit × 100, when a limit is set. */
  utilisation: number | null;
  status: CreditStatus;
  creditDays: number | null;
}

/** ≥ 80 % of the limit is "near"; above the limit is "over". Pure; exported for tests. */
export function creditStatus(outstanding: number, limit: number | null): { utilisation: number | null; status: CreditStatus } {
  if (limit === null) return { utilisation: null, status: 'no_limit' };
  if (limit === 0) return { utilisation: outstanding > 0 ? Infinity : 0, status: outstanding > 0 ? 'over' : 'ok' };
  const utilisation = (outstanding / limit) * 100;
  return { utilisation: Math.round(utilisation * 10) / 10, status: utilisation > 100 ? 'over' : utilisation >= 80 ? 'near' : 'ok' };
}

/** Normalise and validate identity fields. Returns the fields to store. Pure; exported for tests. */
export function normaliseIdentity(dto: {
  gstin?: string | null;
  pan?: string | null;
  stateCode?: string | null;
  phone?: string | null;
  type?: string;
}) {
  const out: { gstin?: string | null; pan?: string | null; stateCode?: string | null; phone?: string | null } = {};
  if (dto.gstin !== undefined) {
    if (!dto.gstin) out.gstin = null;
    else {
      const g = parseGstin(dto.gstin);
      if ('error' in g) throw new BadRequestException(g.error);
      out.gstin = g.gstin;
      out.stateCode = g.stateCode;
      out.pan = g.pan;
    }
  }
  if (dto.pan !== undefined && dto.pan) {
    const p = normalisePan(dto.pan);
    if (typeof p !== 'string') throw new BadRequestException(p.error);
    if (out.pan && out.pan !== p) throw new BadRequestException(`PAN ${p} does not match the PAN inside the GSTIN (${out.pan})`);
    out.pan = p;
  } else if (dto.pan === '' || dto.pan === null) {
    if (!out.gstin) out.pan = null;
  }
  if (dto.stateCode !== undefined && !out.stateCode) {
    if (dto.stateCode && !GST_STATES[dto.stateCode]) throw new BadRequestException(`Unknown GST state code ${dto.stateCode}`);
    out.stateCode = dto.stateCode || null;
  }
  if (dto.phone !== undefined) out.phone = dto.phone ? normalisePhone(dto.phone) : null;
  return out;
}

@Injectable()
export class ClientsService {
  constructor(
    private readonly ds: DataSource,
    private readonly numbering: NumberingService,
    private readonly scope: ProjectScopeService,
  ) {}

  /** Credit figures are shown to people who manage clients or read the books. */
  canSeeCredit(user: AuthUser) {
    return ['crm.clients.manage', 'finance.reports.read', 'finance.ledger.read'].some((p) => user.permissions.includes(p));
  }

  // ---------- Queries ----------

  async list(user: AuthUser, q: QueryClientsDto) {
    const page = Math.max(1, Number(q.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(q.pageSize ?? 25)));
    const params: unknown[] = [user.companyId];
    let where = 'c.company_id = $1 AND c.deleted_at IS NULL';
    if ((q.status ?? 'active') !== 'all') where += q.status === 'inactive' ? ' AND NOT c.is_active' : ' AND c.is_active';
    if (q.search?.trim()) {
      params.push(`%${q.search.trim().toLowerCase()}%`);
      const n = params.length;
      where += ` AND (lower(c.name) LIKE $${n} OR lower(coalesce(c.code,'')) LIKE $${n} OR lower(coalesce(c.email,'')) LIKE $${n}
                 OR coalesce(c.phone,'') LIKE $${n} OR lower(coalesce(c.gstin,'')) LIKE $${n}
                 OR EXISTS (SELECT 1 FROM contacts ct WHERE ct.client_id = c.id AND ct.deleted_at IS NULL AND lower(ct.name) LIKE $${n}))`;
    }
    where += await this.scopeClause(user, params);

    const [{ total }]: { total: string }[] = await this.ds.query(`SELECT COUNT(*) AS total FROM clients c WHERE ${where}`, params);
    params.push(pageSize, (page - 1) * pageSize);
    const rows: Record<string, unknown>[] = await this.ds.query(
      `SELECT c.id, c.code, c.name, c.type, c.gstin, c.state_code, c.phone, c.email, c.is_active, c.credit_limit, c.credit_days, c.created_at,
              (SELECT ct.name FROM contacts ct WHERE ct.client_id = c.id AND ct.is_primary AND ct.deleted_at IS NULL LIMIT 1) AS primary_contact,
              (SELECT COUNT(*) FROM projects p WHERE p.client_id = c.id AND p.deleted_at IS NULL) AS project_count
       FROM clients c WHERE ${where}
       ORDER BY lower(c.name) LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    const credit = this.canSeeCredit(user)
      ? await this.creditFor(
          user.companyId,
          rows.map((r) => r.id as string),
        )
      : new Map<string, ClientCredit>();
    return {
      data: rows.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        type: r.type,
        gstin: r.gstin,
        stateCode: r.state_code,
        stateName: r.state_code ? GST_STATES[r.state_code as string] : null,
        phone: r.phone,
        email: r.email,
        isActive: r.is_active,
        primaryContact: r.primary_contact,
        projectCount: Number(r.project_count),
        credit: credit.get(r.id as string) ?? null,
        createdAt: r.created_at,
      })),
      total: Number(total),
      page,
      pageSize,
    };
  }

  async get(user: AuthUser, id: string) {
    const client = await this.loadVisible(user, id);
    const contacts = await this.ds
      .getRepository(Contact)
      .find({ where: { clientId: id, companyId: user.companyId, deletedAt: IsNull() }, order: { isPrimary: 'DESC', name: 'ASC' } });
    const leads: Record<string, unknown>[] = await this.ds.query(
      `SELECT id, code, title, status, estimated_value, created_at FROM leads WHERE company_id = $1 AND client_id = $2 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 20`,
      [user.companyId, id],
    );
    const pParams: unknown[] = [user.companyId, id];
    const pScope = await this.projectScopeClause(user, 'p.id', pParams);
    const projects: Record<string, unknown>[] = await this.ds.query(
      `SELECT id, code, name, status, contract_value, progress_pct FROM projects p WHERE p.company_id = $1 AND p.client_id = $2 AND p.deleted_at IS NULL${pScope} ORDER BY created_at DESC`,
      pParams,
    );
    const credit = this.canSeeCredit(user) ? ((await this.creditFor(user.companyId, [id])).get(id) ?? null) : null;
    return {
      ...this.view(client),
      contacts,
      leads: leads.map((l) => ({
        id: l.id,
        code: l.code,
        title: l.title,
        status: l.status,
        estimatedValue: l.estimated_value != null ? Number(l.estimated_value) : null,
        createdAt: l.created_at,
      })),
      projects: projects.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        status: p.status,
        contractValue: p.contract_value != null ? Number(p.contract_value) : null,
        progress: Number(p.progress_pct),
      })),
      credit,
    };
  }

  /** Possible duplicates for a new client: same GSTIN, phone or email, or a very similar name. */
  async duplicates(user: AuthUser, q: DuplicateQueryDto) {
    const conds: string[] = [];
    const params: unknown[] = [user.companyId];
    const add = (sql: string, v: unknown) => {
      params.push(v);
      conds.push(sql.replace('?', `$${params.length}`));
    };
    if (q.gstin?.trim()) add('upper(c.gstin) = ?', q.gstin.trim().toUpperCase());
    if (q.phone?.trim()) add('c.phone = ?', normalisePhone(q.phone));
    if (q.email?.trim()) add('lower(c.email) = ?', q.email.trim().toLowerCase());
    if (q.name?.trim() && q.name.trim().length >= 3) add('lower(c.name) LIKE ?', `%${q.name.trim().toLowerCase()}%`);
    if (conds.length === 0) return [];
    const rows: Record<string, unknown>[] = await this.ds.query(
      `SELECT c.id, c.code, c.name, c.phone, c.email, c.gstin FROM clients c
       WHERE c.company_id = $1 AND c.deleted_at IS NULL AND (${conds.join(' OR ')}) ORDER BY lower(c.name) LIMIT 5`,
      params,
    );
    return rows;
  }

  // ---------- Commands ----------

  create(user: AuthUser, dto: CreateClientDto, em?: EntityManager, extra: { sourceLeadId?: string } = {}) {
    const run = async (m: EntityManager) => {
      const identity = normaliseIdentity({ ...dto, gstin: dto.gstin ?? undefined });
      if (identity.gstin) await this.assertGstinFree(m, user.companyId, identity.gstin);
      const client = await m.save(
        m.create(Client, {
          companyId: user.companyId,
          code: await this.numbering.next(user.companyId, 'client', { em: m }),
          name: dto.name.trim(),
          type: dto.type ?? (identity.gstin ? 'business' : 'individual'),
          gstin: identity.gstin ?? null,
          pan: identity.pan ?? null,
          stateCode: identity.stateCode ?? null,
          email: dto.email?.trim().toLowerCase() || null,
          phone: identity.phone ?? null,
          billingAddress: dto.billingAddress ?? null,
          siteAddresses: dto.siteAddresses ?? [],
          creditLimit: dto.creditLimit != null ? dto.creditLimit.toFixed(2) : null,
          creditDays: dto.creditDays ?? null,
          paymentTerms: dto.paymentTerms ?? null,
          notes: dto.notes ?? null,
          sourceLeadId: extra.sourceLeadId ?? null,
          createdBy: user.userId,
        }),
      );
      if (dto.primaryContact) await this.insertContact(m, user.companyId, client.id, { ...dto.primaryContact, isPrimary: true });
      return client;
    };
    return (em ? run(em) : this.ds.transaction(run)).then((c) => this.view(c));
  }

  async update(user: AuthUser, id: string, dto: UpdateClientDto) {
    return this.ds.transaction(async (m) => {
      const client = await this.loadVisible(user, id, m);
      const identity = normaliseIdentity(dto);
      if (identity.gstin && identity.gstin !== client.gstin) await this.assertGstinFree(m, user.companyId, identity.gstin, id);
      Object.assign(client, identity);
      if (dto.name !== undefined) client.name = dto.name.trim();
      if (dto.type !== undefined) client.type = dto.type;
      if (dto.email !== undefined) client.email = dto.email?.trim().toLowerCase() || null;
      if (dto.billingAddress !== undefined) client.billingAddress = dto.billingAddress ?? null;
      if (dto.siteAddresses !== undefined) client.siteAddresses = dto.siteAddresses ?? [];
      if (dto.creditLimit !== undefined) client.creditLimit = dto.creditLimit != null ? dto.creditLimit.toFixed(2) : null;
      if (dto.creditDays !== undefined) client.creditDays = dto.creditDays ?? null;
      if (dto.paymentTerms !== undefined) client.paymentTerms = dto.paymentTerms ?? null;
      if (dto.notes !== undefined) client.notes = dto.notes ?? null;
      if (dto.isActive !== undefined) client.isActive = dto.isActive;
      return this.view(await m.save(client));
    });
  }

  /** Soft delete — refused while the client still owes money or has live projects. */
  async remove(user: AuthUser, id: string) {
    const client = await this.loadVisible(user, id);
    const credit = (await this.creditFor(user.companyId, [id])).get(id);
    if (credit && Math.abs(credit.receivable) >= 0.005)
      throw new BadRequestException('This client has an outstanding balance in the books; settle it or mark the client inactive instead');
    const [{ n }]: { n: string }[] = await this.ds.query(
      `SELECT COUNT(*) AS n FROM projects WHERE client_id = $1 AND deleted_at IS NULL AND status IN ('planned','active','on_hold')`,
      [id],
    );
    if (Number(n) > 0) throw new BadRequestException('This client has live projects; mark the client inactive instead');
    await this.ds.getRepository(Client).softRemove(client);
    return { ok: true };
  }

  // ---------- Contacts ----------

  async addContact(user: AuthUser, clientId: string, dto: CreateContactDto) {
    await this.loadVisible(user, clientId);
    return this.ds.transaction((m) => this.insertContact(m, user.companyId, clientId, dto));
  }

  async updateContact(user: AuthUser, clientId: string, contactId: string, dto: UpdateContactDto) {
    await this.loadVisible(user, clientId);
    return this.ds.transaction(async (m) => {
      const contact = await m.findOne(Contact, { where: { id: contactId, clientId, companyId: user.companyId } });
      if (!contact) throw new NotFoundException('Contact not found');
      if (dto.isPrimary === true && !contact.isPrimary) await m.update(Contact, { clientId, isPrimary: true }, { isPrimary: false });
      if (dto.name !== undefined) contact.name = dto.name.trim();
      if (dto.designation !== undefined) contact.designation = dto.designation || null;
      if (dto.email !== undefined) contact.email = dto.email?.trim().toLowerCase() || null;
      if (dto.phone !== undefined) contact.phone = dto.phone ? normalisePhone(dto.phone) : null;
      if (dto.notes !== undefined) contact.notes = dto.notes || null;
      const wasPrimary = contact.isPrimary;
      if (dto.isPrimary !== undefined) contact.isPrimary = dto.isPrimary;
      const saved = await m.save(contact);
      if (wasPrimary && !saved.isPrimary) await this.promoteNextPrimary(m, clientId, saved.id);
      return saved;
    });
  }

  async removeContact(user: AuthUser, clientId: string, contactId: string) {
    await this.loadVisible(user, clientId);
    const repo = this.ds.getRepository(Contact);
    const contact = await repo.findOne({ where: { id: contactId, clientId, companyId: user.companyId } });
    if (!contact) throw new NotFoundException('Contact not found');
    await this.ds.transaction(async (m) => {
      const wasPrimary = contact.isPrimary;
      contact.isPrimary = false;
      await m.save(contact);
      await m.softRemove(contact);
      if (wasPrimary) await this.promoteNextPrimary(m, clientId, contact.id);
    });
    return { ok: true };
  }

  // ---------- Lead conversion ----------

  /**
   * A lead becomes (or is linked to) a client. New clients take the lead's contact as their
   * primary contact. Lost leads and already-converted leads are refused.
   */
  async convertLead(user: AuthUser, leadId: string, dto: ConvertLeadDto) {
    return this.ds.transaction(async (m) => {
      const lead = await m.findOne(Lead, { where: { id: leadId, companyId: user.companyId }, lock: { mode: 'pessimistic_write' } });
      if (!lead) throw new NotFoundException('Lead not found');
      if (lead.status === LeadStatus.LOST) throw new BadRequestException('A lost lead cannot be converted');
      if (lead.clientId) throw new ConflictException('This lead is already linked to a client');

      let clientId: string;
      let created = false;
      if (dto.clientId) {
        const existing = await m.findOne(Client, { where: { id: dto.clientId, companyId: user.companyId } });
        if (!existing) throw new NotFoundException('Client not found');
        clientId = existing.id;
      } else {
        const input: CreateClientDto = {
          name: lead.contactName,
          phone: lead.phone,
          email: lead.email,
          billingAddress: lead.city ? { city: lead.city } : undefined,
          primaryContact: { name: lead.contactName, phone: lead.phone, email: lead.email },
          ...(dto.client ?? {}),
        };
        const client = await this.create(user, input, m, { sourceLeadId: lead.id });
        clientId = client.id;
        created = true;
      }
      lead.clientId = clientId;
      await m.save(lead);
      return { leadId: lead.id, clientId, created };
    });
  }

  // ---------- Credit ----------

  /** Receivable and advance balances per client from posted ledger lines. */
  async creditFor(companyId: string, clientIds: string[]): Promise<Map<string, ClientCredit>> {
    const out = new Map<string, ClientCredit>();
    if (clientIds.length === 0) return out;
    const rows: { id: string; credit_limit: string | null; credit_days: number | null; receivable: string; advance: string }[] =
      await this.ds.query(
        `SELECT c.id, c.credit_limit, c.credit_days,
              COALESCE(SUM(l.debit - l.credit) FILTER (WHERE a.system_key IN ('ar_control','retention_receivable')), 0) AS receivable,
              COALESCE(SUM(l.credit - l.debit) FILTER (WHERE a.system_key = 'client_advance'), 0) AS advance
       FROM clients c
       LEFT JOIN journal_lines l ON l.company_id = c.company_id AND l.party_type = 'client' AND l.party_id = c.id
            AND EXISTS (SELECT 1 FROM journal_entries e WHERE e.id = l.entry_id AND e.status IN ('posted','reversed'))
       LEFT JOIN accounts a ON a.id = l.account_id
       WHERE c.company_id = $1 AND c.id = ANY($2::uuid[])
       GROUP BY c.id`,
        [companyId, clientIds],
      );
    for (const r of rows) {
      const receivable = Number(r.receivable);
      const advance = Number(r.advance);
      const outstanding = receivable - advance;
      const limit = r.credit_limit != null ? Number(r.credit_limit) : null;
      out.set(r.id, { receivable, advance, outstanding, limit, creditDays: r.credit_days, ...creditStatus(outstanding, limit) });
    }
    return out;
  }

  // ---------- internals ----------

  /** Assigned-project roles see clients of their projects only. */
  private async scopeClause(user: AuthUser, params: unknown[]) {
    const ids = await this.scope.projectIds(user);
    if (ids === null) return '';
    params.push(ids);
    return ` AND c.id IN (SELECT client_id FROM projects WHERE id = ANY($${params.length}::uuid[]) AND client_id IS NOT NULL)`;
  }

  private async projectScopeClause(user: AuthUser, column: string, params: unknown[]) {
    const ids = await this.scope.projectIds(user);
    if (ids === null) return '';
    params.push(ids);
    return ` AND ${column} = ANY($${params.length}::uuid[])`;
  }

  private async loadVisible(user: AuthUser, id: string, em?: EntityManager) {
    const m = em ?? this.ds.manager;
    const client = await m.findOne(Client, { where: { id, companyId: user.companyId } });
    if (!client) throw new NotFoundException('Client not found');
    const ids = await this.scope.projectIds(user);
    if (ids !== null) {
      const rows: unknown[] = await m.query('SELECT 1 FROM projects WHERE client_id = $1 AND id = ANY($2::uuid[]) LIMIT 1', [id, ids]);
      if (rows.length === 0) throw new NotFoundException('Client not found');
    }
    return client;
  }

  private async assertGstinFree(m: EntityManager, companyId: string, gstin: string, exceptId?: string) {
    const rows: { id: string; name: string; code: string | null }[] = await m.query(
      'SELECT id, name, code FROM clients WHERE company_id = $1 AND upper(gstin) = $2 AND deleted_at IS NULL AND ($3::uuid IS NULL OR id <> $3)',
      [companyId, gstin, exceptId ?? null],
    );
    if (rows.length)
      throw new ConflictException(`GSTIN ${gstin} already belongs to ${rows[0].code ? rows[0].code + ' · ' : ''}${rows[0].name}`);
  }

  /** A client with contacts always has a primary one: the longest-standing remaining contact takes over. */
  private async promoteNextPrimary(m: EntityManager, clientId: string, exceptId: string) {
    if (await m.count(Contact, { where: { clientId, isPrimary: true } })) return;
    const next = await m
      .createQueryBuilder(Contact, 'c')
      .where('c.client_id = :clientId AND c.id <> :exceptId AND c.deleted_at IS NULL', { clientId, exceptId })
      .orderBy('c.created_at', 'ASC')
      .getOne();
    if (next) await m.update(Contact, { id: next.id }, { isPrimary: true });
  }

  private async insertContact(m: EntityManager, companyId: string, clientId: string, dto: CreateContactDto) {
    const hasPrimary = await m.count(Contact, { where: { clientId, isPrimary: true } });
    const isPrimary = dto.isPrimary ?? hasPrimary === 0; // the first contact becomes primary
    if (isPrimary && hasPrimary) await m.update(Contact, { clientId, isPrimary: true }, { isPrimary: false });
    return m.save(
      m.create(Contact, {
        companyId,
        clientId,
        name: dto.name.trim(),
        designation: dto.designation || null,
        email: dto.email?.trim().toLowerCase() || null,
        phone: dto.phone ? normalisePhone(dto.phone) : null,
        notes: dto.notes || null,
        isPrimary,
      }),
    );
  }

  private view(c: Client) {
    return {
      id: c.id,
      code: c.code,
      name: c.name,
      type: c.type,
      gstin: c.gstin,
      pan: c.pan,
      stateCode: c.stateCode,
      stateName: c.stateCode ? (GST_STATES[c.stateCode] ?? null) : null,
      email: c.email,
      phone: c.phone,
      billingAddress: c.billingAddress ?? null,
      siteAddresses: c.siteAddresses ?? [],
      creditLimit: c.creditLimit != null ? Number(c.creditLimit) : null,
      creditDays: c.creditDays ?? null,
      paymentTerms: c.paymentTerms ?? null,
      notes: c.notes ?? null,
      sourceLeadId: c.sourceLeadId ?? null,
      isActive: c.isActive,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }
}
