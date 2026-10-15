import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Account, AccountingPeriod, FinancialYear, VoucherType } from '../../entities/accounting.entities';
import { CreateAccountDto, UpdateAccountDto } from './dto/journal.dto';
import { LedgerSetupService } from './ledger-setup.service';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    @InjectRepository(FinancialYear) private readonly years: Repository<FinancialYear>,
    @InjectRepository(AccountingPeriod) private readonly periods: Repository<AccountingPeriod>,
    @InjectRepository(VoucherType) private readonly voucherTypes: Repository<VoucherType>,
    private readonly dataSource: DataSource,
    private readonly setup: LedgerSetupService,
  ) {}

  /** Flat list ordered by code; the UI builds the tree from parentId. Includes balances. */
  async list(companyId: string, opts: { withBalances?: boolean } = {}) {
    const rows = await this.accounts.find({ where: { companyId }, order: { code: 'ASC' } });
    if (!opts.withBalances) return rows;
    const balances: { account_id: string; debit: string; credit: string; balance: string }[] = await this.dataSource.query(
      'SELECT account_id, debit, credit, balance FROM v_account_balances WHERE company_id = $1',
      [companyId],
    );
    const byId = new Map(balances.map((b) => [b.account_id, b]));
    // Group balances roll up their descendants.
    const children = new Map<string | null, Account[]>();
    for (const a of rows) {
      const list = children.get(a.parentId ?? null) ?? [];
      list.push(a);
      children.set(a.parentId ?? null, list);
    }
    const totals = new Map<string, { debit: number; credit: number; balance: number }>();
    const roll = (a: Account): { debit: number; credit: number; balance: number } => {
      const own = byId.get(a.id);
      const t = { debit: Number(own?.debit ?? 0), credit: Number(own?.credit ?? 0), balance: Number(own?.balance ?? 0) };
      for (const c of children.get(a.id) ?? []) {
        const ct = roll(c);
        t.debit += ct.debit;
        t.credit += ct.credit;
        t.balance += ct.balance;
      }
      totals.set(a.id, t);
      return t;
    };
    for (const root of children.get(null) ?? []) roll(root);
    return rows.map((a) => ({ ...a, ...(totals.get(a.id) ?? { debit: 0, credit: 0, balance: 0 }) }));
  }

  async create(companyId: string, dto: CreateAccountDto) {
    if (await this.accounts.findOne({ where: { companyId, code: dto.code } })) throw new ConflictException(`Account code ${dto.code} already exists`);
    if (dto.parentId) {
      const parent = await this.accounts.findOne({ where: { id: dto.parentId, companyId } });
      if (!parent) throw new NotFoundException('Parent account not found');
      if (!parent.isGroup) throw new BadRequestException('Parent must be a group account');
      if (parent.type !== dto.type) throw new BadRequestException(`Parent is of type ${parent.type}; child must match`);
    }
    return this.accounts.save(this.accounts.create({ companyId, ...dto, parentId: dto.parentId ?? null, isGroup: dto.isGroup ?? false }));
  }

  async update(companyId: string, id: string, dto: UpdateAccountDto) {
    const account = await this.accounts.findOne({ where: { id, companyId } });
    if (!account) throw new NotFoundException('Account not found');
    if (dto.parentId !== undefined) {
      if (dto.parentId === id) throw new BadRequestException('An account cannot be its own parent');
      const parent = await this.accounts.findOne({ where: { id: dto.parentId, companyId } });
      if (!parent || !parent.isGroup || parent.type !== account.type) throw new BadRequestException('Invalid parent account');
      account.parentId = dto.parentId;
    }
    if (dto.name !== undefined) account.name = dto.name;
    if (dto.isActive !== undefined) {
      if (!dto.isActive && account.systemKey) throw new BadRequestException(`Move the ${account.systemKey} posting rule to another account before deactivating`);
      account.isActive = dto.isActive;
    }
    if (dto.systemKey !== undefined) {
      if (account.isGroup) throw new BadRequestException('Posting rules cannot target group accounts');
      return this.dataSource.transaction(async (em) => {
        await em.update(Account, { companyId, systemKey: dto.systemKey }, { systemKey: null });
        account.systemKey = dto.systemKey;
        return em.save(account);
      });
    }
    return this.accounts.save(account);
  }

  listVoucherTypes(companyId: string) {
    return this.voucherTypes.find({ where: { companyId }, order: { code: 'ASC' } });
  }

  async listFinancialYears(companyId: string) {
    const years = await this.years.find({ where: { companyId }, order: { startDate: 'DESC' } });
    const periods = await this.periods.find({ where: { companyId }, order: { periodStart: 'ASC' } });
    return years.map((y) => ({ ...y, periods: periods.filter((p) => p.fyId === y.id) }));
  }

  createFinancialYear(companyId: string, startDate: string) {
    return this.dataSource.transaction((em) => this.setup.ensureFinancialYear(em, companyId, new Date(startDate + 'T00:00:00Z')));
  }

  async setPeriodLock(companyId: string, periodId: string, locked: boolean, userId: string) {
    const period = await this.periods.findOne({ where: { id: periodId, companyId } });
    if (!period) throw new NotFoundException('Period not found');
    period.status = locked ? 'locked' : 'open';
    period.lockedBy = locked ? userId : null;
    period.lockedAt = locked ? new Date() : null;
    return this.periods.save(period);
  }

  /** Locks every period in the year and marks it closed. The P&L close-out entry comes with P3 reports. */
  async closeFinancialYear(companyId: string, fyId: string, userId: string) {
    const fy = await this.years.findOne({ where: { id: fyId, companyId } });
    if (!fy) throw new NotFoundException('Financial year not found');
    if (fy.status === 'closed') return fy;
    await this.periods.update({ fyId, companyId }, { status: 'locked', lockedBy: userId, lockedAt: new Date() });
    fy.status = 'closed';
    fy.closedAt = new Date();
    return this.years.save(fy);
  }
}
