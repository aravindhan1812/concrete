import { AccountType, PartyType } from '../../entities/accounting.entities';

/**
 * Default chart of accounts for an Indian construction / interior contractor.
 * `systemKey` is what posting rules target (see PostingService); companies may rename or
 * re-parent accounts freely but each system key must stay mapped to exactly one ledger.
 */
export interface ChartNode {
  code: string;
  name: string;
  type: AccountType;
  systemKey?: string;
  partyLedger?: PartyType;
  children?: ChartNode[];
}

export const CHART_TEMPLATE: ChartNode[] = [
  {
    code: '1000', name: 'Assets', type: 'asset',
    children: [
      {
        code: '1100', name: 'Current Assets', type: 'asset',
        children: [
          { code: '1110', name: 'Cash in Hand', type: 'asset', systemKey: 'cash' },
          { code: '1120', name: 'Bank Accounts', type: 'asset', children: [{ code: '1121', name: 'Main Bank Account', type: 'asset', systemKey: 'bank' }] },
          { code: '1130', name: 'Accounts Receivable', type: 'asset', systemKey: 'ar_control', partyLedger: 'client' },
          { code: '1140', name: 'Retention Receivable', type: 'asset', systemKey: 'retention_receivable', partyLedger: 'client' },
          { code: '1150', name: 'Advances to Vendors', type: 'asset', systemKey: 'vendor_advance', partyLedger: 'vendor' },
          { code: '1160', name: 'Input GST', type: 'asset', systemKey: 'input_gst' },
          { code: '1170', name: 'TDS Receivable', type: 'asset', systemKey: 'tds_receivable' },
          { code: '1180', name: 'Inventory', type: 'asset', systemKey: 'inventory' },
          { code: '1185', name: 'Employee Advances', type: 'asset', systemKey: 'employee_advance', partyLedger: 'employee' },
          { code: '1190', name: 'Work in Progress', type: 'asset', systemKey: 'wip' },
          { code: '1195', name: 'Unbilled Revenue', type: 'asset', systemKey: 'unbilled_revenue' },
        ],
      },
      {
        code: '1200', name: 'Fixed Assets', type: 'asset',
        children: [
          { code: '1210', name: 'Plant & Machinery', type: 'asset', systemKey: 'fixed_assets' },
          { code: '1220', name: 'Vehicles', type: 'asset' },
          { code: '1230', name: 'Tools & Equipment', type: 'asset' },
          { code: '1290', name: 'Accumulated Depreciation', type: 'asset', systemKey: 'accumulated_depreciation' },
        ],
      },
    ],
  },
  {
    code: '2000', name: 'Liabilities', type: 'liability',
    children: [
      {
        code: '2100', name: 'Current Liabilities', type: 'liability',
        children: [
          { code: '2110', name: 'Accounts Payable', type: 'liability', systemKey: 'ap_control', partyLedger: 'vendor' },
          { code: '2120', name: 'GRN Clearing', type: 'liability', systemKey: 'grn_clearing' },
          { code: '2130', name: 'Output GST', type: 'liability', systemKey: 'output_gst' },
          { code: '2140', name: 'TDS Payable', type: 'liability', systemKey: 'tds_payable' },
          { code: '2150', name: 'Retention Payable', type: 'liability', systemKey: 'retention_payable', partyLedger: 'vendor' },
          { code: '2160', name: 'Client Advances', type: 'liability', systemKey: 'client_advance', partyLedger: 'client' },
          { code: '2170', name: 'Salaries Payable', type: 'liability', systemKey: 'salary_payable' },
          { code: '2180', name: 'Statutory Payable (PF / ESI / PT)', type: 'liability', systemKey: 'statutory_payable' },
          { code: '2190', name: 'Employee Reimbursements Payable', type: 'liability', systemKey: 'employee_payable', partyLedger: 'employee' },
        ],
      },
      { code: '2200', name: 'Loans', type: 'liability', children: [{ code: '2210', name: 'Bank Loans', type: 'liability' }] },
    ],
  },
  {
    code: '3000', name: 'Equity', type: 'equity',
    children: [
      { code: '3100', name: "Owner's Capital", type: 'equity', systemKey: 'capital' },
      { code: '3200', name: 'Retained Earnings', type: 'equity', systemKey: 'retained_earnings' },
      { code: '3300', name: 'Opening Balance Adjustment', type: 'equity', systemKey: 'opening_balance_equity' },
    ],
  },
  {
    code: '4000', name: 'Income', type: 'income',
    children: [
      { code: '4100', name: 'Contract Revenue', type: 'income', systemKey: 'contract_revenue' },
      {
        code: '4200', name: 'Other Income', type: 'income',
        children: [
          { code: '4210', name: 'Interest Income', type: 'income', systemKey: 'interest_income' },
          { code: '4220', name: 'Discount Received', type: 'income' },
        ],
      },
    ],
  },
  {
    code: '5000', name: 'Expenses', type: 'expense',
    children: [
      {
        code: '5100', name: 'Direct Project Costs', type: 'expense',
        children: [
          { code: '5110', name: 'Material Cost', type: 'expense', systemKey: 'material_cost' },
          { code: '5120', name: 'Labour Cost', type: 'expense', systemKey: 'labour_cost' },
          { code: '5130', name: 'Subcontract Cost', type: 'expense', systemKey: 'subcontract_cost' },
          { code: '5140', name: 'Equipment Hire', type: 'expense', systemKey: 'equipment_cost' },
          { code: '5150', name: 'Site Overheads', type: 'expense', systemKey: 'site_overhead' },
        ],
      },
      {
        code: '5200', name: 'Operating Expenses', type: 'expense',
        children: [
          { code: '5210', name: 'Salaries & Wages', type: 'expense', systemKey: 'salaries' },
          { code: '5220', name: 'Rent', type: 'expense' },
          { code: '5230', name: 'Office & Administration', type: 'expense', systemKey: 'admin_expense' },
          { code: '5240', name: 'Travel & Conveyance', type: 'expense' },
          { code: '5250', name: 'Professional Fees', type: 'expense' },
          { code: '5260', name: 'Bank Charges', type: 'expense', systemKey: 'bank_charges' },
          { code: '5270', name: 'Depreciation', type: 'expense', systemKey: 'depreciation' },
          { code: '5280', name: 'Interest Expense', type: 'expense' },
          { code: '5290', name: 'Miscellaneous Expenses', type: 'expense', systemKey: 'misc_expense' },
        ],
      },
    ],
  },
];

