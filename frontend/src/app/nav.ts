import { IconName } from './icons';

/**
 * Navigation catalog. `permissions` lists the codes that unlock an item (any one suffices;
 * empty = everyone). `ready` marks modules that have screens; the rest show a placeholder.
 * `mobileRank` orders the bottom bar on phones — lowest numbers win the 4 visible slots.
 */
export interface NavItem {
  key: string;
  label: string;
  path: string;
  icon: IconName;
  permissions: string[];
  ready: boolean;
  mobileRank?: number;
  group: 'Work' | 'Supply' | 'Business' | 'Company';
}

export const NAV: NavItem[] = [
  { key: 'home', label: 'Home', path: '/', icon: 'home', permissions: [], ready: true, mobileRank: 0, group: 'Work' },
  { key: 'leads', label: 'Leads', path: '/crm/leads', icon: 'leads', permissions: ['crm.leads.read'], ready: true, mobileRank: 1, group: 'Work' },
  { key: 'clients', label: 'Clients', path: '/crm/clients', icon: 'clients', permissions: ['crm.clients.read'], ready: false, group: 'Work' },
  { key: 'quotations', label: 'Quotations', path: '/sales/quotations', icon: 'quotations', permissions: ['sales.quotations.read'], ready: false, mobileRank: 5, group: 'Work' },
  { key: 'projects', label: 'Projects', path: '/projects', icon: 'projects', permissions: ['projects.read'], ready: false, mobileRank: 2, group: 'Work' },
  { key: 'drawings', label: 'Drawings', path: '/drawings', icon: 'drawings', permissions: ['drawings.read'], ready: false, group: 'Work' },
  { key: 'site', label: 'Site', path: '/site', icon: 'site', permissions: ['site.reports.read', 'site.reports.submit', 'site.attendance.mark', 'site.labour.manage'], ready: false, mobileRank: 3, group: 'Work' },
  { key: 'quality', label: 'Quality', path: '/quality', icon: 'quality', permissions: ['quality.inspections.request', 'quality.inspections.perform', 'quality.ncr.manage', 'quality.snags.manage'], ready: false, group: 'Work' },
  { key: 'safety', label: 'Safety', path: '/safety', icon: 'safety', permissions: ['safety.permits.request', 'safety.permits.approve', 'safety.incidents.report', 'safety.manage'], ready: false, group: 'Work' },
  { key: 'materials', label: 'Materials', path: '/materials', icon: 'materials', permissions: ['procurement.mr.manage', 'procurement.mr.approve', 'inventory.issue'], ready: false, mobileRank: 4, group: 'Supply' },
  { key: 'procurement', label: 'Procurement', path: '/procurement', icon: 'procurement', permissions: ['procurement.rfq.manage', 'procurement.po.manage', 'procurement.po.approve', 'procurement.grn.manage'], ready: false, group: 'Supply' },
  { key: 'vendors', label: 'Vendors', path: '/vendors', icon: 'vendors', permissions: ['vendors.read'], ready: false, group: 'Supply' },
  { key: 'inventory', label: 'Inventory', path: '/inventory', icon: 'inventory', permissions: ['inventory.read'], ready: false, group: 'Supply' },
  { key: 'assets', label: 'Tools & assets', path: '/assets', icon: 'assets', permissions: ['assets.read'], ready: false, group: 'Supply' },
  { key: 'billing', label: 'Billing', path: '/billing', icon: 'quotations', permissions: ['billing.ra.prepare', 'billing.ra.approve', 'subcontract.wo.manage', 'subcontract.bills.verify', 'subcontract.bills.approve'], ready: false, group: 'Business' },
  { key: 'people', label: 'People', path: '/people', icon: 'people', permissions: ['hr.employees.manage', 'hr.payroll.manage', 'hr.leave.approve', 'labour.wages.manage', 'labour.wages.approve'], ready: false, group: 'Business' },
  { key: 'accounting', label: 'Accounting', path: '/accounting', icon: 'accounting', permissions: ['finance.reports.read', 'finance.invoices.manage', 'finance.payments.manage', 'finance.expenses.manage'], ready: false, group: 'Business' },
  { key: 'reports', label: 'Reports', path: '/reports', icon: 'reports', permissions: ['reports.read'], ready: false, group: 'Business' },
  { key: 'admin', label: 'Admin', path: '/admin', icon: 'admin', permissions: ['admin.users.manage', 'admin.roles.manage', 'admin.settings.manage', 'admin.audit.read'], ready: false, group: 'Company' },
];

export const NAV_GROUPS: NavItem['group'][] = ['Work', 'Supply', 'Business', 'Company'];

export function visibleNav(can: (...codes: string[]) => boolean): NavItem[] {
  return NAV.filter((item) => can(...item.permissions));
}

/** Up to `slots` items for the phone bottom bar; Home is always first. */
export function mobileNav(items: NavItem[], slots = 4): NavItem[] {
  return items
    .filter((i) => i.mobileRank !== undefined)
    .sort((a, b) => (a.mobileRank ?? 99) - (b.mobileRank ?? 99))
    .slice(0, slots);
}

export function findNav(pathname: string): NavItem | undefined {
  if (pathname === '/') return NAV[0];
  return NAV.filter((i) => i.path !== '/' && (pathname === i.path || pathname.startsWith(i.path + '/'))).sort((a, b) => b.path.length - a.path.length)[0];
}
