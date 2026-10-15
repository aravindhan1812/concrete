/**
 * Business records that files and comments can attach to.
 *  - `table`: must have `id` and `company_id` columns (used to prove the record belongs to the tenant)
 *  - `read`: permission codes, any of which lets a user see the record — and therefore its files
 *    and comments. Writing a comment or uploading a file requires the same access.
 *
 * Table names are constants here and never come from the request.
 */
export interface EntityDef {
  table: string;
  read: string[];
}

export const ENTITY_REGISTRY: Record<string, EntityDef> = {
  lead: { table: 'leads', read: ['crm.leads.read'] },
  client: { table: 'clients', read: ['crm.clients.read'] },
  vendor: { table: 'vendors', read: ['vendors.read'] },
  quotation: { table: 'quotations', read: ['sales.quotations.read'] },
  boq: { table: 'boqs', read: ['sales.boq.read'] },
  project: { table: 'projects', read: ['projects.read'] },
  task: { table: 'tasks', read: ['projects.read'] },
  milestone: { table: 'milestones', read: ['projects.read'] },
  risk: { table: 'risks', read: ['projects.read'] },
  daily_site_report: { table: 'daily_site_reports', read: ['site.reports.read', 'site.reports.submit'] },
  site_issue: { table: 'site_issues', read: ['site.issues.manage', 'site.reports.read'] },
  inspection: { table: 'inspections', read: ['site.issues.manage', 'site.reports.read'] },
  material_request: { table: 'material_requests', read: ['procurement.mr.manage'] },
  rfq: { table: 'rfqs', read: ['procurement.rfq.manage'] },
  purchase_order: { table: 'purchase_orders', read: ['procurement.po.manage', 'procurement.po.approve'] },
  goods_receipt: { table: 'goods_receipts', read: ['procurement.grn.manage', 'inventory.read'] },
  vendor_invoice: { table: 'vendor_invoices', read: ['finance.payments.manage', 'finance.reports.read'] },
  stock_transfer: { table: 'stock_transfers', read: ['inventory.read'] },
  asset: { table: 'assets', read: ['assets.read'] },
  employee: { table: 'employees', read: ['hr.employees.manage'] },
  expense: { table: 'expenses', read: ['finance.expenses.manage', 'finance.expenses.approve'] },
  client_invoice: { table: 'client_invoices', read: ['finance.invoices.manage', 'finance.reports.read'] },
  journal_entry: { table: 'journal_entries', read: ['finance.ledger.read'] },
};