export const VOUCHER_TYPES = [
  { code: 'sales', name: 'Sales', prefix: 'SAL' },
  { code: 'purchase', name: 'Purchase', prefix: 'PUR' },
  { code: 'receipt', name: 'Receipt', prefix: 'RCT' },
  { code: 'payment', name: 'Payment', prefix: 'PAY' },
  { code: 'contra', name: 'Contra', prefix: 'CON' },
  { code: 'journal', name: 'Journal', prefix: 'JV' },
  { code: 'debit_note', name: 'Debit Note', prefix: 'DN' },
  { code: 'credit_note', name: 'Credit Note', prefix: 'CN' },
] as const;

export type VoucherCode = (typeof VOUCHER_TYPES)[number]['code'];

/** Indian financial year (April–March) containing `date`. */
export function financialYearFor(date: Date, fyStartMonth = 4): { name: string; startDate: string; endDate: string } {
  const y = date.getUTCMonth() + 1 >= fyStartMonth ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  const start = new Date(Date.UTC(y, fyStartMonth - 1, 1));
  const end = new Date(Date.UTC(y + 1, fyStartMonth - 1, 0));
  const name = fyStartMonth === 1 ? String(y) : `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
  return { name, startDate: iso(start), endDate: iso(end) };
}

/** Monthly periods between two ISO dates (inclusive). */
export function monthlyPeriods(startDate: string, endDate: string): { periodStart: string; periodEnd: string }[] {
  const out: { periodStart: string; periodEnd: string }[] = [];
  let cursor = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  while (cursor <= end) {
    const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0));
    out.push({ periodStart: iso(cursor), periodEnd: iso(monthEnd < end ? monthEnd : end) });
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return out;
}

export function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
