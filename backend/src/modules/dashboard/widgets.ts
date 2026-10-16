/**
 * Dashboard widget catalogue and layout rules. Pure data + functions so they are easy to test;
 * the data for each widget is produced by DashboardDataService.
 */

export type WidgetType = 'kpis' | 'trend' | 'funnel' | 'table' | 'alerts' | 'shortcuts';
export type WidgetSize = 'full' | 'half';

export interface WidgetDef {
  key: string;
  title: string;
  description: string;
  type: WidgetType;
  size: WidgetSize;
  /** Any one of these unlocks the widget. Empty = every staff user. */
  permissions: string[];
}

/** Widgets with a live data source today. */
export const WIDGETS: WidgetDef[] = [
  {
    key: 'finance.position',
    title: 'Cash & balances',
    description: 'Cash and bank, receivables, payables and net GST from the ledger',
    type: 'kpis',
    size: 'full',
    permissions: ['finance.ledger.read', 'finance.reports.read'],
  },
  {
    key: 'finance.revenue_trend',
    title: 'Contract revenue this financial year',
    description: 'Revenue posted per month, April to March',
    type: 'trend',
    size: 'half',
    permissions: ['finance.ledger.read', 'finance.reports.read'],
  },
  {
    key: 'finance.receivables_top',
    title: 'Top receivables',
    description: 'Clients with the largest amounts outstanding',
    type: 'table',
    size: 'half',
    permissions: ['finance.ledger.read', 'finance.reports.read'],
  },
  {
    key: 'projects.summary',
    title: 'Projects',
    description: 'Your projects by status, contract value and progress',
    type: 'kpis',
    size: 'full',
    permissions: ['projects.read'],
  },
  {
    key: 'projects.list',
    title: 'My projects',
    description: 'Active projects you can see, with progress and end date',
    type: 'table',
    size: 'half',
    permissions: ['projects.read'],
  },
  {
    key: 'site.open_issues',
    title: 'Open site issues',
    description: 'Unresolved issues, delays, safety and quality problems on your projects',
    type: 'alerts',
    size: 'half',
    permissions: ['site.issues.manage', 'site.reports.read'],
  },
  {
    key: 'sales.pipeline',
    title: 'Sales pipeline',
    description: 'Open leads, pipeline value, won and lost',
    type: 'kpis',
    size: 'full',
    permissions: ['crm.leads.read', 'reports.read'],
  },
  {
    key: 'sales.funnel',
    title: 'Pipeline by stage',
    description: 'Open leads at each stage',
    type: 'funnel',
    size: 'half',
    permissions: ['crm.leads.read', 'reports.read'],
  },
  {
    key: 'sales.followups',
    title: 'Follow-ups due',
    description: 'Leads with a follow-up overdue or due in the next two days',
    type: 'table',
    size: 'half',
    permissions: ['crm.leads.read'],
  },
  {
    key: 'approvals.inbox',
    title: 'Waiting for your approval',
    description: 'Requests where you are the current approver',
    type: 'table',
    size: 'half',
    permissions: [],
  },
  {
    key: 'approvals.mine',
    title: 'Your requests',
    description: 'Approval requests you raised that are still pending',
    type: 'table',
    size: 'half',
    permissions: [],
  },
  {
    key: 'shortcuts',
    title: 'Modules',
    description: 'Quick links to the modules your role uses',
    type: 'shortcuts',
    size: 'full',
    permissions: [],
  },
];

