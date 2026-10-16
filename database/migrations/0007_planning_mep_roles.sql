-- Planning Engineer and MEP Engineer roles (docs/ROLES.md).
--  * projects.schedule.manage separates building / re-planning the schedule (planning, PM) from
--    updating task progress (projects.tasks.manage, which site and MEP engineers hold).
--  * Both new roles see only their assigned projects.

INSERT INTO permissions (code, module, description) VALUES
  ('projects.schedule.manage', 'projects', 'Build and re-plan the schedule: WBS, durations, dependencies, baselines, look-ahead plans');

CREATE TEMP TABLE role_defs (name TEXT PRIMARY KEY, description TEXT, data_scope TEXT, perms TEXT[]) ON COMMIT DROP;
INSERT INTO role_defs VALUES
('Planning Engineer', 'Builds and maintains project schedules, baselines and look-ahead plans; tracks progress, delays and resource / material needs', 'assigned_projects', ARRAY[
  'projects.read','projects.schedule.manage','projects.tasks.manage','projects.risks.manage',
  'sales.boq.read','drawings.read','site.reports.read',
  'procurement.mr.manage','inventory.read','reports.read','ai.use']),
('MEP Engineer', 'Electrical, plumbing, HVAC and fire-fighting services: coordination, execution, MEP subcontractors, testing and commissioning', 'assigned_projects', ARRAY[
  'projects.read','projects.tasks.manage','drawings.read','drawings.manage',
  'site.reports.read','site.reports.submit','site.issues.manage','site.measurements.record','site.labour.manage',
  'procurement.mr.manage','inventory.read',
  'quality.inspections.request','quality.inspections.perform','quality.snags.manage',
  'safety.permits.request','safety.incidents.report']);

-- Templates, then every existing company.
INSERT INTO roles (company_id, name, description, is_system, data_scope)
SELECT NULL, d.name, d.description, TRUE, d.data_scope FROM role_defs d
WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.company_id IS NULL AND r.name = d.name);

INSERT INTO roles (company_id, name, description, is_system, data_scope)
SELECT c.id, d.name, d.description, FALSE, d.data_scope FROM companies c CROSS JOIN role_defs d
WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.company_id = c.id AND r.name = d.name);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r JOIN role_defs d ON d.name = r.name
CROSS JOIN LATERAL unnest(d.perms) AS u(perm_code)
JOIN permissions p ON p.code = u.perm_code
ON CONFLICT DO NOTHING;

-- Project Managers also own the schedule.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'projects.schedule.manage'
WHERE r.name = 'Project Manager'
ON CONFLICT DO NOTHING;

-- Company Owner keeps every non-portal permission, including ones added by later migrations.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.module <> 'portal'
WHERE r.name = 'Company Owner'
ON CONFLICT DO NOTHING;
