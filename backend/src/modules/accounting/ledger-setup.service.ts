import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Account, AccountingPeriod, FinancialYear, VoucherType } from '../../entities/accounting.entities';
import { CHART_TEMPLATE, ChartNode, financialYearFor, monthlyPeriods, VOUCHER_TYPES } from './chart-template';

/**
 * Creates the books for a company: default chart of accounts, voucher types, and the current
 * financial year with monthly periods. Idempotent — safe to call for an existing company.
 */
@Injectable()
export class LedgerSetupService {
  constructor(private readonly dataSource: DataSource) {}

  bootstrap(companyId: string, today = new Date(), em?: EntityManager) {
    const run = (m: EntityManager) => this.bootstrapWith(m, companyId, today);
    return em ? run(em) : this.dataSource.transaction(run);
  }

  private async bootstrapWith(em: EntityManager, companyId: string, today: Date) {
    const created = { accounts: 0, voucherTypes: 0, financialYear: null as string | null };

    const existingAccounts = await em.count(Account, { where: { companyId } });
    if (existingAccounts === 0) created.accounts = await this.insertChart(em, companyId, CHART_TEMPLATE, null);

    for (const vt of VOUCHER_TYPES) {
      const exists = await em.findOne(VoucherType, { where: { companyId, code: vt.code } });
      if (!exists) {
        await em.save(em.create(VoucherType, { companyId, ...vt }));
        created.voucherTypes++;
      }
    }

    const fy = await this.ensureFinancialYear(em, companyId, today);
    created.financialYear = fy.name;
    return created;
  }

  /** Ensures a financial year (and its monthly periods) exists for the given date. */
  async ensureFinancialYear(em: EntityManager, companyId: string, date: Date): Promise<FinancialYear> {
    const spec = financialYearFor(date);
    let fy = await em.findOne(FinancialYear, { where: { companyId, name: spec.name } });
    if (fy) return fy;
    fy = await em.save(em.create(FinancialYear, { companyId, ...spec, status: 'open' }));
    await em.save(monthlyPeriods(spec.startDate, spec.endDate).map((p) => em.create(AccountingPeriod, { companyId, fyId: fy!.id, ...p, status: 'open' })));
    return fy;
  }

  private async insertChart(em: EntityManager, companyId: string, nodes: ChartNode[], parentId: string | null): Promise<number> {
    let n = 0;
    for (const node of nodes) {
      const account = await em.save(
        em.create(Account, {
          companyId,
          parentId,
          code: node.code,
          name: node.name,
          type: node.type,
          isGroup: !!node.children?.length,
          systemKey: node.systemKey ?? null,
          partyLedger: node.partyLedger ?? null,
        }),
      );
      n++;
      if (node.children) n += await this.insertChart(em, companyId, node.children, account.id);
    }
    return n;
  }
}
