import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Account } from '../../entities/accounting.entities';

/** Ledger reports straight from journal lines. Only posted / reversed entries count. */
@Injectable()
export class ReportsService {
  constructor(private readonly dataSource: DataSource) {}

  /** Trial balance for a date range: every postable account with movement plus opening balance. */
  async trialBalance(companyId: string, from?: string, to?: string) {
    const rows: { id: string; code: string; name: string; type: string; opening: string; debit: string; credit: string }[] = await this.dataSource.query(
      `SELECT a.id, a.code, a.name, a.type,
              COALESCE(SUM(CASE WHEN $2::date IS NOT NULL AND e.entry_date < $2::date THEN l.debit - l.credit ELSE 0 END), 0) AS opening,
              COALESCE(SUM(CASE WHEN ($2::date IS NULL OR e.entry_date >= $2::date) AND ($3::date IS NULL OR e.entry_date <= $3::date) THEN l.debit ELSE 0 END), 0) AS debit,
              COALESCE(SUM(CASE WHEN ($2::date IS NULL OR e.entry_date >= $2::date) AND ($3::date IS NULL OR e.entry_date <= $3::date) THEN l.credit ELSE 0 END), 0) AS credit
       FROM accounts a
       LEFT JOIN journal_lines l ON l.account_id = a.id
       LEFT JOIN journal_entries e ON e.id = l.entry_id AND e.status IN ('posted','reversed')
       WHERE a.company_id = $1 AND NOT a.is_group
       GROUP BY a.id
       HAVING COALESCE(SUM(l.debit),0) <> 0 OR COALESCE(SUM(l.credit),0) <> 0
       ORDER BY a.code`,
      [companyId, from ?? null, to ?? null],
    );
    let totalDebit = 0;
    let totalCredit = 0;
    const lines = rows.map((r) => {
      const opening = Number(r.opening);
      const debit = Number(r.debit);
      const credit = Number(r.credit);
      const closing = opening + debit - credit; // debit-positive
      totalDebit += debit;
      totalCredit += credit;
      return { accountId: r.id, code: r.code, name: r.name, type: r.type, opening, debit, credit, closing };
    });
    return { from: from ?? null, to: to ?? null, lines, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.005 };
  }

  /** Account statement: running balance line by line. */
  async ledger(companyId: string, accountId: string, from?: string, to?: string) {
    const account = await this.dataSource.getRepository(Account).findOne({ where: { id: accountId, companyId } });
    if (!account) throw new NotFoundException('Account not found');
    const debitPositive = account.type === 'asset' || account.type === 'expense';
    const [{ opening }]: { opening: string }[] = await this.dataSource.query(
      `SELECT COALESCE(SUM(l.debit - l.credit),0) AS opening
       FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id AND e.status IN ('posted','reversed')
       WHERE l.account_id = $1 AND ($2::date IS NOT NULL AND e.entry_date < $2::date)`,
      [accountId, from ?? null],
    );
    const rows: {
      entry_id: string; number: string; entry_date: string; narration: string | null; description: string | null;
      debit: string; credit: string; party_type: string | null; party_id: string | null; project_id: string | null; status: string;
    }[] = await this.dataSource.query(
      `SELECT e.id AS entry_id, e.number, e.entry_date, e.narration, e.status, l.description, l.debit, l.credit, l.party_type, l.party_id, l.project_id
       FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id AND e.status IN ('posted','reversed')
       WHERE l.account_id = $1 AND ($2::date IS NULL OR e.entry_date >= $2::date) AND ($3::date IS NULL OR e.entry_date <= $3::date)
       ORDER BY e.entry_date, e.created_at, l.line_no`,
      [accountId, from ?? null, to ?? null],
    );
    let running = Number(opening);
    const lines = rows.map((r) => {
      running += Number(r.debit) - Number(r.credit);
      return {
        entryId: r.entry_id, number: r.number, date: r.entry_date, narration: r.narration, description: r.description, status: r.status,
        debit: Number(r.debit), credit: Number(r.credit), partyType: r.party_type, partyId: r.party_id, projectId: r.project_id,
        balance: debitPositive ? running : -running,
      };
    });
    return { account: { id: account.id, code: account.code, name: account.name, type: account.type }, opening: debitPositive ? Number(opening) : -Number(opening), lines, closing: debitPositive ? running : -running };
  }
}