/** Widgets that roles' layouts already name; they appear once their module ships. */
export const PLANNED_WIDGETS: Record<string, { title: string; module: string }> = {
  'safety.lti_free_days': { title: 'Days without lost-time injury', module: 'Safety' },
  'safety.incident_trend': { title: 'Incidents & near-misses', module: 'Safety' },
  'safety.open_permits': { title: 'Open permits to work', module: 'Safety' },
  'safety.toolbox_compliance': { title: 'Toolbox talk compliance', module: 'Safety' },
  'safety.expiring_certs': { title: 'Expiring certificates', module: 'Safety' },
  'finance.ageing': { title: 'Receivables & payables ageing', module: 'Accounting' },
  'finance.tax_due': { title: 'GST / TDS due dates', module: 'Accounting' },
  'finance.unreconciled': { title: 'Unreconciled bank lines', module: 'Accounting' },
  'cost.budget_vs_actual': { title: 'Budget vs actual', module: 'Accounting' },
  'schedule.variance': { title: 'Schedule variance', module: 'Projects' },
  'schedule.s_curve': { title: 'Planned vs actual progress', module: 'Projects' },
  'schedule.critical_path': { title: 'Critical-path activities', module: 'Projects' },
  'schedule.lookahead': { title: 'Look-ahead (2–4 weeks)', module: 'Projects' },
  'billing.upcoming': { title: 'Upcoming milestones & billing', module: 'Billing' },
  'billing.ra_pending': { title: 'Client RA bills to prepare', module: 'Billing' },
  'subcontract.bills_to_verify': { title: 'Subcontractor bills to verify', module: 'Billing' },
  'site.today_tasks': { title: "Today's tasks", module: 'Site' },
  'site.attendance': { title: "Today's attendance", module: 'Site' },
  'materials.pending_requests': { title: 'Pending material requests', module: 'Materials' },
  'materials.needed_vs_ordered': { title: 'Material needed vs ordered', module: 'Materials' },
  'quality.inspections_due': { title: 'Inspections due', module: 'Quality' },
  'quality.ncr_ageing': { title: 'Open NCRs by age', module: 'Quality' },
  'quality.first_time_pass': { title: 'First-time pass rate', module: 'Quality' },
  'quality.open_snags': { title: 'Open snags', module: 'Quality' },
  'mep.progress_by_system': { title: 'MEP progress by system', module: 'Projects' },
  'mep.tests_due': { title: 'MEP tests due / failed', module: 'Quality' },
  'procurement.open_requests': { title: 'Open requests & POs', module: 'Procurement' },
  'procurement.late_deliveries': { title: 'Late deliveries', module: 'Procurement' },
  'vendors.expiring_docs': { title: 'Expiring vendor documents', module: 'Vendors' },
  'vendors.scores': { title: 'Vendor scores', module: 'Vendors' },
  'inventory.reorder': { title: 'Stock below reorder level', module: 'Inventory' },
  'inventory.pending_grn': { title: 'Pending receipts & transfers', module: 'Inventory' },
  'assets.checked_out': { title: 'Tools checked out', module: 'Tools & assets' },
  'drawings.pending_approval': { title: 'Drawings awaiting approval', module: 'Drawings' },
  'drawings.open_rfis': { title: 'Open RFIs', module: 'Drawings' },
  'hr.headcount': { title: 'Headcount & attendance', module: 'People' },
  'hr.leave_pending': { title: 'Leave pending', module: 'People' },
  'labour.cost_by_project': { title: 'Labour cost by project', module: 'People' },
  'sales.quotations_awaiting': { title: 'Quotations awaiting client', module: 'Quotations' },
};

/** Built-in default layouts per role template (docs/ROLES.md dashboards). Admins can override per role. */
export const ROLE_LAYOUTS: Record<string, string[]> = {
  'Company Owner': [
    'finance.position',
    'projects.summary',
    'approvals.inbox',
    'site.open_issues',
    'finance.revenue_trend',
    'finance.receivables_top',
    'sales.pipeline',
    'sales.funnel',
    'safety.lti_free_days',
    'finance.ageing',
    'shortcuts',
  ],
  Director: [
    'projects.summary',
    'finance.position',
    'approvals.inbox',
    'site.open_issues',
    'finance.revenue_trend',
    'sales.pipeline',
    'safety.lti_free_days',
    'shortcuts',
  ],
  'Project Manager': [
    'projects.summary',
    'approvals.inbox',
    'projects.list',
    'site.open_issues',
    'schedule.variance',
    'cost.budget_vs_actual',
    'billing.upcoming',
    'approvals.mine',
    'shortcuts',
  ],
  'Planning Engineer': [
    'projects.list',
    'site.open_issues',
    'schedule.s_curve',
    'schedule.critical_path',
    'schedule.lookahead',
    'materials.needed_vs_ordered',
    'approvals.mine',
    'shortcuts',
  ],
  'Site Engineer': [
    'projects.list',
    'site.open_issues',
    'site.today_tasks',
    'site.attendance',
    'materials.pending_requests',
    'quality.inspections_due',
    'safety.open_permits',
    'approvals.mine',
    'shortcuts',
  ],
  'MEP Engineer': [
    'projects.list',
    'site.open_issues',
    'mep.progress_by_system',
    'mep.tests_due',
    'quality.open_snags',
    'materials.pending_requests',
    'approvals.mine',
    'shortcuts',
  ],
  'Site Supervisor': ['projects.list', 'site.open_issues', 'site.attendance', 'site.today_tasks', 'shortcuts'],
  'Quantity Surveyor': ['projects.list', 'billing.ra_pending', 'subcontract.bills_to_verify', 'approvals.mine', 'shortcuts'],
  'QC Engineer': [
    'projects.list',
    'site.open_issues',
    'quality.inspections_due',
    'quality.ncr_ageing',
    'quality.first_time_pass',
    'shortcuts',
  ],
  'Safety Officer': [
    'projects.list',
    'site.open_issues',
    'safety.incident_trend',
    'safety.open_permits',
    'safety.toolbox_compliance',
    'safety.expiring_certs',
    'shortcuts',
  ],
  'Site Storekeeper': ['projects.list', 'inventory.reorder', 'inventory.pending_grn', 'assets.checked_out', 'approvals.mine', 'shortcuts'],
  Designer: ['projects.list', 'drawings.pending_approval', 'drawings.open_rfis', 'shortcuts'],
  'Purchase Manager': [
    'approvals.mine',
    'procurement.open_requests',
    'procurement.late_deliveries',
    'vendors.expiring_docs',
    'vendors.scores',
    'shortcuts',
  ],
  'Store Manager': ['inventory.reorder', 'inventory.pending_grn', 'assets.checked_out', 'approvals.mine', 'shortcuts'],
  Finance: [
    'finance.position',
    'approvals.inbox',
    'finance.revenue_trend',
    'finance.receivables_top',
    'finance.ageing',
    'finance.tax_due',
    'finance.unreconciled',
    'shortcuts',
  ],
  HR: ['approvals.inbox', 'hr.headcount', 'hr.leave_pending', 'labour.cost_by_project', 'shortcuts'],
  'Sales Executive': ['sales.pipeline', 'sales.followups', 'sales.funnel', 'sales.quotations_awaiting', 'approvals.mine', 'shortcuts'],
};

