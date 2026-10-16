import { PLANNED_WIDGETS, resolveLayout, ROLE_LAYOUTS, WIDGETS, WIDGETS_BY_KEY } from './widgets';

const SITE = ['projects.read', 'site.reports.read', 'site.issues.manage'];
const OWNER = [...new Set(WIDGETS.flatMap((w) => w.permissions))];

describe('resolveLayout', () => {
  it('gives a site engineer project and site widgets, never finance or sales', () => {
    const r = resolveLayout([{ name: 'Site Engineer' }], SITE);
    const keys = r.widgets.map((w) => w.key);
    expect(keys).toEqual(['projects.list', 'site.open_issues', 'approvals.mine', 'shortcuts']);
    expect(keys.some((k) => k.startsWith('finance.') || k.startsWith('sales.'))).toBe(false);
  });

  it('lists the role’s planned widgets as upcoming, with their module', () => {
    const r = resolveLayout([{ name: 'Site Engineer' }], SITE);
    expect(r.upcoming.map((u) => u.key)).toEqual([
      'site.today_tasks',
      'site.attendance',
      'materials.pending_requests',
      'quality.inspections_due',
      'safety.open_permits',
    ]);
    expect(r.upcoming[0].module).toBe('Site');
  });

  it('drops widgets the user is not permitted to see even if the role lists them', () => {
    const r = resolveLayout([{ name: 'Company Owner' }], ['projects.read']);
    expect(r.widgets.map((w) => w.key)).toEqual(['projects.summary', 'approvals.inbox', 'shortcuts']);
  });

  it('merges several roles in order without duplicates', () => {
    const r = resolveLayout([{ name: 'Sales Executive' }, { name: 'Project Manager' }], [...SITE, 'crm.leads.read']);
    const keys = r.widgets.map((w) => w.key);
    expect(keys.slice(0, 3)).toEqual(['sales.pipeline', 'sales.followups', 'sales.funnel']);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain('projects.summary');
  });

  it('an admin override replaces the built-in role layout', () => {
    const r = resolveLayout([{ name: 'Site Engineer', dashboardLayout: ['site.open_issues', 'shortcuts'] }], SITE);
    expect(r.widgets.map((w) => w.key)).toEqual(['site.open_issues', 'shortcuts']);
  });

  it('custom roles without a layout get the fallback', () => {
    expect(resolveLayout([{ name: 'Planning Coordinator' }], []).widgets.map((w) => w.key)).toEqual([
      'approvals.inbox',
      'approvals.mine',
      'shortcuts',
    ]);
  });

  it('applies the user’s order and hidden flags, and appends widgets added to the role later', () => {
    const r = resolveLayout([{ name: 'Site Engineer' }], SITE, [{ key: 'site.open_issues' }, { key: 'shortcuts', hidden: true }]);
    expect(r.widgets.map((w) => [w.key, w.hidden])).toEqual([
      ['site.open_issues', false],
      ['shortcuts', true],
      ['projects.list', false],
      ['approvals.mine', false],
    ]);
    expect(r.customised).toBe(true);
  });

  it('ignores saved widgets the user has since lost permission for', () => {
    const r = resolveLayout([{ name: 'Site Engineer' }], SITE, [{ key: 'finance.position' }, { key: 'site.open_issues' }]);
    expect(r.widgets[0].key).toBe('site.open_issues');
    expect(r.widgets.some((w) => w.key === 'finance.position')).toBe(false);
  });
});

describe('catalogue integrity', () => {
  it('every role layout names only known widgets', () => {
    for (const [role, keys] of Object.entries(ROLE_LAYOUTS)) {
      for (const k of keys) expect([role, WIDGETS_BY_KEY.has(k) || k in PLANNED_WIDGETS]).toEqual([role, true]);
    }
  });

  it('no key is both live and planned', () => {
    for (const w of WIDGETS) expect(w.key in PLANNED_WIDGETS).toBe(false);
  });

  it('every staff role template has a layout (portal roles get portals instead)', () => {
    const staff = [
      'Company Owner',
      'Director',
      'Project Manager',
      'Planning Engineer',
      'Site Engineer',
      'MEP Engineer',
      'Site Supervisor',
      'Quantity Surveyor',
      'QC Engineer',
      'Safety Officer',
      'Site Storekeeper',
      'Designer',
      'Purchase Manager',
      'Store Manager',
      'Finance',
      'HR',
      'Sales Executive',
    ];
    for (const role of staff) expect([role, (ROLE_LAYOUTS[role] ?? []).length > 0]).toEqual([role, true]);
  });

  it('the owner can see every live widget', () => {
    expect(resolveLayout([{ name: 'Company Owner', dashboardLayout: WIDGETS.map((w) => w.key) }], OWNER).widgets).toHaveLength(
      WIDGETS.length,
    );
  });
});
