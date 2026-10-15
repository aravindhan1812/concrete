-- Concrete ERP — Seed: permission catalog + system role templates
INSERT INTO permissions (code, module, description) VALUES
-- CRM
('crm.leads.read','crm','View leads'),('crm.leads.create','crm','Create leads'),
('crm.leads.update','crm','Edit leads'),('crm.leads.delete','crm','Delete leads'),
('crm.customers.read','crm','View customers'),('crm.customers.manage','crm','Manage customers'),
-- Sales
('sales.quotations.read','sales','View quotations'),('sales.quotations.manage','sales','Manage quotations'),
('sales.quotations.approve','sales','Approve quotations'),
('sales.boq.read','sales','View BOQ'),('sales.boq.manage','sales','Manage BOQ'),
-- Projects
('projects.read','projects','View projects'),('projects.manage','projects','Manage projects'),
('projects.tasks.manage','projects','Manage tasks'),('projects.risks.manage','projects','Manage risks'),
-- Site
('site.reports.read','site','View site reports'),('site.reports.submit','site','Submit site reports'),
('site.attendance.mark','site','Mark attendance'),('site.issues.manage','site','Manage issues'),
-- Procurement
('procurement.mr.manage','procurement','Manage material requests'),
('procurement.rfq.manage','procurement','Manage RFQs'),
('procurement.po.manage','procurement','Manage POs'),('procurement.po.approve','procurement','Approve POs'),
('procurement.grn.manage','procurement','Post goods receipts'),
-- Vendors / Inventory / Assets
('vendors.read','vendors','View vendors'),('vendors.manage','vendors','Manage vendors'),
('inventory.read','inventory','View stock'),('inventory.manage','inventory','Stock operations'),
('assets.read','assets','View assets'),('assets.manage','assets','Manage assets'),
-- Workforce / Finance
('hr.employees.manage','hr','Manage employees'),('hr.payroll.manage','hr','Run payroll'),('hr.leave.approve','hr','Approve leave'),
('finance.expenses.manage','finance','Record expenses'),('finance.expenses.approve','finance','Approve expenses'),
('finance.invoices.manage','finance','Manage client invoices'),
('finance.payments.manage','finance','Record payments'),
('finance.reports.read','finance','View financial reports'),
-- Admin
('admin.users.manage','admin','Manage users'),('admin.roles.manage','admin','Manage roles & permissions'),
('admin.settings.manage','admin','Company settings'),('admin.audit.read','admin','View audit logs'),
-- AI / Reports
('ai.use','ai','Use AI features'),('reports.read','reports','View reports & dashboards');

-- System role templates (company_id NULL). Cloned into each new company at signup.
INSERT INTO roles (name, description, is_system) VALUES
('Company Owner','Full access', TRUE),
('Director','Full read + approvals', TRUE),
('Project Manager','Projects, site, procurement requests', TRUE),
('Site Engineer','Site ops and material requests', TRUE),
('Purchase Manager','Procurement and vendors', TRUE),
('Store Manager','Inventory and GRN', TRUE),
('Finance','Finance, invoicing, payroll view', TRUE),
('HR','Workforce and payroll', TRUE),
('Sales Executive','CRM and quotations', TRUE),
('Client','Own project portal view', TRUE),
('Vendor','Own POs and invoices', TRUE);

-- Owner template gets everything
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.is_system AND r.name = 'Company Owner';

-- Sales Executive
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN
('crm.leads.read','crm.leads.create','crm.leads.update','crm.customers.read','crm.customers.manage',
 'sales.quotations.read','sales.quotations.manage','reports.read')
WHERE r.is_system AND r.name = 'Sales Executive';

-- Site Engineer
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN
('projects.read','site.reports.read','site.reports.submit','site.attendance.mark','site.issues.manage',
 'procurement.mr.manage','inventory.read')
WHERE r.is_system AND r.name = 'Site Engineer';

-- Purchase Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN
('procurement.mr.manage','procurement.rfq.manage','procurement.po.manage','vendors.read','vendors.manage',
 'inventory.read','reports.read')
WHERE r.is_system AND r.name = 'Purchase Manager';

-- Project Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN
('projects.read','projects.manage','projects.tasks.manage','projects.risks.manage',
 'site.reports.read','site.issues.manage','procurement.mr.manage','sales.boq.read',
 'inventory.read','finance.expenses.manage','reports.read','ai.use')
WHERE r.is_system AND r.name = 'Project Manager';

-- Store Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN
('inventory.read','inventory.manage','procurement.grn.manage','assets.read','assets.manage')
WHERE r.is_system AND r.name = 'Store Manager';

-- Finance
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN
('finance.expenses.manage','finance.expenses.approve','finance.invoices.manage','finance.payments.manage',
 'finance.reports.read','reports.read','vendors.read')
WHERE r.is_system AND r.name = 'Finance';

-- HR
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN
('hr.employees.manage','hr.payroll.manage','hr.leave.approve')
WHERE r.is_system AND r.name = 'HR';
