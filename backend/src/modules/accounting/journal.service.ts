import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Account, FinancialYear, JournalEntry, JournalLine, VoucherSequence, VoucherType } from '../../entities/accounting.entities';
import { JournalLineDto, PostJournalDto, QueryJournalsDto, ReverseJournalDto } from './dto/journal.dto';
import { LedgerSetupService } from './ledger-setup.service';

/** Money is handled in paise (integers) while validating so 0.1 + 0.2 never bites. */
const paise = (n: number | string | undefined) => Math.round(Number(n ?? 0) * 100);
const rupees = (p: number) => (p / 100).toFixed(2);

export interface ResolvedLine {
  accountId: string;
  debit: number; // paise
  credit: number; // paise
  partyType?: string;
  partyId?: string;
  branchId?: string;
  projectId?: string;
  costCodeId?: string;
  refType?: string;
  refId?: string;
  description?: string;
}

/**
 * Pure validation of a journal: balanced, every line one-sided and non-zero, accounts resolvable,
 * postable (not group / inactive), party present on party ledgers. Throws BadRequestException.
 */
export function validateJournalLines(lines: JournalLineDto[], accounts: Account[]): ResolvedLine[] {
  if (lines.length < 2) throw new BadRequestException('A journal entry needs at least two lines');
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const byKey = new Map(accounts.filter((a) => a.systemKey).map((a) => [a.systemKey as string, a]));
  let debit = 0;
  let credit = 0;
  const resolved = lines.map((l, i) => {
    const account = l.accountId ? byId.get(l.accountId) : l.systemKey ? byKey.get(l.systemKey) : undefined;
    if (!account) throw new BadRequestException(`Line ${i + 1}: unknown account ${l.accountId ?? l.systemKey ?? '(none)'}`);
    if (account.isGroup) throw new BadRequestException(`Line ${i + 1}: ${account.name} is a group account and cannot take postings`);
    if (!account.isActive) throw new BadRequestException(`Line ${i + 1}: ${account.name} is inactive`);
    const d = paise(l.debit);
    const c = paise(l.credit);
    if (d > 0 === c > 0) throw new BadRequestException(`Line ${i + 1}: exactly one of debit / credit must be greater than zero`);
    if (account.partyLedger && !l.partyId)
      throw new BadRequestException(`Line ${i + 1}: ${account.name} is a ${account.partyLedger} ledger and needs a partyId`);
    if (account.partyLedger && l.partyType && l.partyType !== account.partyLedger) {
      throw new BadRequestException(`Line ${i + 1}: ${account.name} takes ${account.partyLedger} parties, not ${l.partyType}`);
    }
    debit += d;
    credit += c;
    return {
      accountId: account.id,
      debit: d,
      credit: c,
      partyType: account.partyLedger ?? l.partyType,
      partyId: l.partyId,
      branchId: l.branchId,
      projectId: l.projectId,
      costCodeId: l.costCodeId,
      refType: l.refType,
      refId: l.refId,
      description: l.description,
    };
  });
  if (debit !== credit) throw new BadRequestException(`Journal entry is not balanced: debit ${rupees(debit)} vs credit ${rupees(credit)}`);
  return resolved;
}