/** Custom roles without a layout get this. */
export const FALLBACK_LAYOUT = ['approvals.inbox', 'approvals.mine', 'shortcuts'];

export const WIDGETS_BY_KEY = new Map(WIDGETS.map((w) => [w.key, w]));

export function isKnownWidget(key: string) {
  return WIDGETS_BY_KEY.has(key) || key in PLANNED_WIDGETS;
}

export function canSee(def: WidgetDef, permissions: string[]) {
  return def.permissions.length === 0 || def.permissions.some((p) => permissions.includes(p));
}

export interface RoleLayoutSource {
  name: string;
  /** Admin override stored on the role; null/undefined = built-in default for the role name. */
  dashboardLayout?: string[] | null;
}

export interface UserLayoutItem {
  key: string;
  hidden?: boolean;
}

export interface ResolvedLayout {
  widgets: (WidgetDef & { hidden: boolean })[];
  upcoming: { key: string; title: string; module: string }[];
  customised: boolean;
}

/**
 * Combine the user's roles (in order) into one layout, then apply the user's own order / hidden
 * flags. Only live widgets the user is permitted to see are returned; planned widgets named by
 * the roles are listed separately as "upcoming". Widgets added to a role later still appear for
 * users who customised before (appended at the end).
 */
export function resolveLayout(roles: RoleLayoutSource[], permissions: string[], userLayout?: UserLayoutItem[] | null): ResolvedLayout {
  const base: string[] = [];
  for (const role of roles) {
    const keys = role.dashboardLayout ?? ROLE_LAYOUTS[role.name] ?? [];
    for (const k of keys) if (!base.includes(k)) base.push(k);
  }
  if (base.length === 0) base.push(...FALLBACK_LAYOUT);

  const permitted = (key: string) => {
    const def = WIDGETS_BY_KEY.get(key);
    return !!def && canSee(def, permissions);
  };

  const ordered: UserLayoutItem[] = [];
  if (userLayout?.length) {
    for (const item of userLayout)
      if (permitted(item.key) && !ordered.some((o) => o.key === item.key)) ordered.push({ key: item.key, hidden: !!item.hidden });
  }
  for (const key of base) if (permitted(key) && !ordered.some((o) => o.key === key)) ordered.push({ key, hidden: false });

  const upcoming = base.filter((k) => !WIDGETS_BY_KEY.has(k) && k in PLANNED_WIDGETS).map((k) => ({ key: k, ...PLANNED_WIDGETS[k] }));

  return {
    widgets: ordered.map((o) => ({ ...WIDGETS_BY_KEY.get(o.key)!, hidden: !!o.hidden })),
    upcoming,
    customised: !!userLayout?.length,
  };
}
