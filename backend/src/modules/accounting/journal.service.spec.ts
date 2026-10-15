import { BadRequestException } from '@nestjs/common';
import { Account } from '../../entities/accounting.entities';
import { financialYearFor, monthlyPeriods } from './chart-template';
import { JournalService, validateJournalLines } from './journal.service';

const acct = (over: Partial<Account>): Account =>
  ({ id: 'x', companyId: 'co-1', code: '0', name: 'x', type: 'asset', isGroup: false, isActive: true, systemKey: null, partyLedger: null, ...over }) as Account;

const accounts: Account[] = [
  acct({ id: 'bank', code: '1121', name: 'Main Bank', systemKey: 'bank' }),
  acct({ id: 'ar', code: '1130', name: 'Accounts Receivable', systemKey: 'ar_control', partyLedger: 'client' }),
  acct({ id: 'rev', code: '4100', name: 'Contract Revenue', type: 'income', systemKey: 'contract_revenue' }),
  acct({ id: 'gst', code: '2130', name: 'Output GST', type: 'liability', systemKey: 'output_gst' }),
  acct({ id: 'grp', code: '1100', name: 'Current Assets', isGroup: true }),
  acct({ id: 'old', code: '5290', name: 'Old Misc', type: 'expense', isActive: false }),
];

describe('validateJournalLines', () => {
  it('accepts a balanced sales entry and resolves system keys to accounts', () => {
    const lines = validateJournalLines(
      [
        { systemKey: 'ar_control', debit: 118000, partyId: 'cust-1' },
        { systemKey: 'contract_revenue', credit: 100000 },
        { systemKey: 'output_gst', credit: 18000 },
      ],
      accounts,
    );
    expect(lines.map((l) => l.accountId)).toEqual(['ar', 'rev', 'gst']);
    expect(lines[0].partyType).toBe('client');
    expect(lines[0].debit).toBe(11800000); // paise
  });

  it('rejects an unbalanced entry and says by how much', () => {
    expect(() => validateJournalLines([{ accountId: 'bank', debit: 100 }, { accountId: 'rev', credit: 99.99 }], accounts)).toThrow(/not balanced: debit 100.00 vs credit 99.99/);
  });

  it('is not fooled by floating point (0.1 + 0.2)', () => {
    expect(() =>
      validateJournalLines([{ accountId: 'bank', debit: 0.1 }, { accountId: 'bank', debit: 0.2 }, { accountId: 'rev', credit: 0.3 }], accounts),
    ).not.toThrow();
  });

  it('rejects postings to group or inactive accounts', () => {
    expect(() => validateJournalLines([{ accountId: 'grp', debit: 1 }, { accountId: 'rev', credit: 1 }], accounts)).toThrow(/group account/);
    expect(() => validateJournalLines([{ accountId: 'old', debit: 1 }, { accountId: 'rev', credit: 1 }], accounts)).toThrow(/inactive/);
  });

  it('rejects lines that are both debit and credit, or neither', () => {
    expect(() => validateJournalLines([{ accountId: 'bank', debit: 1, credit: 1 }, { accountId: 'rev', credit: 0 }], accounts)).toThrow(/exactly one of debit \/ credit/);
    expect(() => validateJournalLines([{ accountId: 'bank' }, { accountId: 'rev', credit: 1 }], accounts)).toThrow(/exactly one of debit \/ credit/);
  });

  it('requires a party on party ledgers and rejects the wrong party type', () => {
    expect(() => validateJournalLines([{ accountId: 'ar', debit: 1 }, { accountId: 'rev', credit: 1 }], accounts)).toThrow(/needs a partyId/);
    expect(() => validateJournalLines([{ accountId: 'ar', debit: 1, partyId: 'v1', partyType: 'vendor' }, { accountId: 'rev', credit: 1 }], accounts)).toThrow(
      /takes client parties/,
    );
  });

  it('rejects accounts from outside the company chart (unknown id / key)', () => {
    expect(() => validateJournalLines([{ accountId: 'other-co-acct', debit: 1 }, { accountId: 'rev', credit: 1 }], accounts)).toThrow(BadRequestException);
    expect(() => validateJournalLines([{ systemKey: 'nope', debit: 1 }, { accountId: 'rev', credit: 1 }], accounts)).toThrow(/unknown account nope/);
  });

  it('needs at least two lines', () => {
    expect(() => validateJournalLines([{ accountId: 'bank', debit: 1 }], accounts)).toThrow(/at least two lines/);
  });
});

describe('financial year helpers', () => {
  it('maps dates to the Indian April–March year', () => {
    expect(financialYearFor(new Date('2026-10-15T00:00:00Z'))).toEqual({ name: '2026-27', startDate: '2026-04-01', endDate: '2027-03-31' });
    expect(financialYearFor(new Date('2026-02-01T00:00:00Z'))).toEqual({ name: '2025-26', startDate: '2025-04-01', endDate: '2026-03-31' });
    expect(financialYearFor(new Date('2026-04-01T00:00:00Z')).name).toBe('2026-27');
    expect(financialYearFor(new Date('2026-03-31T00:00:00Z')).name).toBe('2025-26');
  });

  it('splits a year into 12 monthly periods with correct month ends', () => {
    const p = monthlyPeriods('2026-04-01', '2027-03-31');
    expect(p).toHaveLength(12);
    expect(p[0]).toEqual({ periodStart: '2026-04-01', periodEnd: '2026-04-30' });
    expect(p[10]).toEqual({ periodStart: '2027-02-01', periodEnd: '2027-02-28' });
    expect(p[11]).toEqual({ periodStart: '2027-03-01', periodEnd: '2027-03-31' });
  });

  it('formats voucher numbers as PREFIX/FY/0001', () => {
    expect(JournalService.formatNumber('JV', '2026-27', 7)).toBe('JV/2026-27/0007');
  });
});