@Injectable()
export class JournalService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly setup: LedgerSetupService,
  ) {}

  /**
   * Posts a balanced journal entry in one transaction: validates, resolves system keys, assigns
   * the next voucher number for the financial year, inserts entry + lines, flips to posted.
   * The database triggers re-check balance, period locks and immutability independently.
   */
  post(companyId: string, userId: string | null, dto: PostJournalDto, em?: EntityManager): Promise<JournalEntry> {
    const run = (m: EntityManager) => this.postWith(m, companyId, userId, dto);
    return em ? run(em) : this.dataSource.transaction(run);
  }

  private async postWith(
    em: EntityManager,
    companyId: string,
    userId: string | null,
    dto: PostJournalDto,
    reversalOfId: string | null = null,
  ): Promise<JournalEntry> {
    const accounts = await em.find(Account, { where: { companyId } });
    if (accounts.length === 0) throw new BadRequestException('Books are not set up for this company — run accounting setup first');
    const lines = validateJournalLines(dto.lines, accounts);

    const voucherType = await em.findOne(VoucherType, { where: { companyId, code: dto.voucherType } });
    if (!voucherType) throw new BadRequestException(`Unknown voucher type ${dto.voucherType}`);

    const fy = await this.financialYearForDate(em, companyId, dto.entryDate);
    const number = await this.nextNumber(em, voucherType, fy);

    const entry = await em.save(
      em.create(JournalEntry, {
        companyId,
        fyId: fy.id,
        voucherTypeId: voucherType.id,
        entryDate: dto.entryDate,
        narration: dto.narration ?? null,
        sourceType: dto.sourceType ?? null,
        sourceId: dto.sourceId ?? null,
        reversalOfId, // must be set before posting: posted entries are immutable
        status: 'draft',
        createdBy: userId,
      }),
    );
    await em.save(
      lines.map((l, i) =>
        em.create(JournalLine, {
          entryId: entry.id,
          companyId,
          lineNo: i + 1,
          accountId: l.accountId,
          debit: rupees(l.debit),
          credit: rupees(l.credit),
          partyType: (l.partyType as JournalLine['partyType']) ?? null,
          partyId: l.partyId ?? null,
          branchId: l.branchId ?? null,
          projectId: l.projectId ?? null,
          costCodeId: l.costCodeId ?? null,
          refType: l.refType ?? null,
          refId: l.refId ?? null,
          description: l.description ?? null,
        }),
      ),
    );
    await em.update(JournalEntry, { id: entry.id }, { status: 'posted', number, postedAt: new Date(), postedBy: userId });
    return this.loadEntry(em, companyId, entry.id);
  }

  /** Posts the mirror image of a posted entry and links the two. */
  reverse(companyId: string, userId: string | null, entryId: string, dto: ReverseJournalDto): Promise<JournalEntry> {
    return this.dataSource.transaction(async (em) => {
      const original = await this.loadEntry(em, companyId, entryId);
      if (original.status !== 'posted')
        throw new BadRequestException(`Only posted entries can be reversed (this one is ${original.status})`);
      const voucherType = await em.findOne(VoucherType, { where: { id: original.voucherTypeId } });
      const reversal = await this.postWith(
        em,
        companyId,
        userId,
        {
          voucherType: voucherType!.code,
          entryDate: dto.entryDate ?? original.entryDate,
          narration: dto.narration ?? `Reversal of ${original.number}`,
          sourceType: original.sourceType ?? undefined,
          sourceId: original.sourceId ?? undefined,
          lines: original.lines.map((l) => ({
            accountId: l.accountId,
            debit: Number(l.credit),
            credit: Number(l.debit),
            partyType: l.partyType ?? undefined,
            partyId: l.partyId ?? undefined,
            branchId: l.branchId ?? undefined,
            projectId: l.projectId ?? undefined,
            costCodeId: l.costCodeId ?? undefined,
            refType: l.refType ?? undefined,
            refId: l.refId ?? undefined,
            description: l.description ?? undefined,
          })),
        },
        original.id,
      );
      await em.update(JournalEntry, { id: original.id }, { status: 'reversed', reversedById: reversal.id });
      return this.loadEntry(em, companyId, reversal.id);
    });
  }

  async findAll(companyId: string, q: QueryJournalsDto) {
    const page = Math.max(1, Number(q.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(q.pageSize ?? 20)));
    const qb = this.dataSource
      .getRepository(JournalEntry)
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.lines', 'l')
      .where('e.companyId = :companyId', { companyId })
      .orderBy('e.entryDate', 'DESC')
      .addOrderBy('e.createdAt', 'DESC')
      .addOrderBy('l.lineNo', 'ASC');
    if (q.status) qb.andWhere('e.status = :status', { status: q.status });
    if (q.from) qb.andWhere('e.entryDate >= :from', { from: q.from });
    if (q.to) qb.andWhere('e.entryDate <= :to', { to: q.to });
    if (q.voucherType)
      qb.andWhere('e.voucherTypeId IN (SELECT id FROM voucher_types WHERE company_id = :companyId AND code = :vt)', { vt: q.voucherType });
    if (q.accountId) qb.andWhere('e.id IN (SELECT entry_id FROM journal_lines WHERE account_id = :accountId)', { accountId: q.accountId });
    if (q.projectId) qb.andWhere('e.id IN (SELECT entry_id FROM journal_lines WHERE project_id = :projectId)', { projectId: q.projectId });
    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();
    return { data, total, page, pageSize };
  }

  findOne(companyId: string, id: string) {
    return this.loadEntry(this.dataSource.manager, companyId, id);
  }

  private async loadEntry(em: EntityManager, companyId: string, id: string): Promise<JournalEntry> {
    const entry = await em.findOne(JournalEntry, { where: { id, companyId }, relations: ['lines'], order: { lines: { lineNo: 'ASC' } } });
    if (!entry) throw new NotFoundException('Journal entry not found');
    return entry;
  }

  private async financialYearForDate(em: EntityManager, companyId: string, date: string): Promise<FinancialYear> {
    const fy = await em
      .createQueryBuilder(FinancialYear, 'fy')
      .where('fy.companyId = :companyId AND :date BETWEEN fy.startDate AND fy.endDate', { companyId, date })
      .getOne();
    if (fy) {
      if (fy.status === 'closed') throw new BadRequestException(`Financial year ${fy.name} is closed`);
      return fy;
    }
    // Future-dated or early entries land in a year that does not exist yet: create it (open) on demand.
    return this.setup.ensureFinancialYear(em, companyId, new Date(date + 'T00:00:00Z'));
  }

  /** Serialises on the sequence row so concurrent postings never share a number. */
  private async nextNumber(em: EntityManager, voucherType: VoucherType, fy: FinancialYear): Promise<string> {
    await em.query(
      `INSERT INTO voucher_sequences (voucher_type_id, fy_id, next_no) VALUES ($1, $2, 1)
       ON CONFLICT (voucher_type_id, fy_id) DO NOTHING`,
      [voucherType.id, fy.id],
    );
    const result = await em.query(
      `UPDATE voucher_sequences SET next_no = next_no + 1 WHERE voucher_type_id = $1 AND fy_id = $2 RETURNING next_no - 1 AS next_no`,
      [voucherType.id, fy.id],
    );
    // TypeORM returns [rows, affectedCount] for UPDATE … RETURNING on postgres.
    const rows: { next_no: number }[] = Array.isArray(result[0]) ? result[0] : result;
    const seq = Number(rows[0].next_no);
    if (!Number.isFinite(seq)) throw new Error('voucher sequence did not return a number');
    return `${voucherType.prefix}/${fy.name}/${String(seq).padStart(4, '0')}`;
  }

  /** Used by unit tests and by other modules that need a VoucherSequence-free number preview. */
  static formatNumber(prefix: string, fyName: string, seq: number) {
    return `${prefix}/${fyName}/${String(seq).padStart(4, '0')}`;
  }

  /** Convenience for other modules: post by system keys without building DTO classes. */
  postBySystemKeys(
    companyId: string,
    userId: string | null,
    input: { voucherType: string; entryDate: string; narration?: string; sourceType?: string; sourceId?: string; lines: JournalLineDto[] },
    em?: EntityManager,
  ) {
    return this.post(companyId, userId, input as PostJournalDto, em);
  }

  static readonly VoucherSequence = VoucherSequence;
}
