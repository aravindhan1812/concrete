-- Roles built around real construction responsibilities (docs/ROLES.md).
--  * roles.data_scope: which records a role sees —
--      company            everything in the company (owner, finance, purchase, HR…)
--      assigned_projects  only projects the user is a member of (PM, site engineer, supervisor, QS, QC…)
--      own_records        only records linked to the login's client / vendor (portal roles)
--  * vendors.vendor_type: suppliers, subcontractors and labour contractors behave differently.
--  * New permission codes for site, labour, quality, safety, drawings, billing and subcontracting.
--  * Template roles are (re)defined here in one place and synced to every company.
--    Pre-launch: this overwrites the permission sets of existing companies' cloned template roles.

ALTER TABLE roles ADD COLUMN data_scope TEXT NOT NULL DEFAULT 'company'
  CHECK (data_scope IN ('company', 'assigned_projects', 'own_records'));

ALTER TABLE vendors ADD COLUMN vendor_type TEXT NOT NULL DEFAULT 'supplier'
  CHECK (vendor_type IN ('supplier', 'subcontractor', 'labour_contractor', 'equipment_hire', 'service_provider'));

-- Members carry their responsibility on the project (pm, site_engineer, supervisor, qs, qc, safety, storekeeper, designer).
CREATE INDEX project_members_user_idx ON project_members (user_id);

-- ---------- New permission codes ----------
INSERT INTO permissions (code, module, description) VALUES
  ('drawings.read',              'drawings',    'View drawings and revisions'),
  ('drawings.manage',            'drawings',    'Upload drawings, issue revisions and transmittals'),
  ('drawings.approve',           'drawings',    'Approve drawings for construction'),
  ('site.measurements.record',   'site',        'Record work-done quantities against BOQ items'),
  ('site.measurements.verify',   'site',        'Verify / certify measurements'),
  ('site.labour.manage',         'site',        'Allocate labour gangs and manage the site labour register'),
  ('labour.wages.manage',        'labour',      'Prepare labour wage sheets from attendance'),
  ('labour.wages.approve',       'labour',      'Approve labour wage sheets and contractor labour bills'),
  ('billing.ra.prepare',         'billing',     'Prepare client running-account (RA) bills from measurements'),
  ('billing.ra.approve',         'billing',     'Approve client RA bills for invoicing'),
  ('subcontract.wo.manage',      'subcontract', 'Create and manage subcontractor work orders'),
  ('subcontract.bills.verify',   'subcontract', 'Verify subcontractor RA bills against measurements'),
  ('subcontract.bills.approve',  'subcontract', 'Approve subcontractor RA bills for payment'),
  ('procurement.mr.approve',     'procurement', 'Approve material requests'),
  ('inventory.issue',            'inventory',   'Issue material from store to work / project'),
  ('inventory.transfer',         'inventory',   'Transfer stock between stores and sites'),
  ('quality.inspections.request','quality',     'Request inspections'),
  ('quality.inspections.perform','quality',     'Carry out inspections and material tests'),
  ('quality.ncr.manage',         'quality',     'Raise and close non-conformance reports'),
  ('quality.snags.manage',       'quality',     'Raise, assign and close snags'),
  ('safety.permits.request',     'safety',      'Request permits to work'),
  ('safety.permits.approve',     'safety',      'Approve and close permits to work'),
  ('safety.incidents.report',    'safety',      'Report incidents and near-misses'),
  ('safety.manage',              'safety',      'Toolbox talks, inductions, safety audits, PPE register'),
  ('portal.subcontract',         'portal',      'Subcontractor portal: work orders, measurements, RA bills'),
  ('portal.labour',              'portal',      'Labour contractor portal: own labour, attendance, wage bills');

-- ---------- Role catalogue ----------
CREATE TEMP TABLE role_defs (name TEXT PRIMARY KEY, description TEXT, data_scope TEXT, perms TEXT[]) ON COMMIT DROP;

INSERT INTO role_defs VALUES
-- Management
('Company Owner', 'Full access; final approval authority', 'company', NULL),          -- NULL = every non-portal permission
('Director', 'Company-wide visibility and high-value approvals', 'company', NULL),   -- computed below: all read + approve
-- Project delivery
('Project Manager', 'Runs assigned projects: plan, budget, approvals, client coordination, billing sign-off', 'assigned_projects', ARRAY[
  'projects.read','projects.manage','projects.tasks.manage','projects.risks.manage',
  'crm.clients.read','sales.quotations.read','sales.boq.read',
  'drawings.read','drawings.approve',
  'site.reports.read','site.issues.manage','site.measurements.verify',
  'procurement.mr.manage','procurement.mr.approve','inventory.read','vendors.read',
  'subcontract.wo.manage','subcontract.bills.approve','labour.wages.approve','billing.ra.approve',
  'quality.ncr.manage','safety.permits.approve',
  'finance.expenses.manage','finance.expenses.approve','approvals.read','reports.read','ai.use']),
('Site Engineer', 'Executes work on assigned sites: daily reports, measurements, labour, materials, quality and safety on site', 'assigned_projects', ARRAY[
  'projects.read','projects.tasks.manage','drawings.read',
  'site.reports.read','site.reports.submit','site.attendance.mark','site.issues.manage','site.measurements.record','site.labour.manage',
  'procurement.mr.manage','inventory.read','inventory.issue',
  'quality.inspections.request','quality.snags.manage','safety.permits.request','safety.incidents.report',
  'finance.expenses.manage','ai.use']),
('Site Supervisor', 'Foreman on site (phone): labour gangs, attendance, progress photos, issues, material needs', 'assigned_projects', ARRAY[
  'projects.read','drawings.read',
  'site.reports.read','site.reports.submit','site.attendance.mark','site.issues.manage','site.labour.manage',
  'procurement.mr.manage','inventory.read','safety.incidents.report']),
('Quantity Surveyor', 'Billing engineer: BOQ and rates, measurement checks, client RA bills, subcontractor bill verification', 'assigned_projects', ARRAY[
  'projects.read','crm.clients.read','sales.quotations.read','sales.boq.read','sales.boq.manage','drawings.read',
  'site.reports.read','site.measurements.verify','billing.ra.prepare',
  'subcontract.wo.manage','subcontract.bills.verify','vendors.read','reports.read']),
('QC Engineer', 'Inspections and test plans, material tests, NCRs, snagging and handover quality', 'assigned_projects', ARRAY[
  'projects.read','drawings.read','site.reports.read','site.issues.manage','inventory.read',
  'quality.inspections.request','quality.inspections.perform','quality.ncr.manage','quality.snags.manage']),
('Safety Officer', 'Permits to work, inductions and toolbox talks, incidents, safety audits, PPE', 'assigned_projects', ARRAY[
  'projects.read','site.reports.read','site.issues.manage',
  'safety.permits.request','safety.permits.approve','safety.incidents.report','safety.manage']),
('Designer', 'Architect / interior designer: drawings, revisions, client selections', 'assigned_projects', ARRAY[
  'projects.read','crm.clients.read','sales.boq.read','drawings.read','drawings.manage']),
-- Supply chain
('Purchase Manager', 'Vendors, RFQs and comparison, purchase orders, rate contracts', 'company', ARRAY[
  'vendors.read','vendors.manage','procurement.mr.manage','procurement.rfq.manage','procurement.po.manage',
  'inventory.read','projects.read','reports.read']),
('Store Manager', 'Central stores: receipts, stock, transfers, tools and assets', 'company', ARRAY[
  'inventory.read','inventory.manage','inventory.issue','inventory.transfer','procurement.grn.manage',
  'assets.read','assets.manage','vendors.read','projects.read']),
('Site Storekeeper', 'Site store: receive material, issue to work, transfers, tools on site', 'assigned_projects', ARRAY[
  'projects.read','inventory.read','inventory.issue','inventory.transfer','procurement.grn.manage',
  'procurement.mr.manage','assets.read']),
-- Back office
('Finance', 'Accounts: invoicing, payments, expenses, ledger, GST/TDS, reports', 'company', ARRAY[
  'finance.expenses.manage','finance.expenses.approve','finance.invoices.manage','finance.payments.manage','finance.reports.read',
  'finance.ledger.read','finance.ledger.post','finance.ledger.manage',
  'vendors.read','crm.clients.read','projects.read','approvals.read','reports.read']),
('HR', 'Employees, labour register, attendance, wages, leave and payroll', 'company', ARRAY[
  'hr.employees.manage','hr.payroll.manage','hr.leave.approve','labour.wages.manage','site.reports.read','projects.read']),
('Sales Executive', 'Leads, clients and quotations', 'company', ARRAY[
  'crm.leads.read','crm.leads.create','crm.leads.update','crm.clients.read','crm.clients.manage',
  'sales.quotations.read','sales.quotations.manage','reports.read']),
-- External (portal) roles
('Client', 'Client portal: own projects, approvals, invoices, snags', 'own_records', ARRAY['portal.client']),
('Vendor', 'Supplier portal: own POs, deliveries, invoices, payments', 'own_records', ARRAY['portal.vendor']),
('Subcontractor', 'Subcontractor portal: own work orders, measurements, RA bills, payments', 'own_records', ARRAY['portal.vendor','portal.subcontract']),
('Labour Contractor', 'Labour contractor portal: own labour, attendance, wage bills, payments', 'own_records', ARRAY['portal.vendor','portal.labour']);

-- Owner: every permission except portal ones. Director: every read / approve permission plus reporting.
UPDATE role_defs SET perms = (SELECT array_agg(code) FROM permissions WHERE module <> 'portal') WHERE name = 'Company Owner';
UPDATE role_defs SET perms = (
  SELECT array_agg(code) FROM permissions
  WHERE module <> 'portal' AND (code LIKE '%.read' OR code LIKE '%.approve' OR code IN ('reports.read','ai.use','finance.reports.read'))
) WHERE name = 'Director';

-- Templates: create missing ones, refresh description and scope on all.
INSERT INTO roles (company_id, name, description, is_system, data_scope)
SELECT NULL, d.name, d.description, TRUE, d.data_scope FROM role_defs d
WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.company_id IS NULL AND r.name = d.name);

-- Every existing company gets the new template roles too.
INSERT INTO roles (company_id, name, description, is_system, data_scope)
SELECT c.id, d.name, d.description, FALSE, d.data_scope FROM companies c CROSS JOIN role_defs d
WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.company_id = c.id AND r.name = d.name);

UPDATE roles r SET description = d.description, data_scope = d.data_scope FROM role_defs d WHERE r.name = d.name;

-- Permission sets: templates and same-named company roles follow the catalogue.
DELETE FROM role_permissions rp USING roles r, role_defs d WHERE rp.role_id = r.id AND r.name = d.name;
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r JOIN role_defs d ON d.name = r.name
CROSS JOIN LATERAL unnest(d.perms) AS u(perm_code)
JOIN permissions p ON p.code = u.perm_code
ON CONFLICT DO NOTHING;
