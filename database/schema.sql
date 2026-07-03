-- ============================================================
-- BuildFlow ERP — PostgreSQL Schema (v1.0)
-- Multi-tenant (row-level via company_id), UUID PKs, audit-ready
-- Conventions: snake_case, soft delete via deleted_at, money NUMERIC(14,2)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- ---------- 1. TENANCY & IDENTITY ----------
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_name TEXT,
  gstin TEXT, pan TEXT,
  address JSONB,
  plan TEXT NOT NULL DEFAULT 'trial',            -- trial|standard|enterprise
  settings JSONB NOT NULL DEFAULT '{}',          -- currency, fy_start, gst config, numbering series
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL, code TEXT, address JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  branch_id UUID REFERENCES branches(id),
  project_id UUID,                               -- nullable: site stores; FK added after projects
  name TEXT NOT NULL, code TEXT, address JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  branch_id UUID REFERENCES branches(id),
  email CITEXT,
  phone TEXT,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  avatar_file_id UUID,
  mfa_secret TEXT, mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (company_id, email)
);
CREATE INDEX idx_users_company ON users(company_id);

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),      -- NULL = system template role
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

CREATE TABLE permissions (                        -- global catalog: module.resource.action
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,                      -- e.g. crm.leads.read
  module TEXT NOT NULL,
  description TEXT
);

CREATE TABLE role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  user_agent TEXT, ip TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);

-- ---------- 2. SHARED INFRASTRUCTURE ----------
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  uploaded_by UUID REFERENCES users(id),
  storage_key TEXT NOT NULL,                      -- object storage path
  file_name TEXT NOT NULL, mime_type TEXT, size_bytes BIGINT,
  entity_type TEXT, entity_id UUID,               -- polymorphic attachment
  gps_lat NUMERIC(10,7), gps_lng NUMERIC(10,7), captured_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_files_entity ON files(company_id, entity_type, entity_id);

CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  company_id UUID, user_id UUID,
  action TEXT NOT NULL,                           -- create|update|delete|login|approve...
  entity_type TEXT, entity_id TEXT,
  before JSONB, after JSONB,
  ip TEXT, user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_company_time ON audit_logs(company_id, created_at DESC);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL, user_id UUID NOT NULL,
  channel TEXT NOT NULL DEFAULT 'inapp',          -- inapp|email|whatsapp|push
  title TEXT NOT NULL, body TEXT, data JSONB,
  read_at TIMESTAMPTZ, sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user ON notifications(user_id, read_at);

CREATE TABLE approval_requests (                  -- generic approval engine
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  entity_type TEXT NOT NULL, entity_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',         -- pending|approved|rejected|cancelled
  requested_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE approval_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  step_no INT NOT NULL,
  approver_role_id UUID REFERENCES roles(id),
  approver_user_id UUID REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  acted_by UUID, acted_at TIMESTAMPTZ, remarks TEXT
);

-- ---------- 3. CRM ----------
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'individual',  -- individual|business
  gstin TEXT, pan TEXT, email TEXT, phone TEXT, address JSONB,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_customers_company ON customers(company_id);

CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL, designation TEXT, email TEXT, phone TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  branch_id UUID REFERENCES branches(id),
  code TEXT,                                      -- LD-0001 (per-company series)
  title TEXT NOT NULL,
  contact_name TEXT NOT NULL, phone TEXT, email TEXT,
  source TEXT,                                    -- referral|website|walkin|social|other
  segment TEXT,                                   -- interior|civil|commercial|mep|fabrication
  city TEXT,
  estimated_value NUMERIC(14,2),
  status TEXT NOT NULL DEFAULT 'new',             -- new|contacted|site_visit|quotation|negotiation|won|lost
  lost_reason TEXT,
  owner_id UUID REFERENCES users(id),             -- sales executive
  customer_id UUID REFERENCES customers(id),      -- set on conversion
  next_follow_up_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (company_id, code)
);
CREATE INDEX idx_leads_company_status ON leads(company_id, status);
CREATE INDEX idx_leads_owner ON leads(owner_id);

CREATE TABLE lead_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'call',              -- call|meeting|site_visit|email|whatsapp
  summary TEXT NOT NULL,
  outcome TEXT,
  follow_up_at TIMESTAMPTZ NOT NULL,
  done_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_followups_lead ON lead_follow_ups(lead_id);

CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  entity_type TEXT, entity_id UUID,               -- lead|customer|project
  title TEXT NOT NULL, agenda TEXT, location TEXT,
  starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ,
  attendees JSONB,                                -- [{user_id|name,email}]
  minutes TEXT,
  created_by UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  entity_type TEXT NOT NULL, entity_id UUID NOT NULL,
  body TEXT NOT NULL,
  created_by UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- 4. CATALOG / INVENTORY MASTERS ----------
CREATE TABLE uoms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  code TEXT NOT NULL, name TEXT NOT NULL,          -- NOS, KG, SQFT, CUM, BAG...
  UNIQUE (company_id, code)
);

CREATE TABLE item_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  parent_id UUID REFERENCES item_categories(id),
  name TEXT NOT NULL
);

CREATE TABLE items (                               -- materials, consumables, services
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  category_id UUID REFERENCES item_categories(id),
  code TEXT, name TEXT NOT NULL, description TEXT,
  type TEXT NOT NULL DEFAULT 'material',           -- material|service|asset
  uom_id UUID REFERENCES uoms(id),
  hsn_sac TEXT, gst_rate NUMERIC(5,2),
  barcode TEXT, qr_code TEXT,
  min_stock NUMERIC(14,3), reorder_qty NUMERIC(14,3),
  last_purchase_price NUMERIC(14,2), avg_cost NUMERIC(14,2),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (company_id, code)
);
CREATE INDEX idx_items_company ON items(company_id);

-- ---------- 5. SALES: QUOTATION / BOQ / ESTIMATION ----------
CREATE TABLE quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  lead_id UUID REFERENCES leads(id),
  customer_id UUID REFERENCES customers(id),
  code TEXT, version INT NOT NULL DEFAULT 1,
  parent_id UUID REFERENCES quotations(id),        -- version chain
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',            -- draft|sent|approved|rejected|expired|converted
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  discount_amt NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amt NUMERIC(14,2) NOT NULL DEFAULT 0,
  grand_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  valid_until DATE, terms TEXT,
  created_by UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code, version)
);

CREATE TABLE quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  seq INT NOT NULL,
  item_id UUID REFERENCES items(id),
  description TEXT NOT NULL,
  qty NUMERIC(14,3) NOT NULL, uom TEXT,
  rate NUMERIC(14,2) NOT NULL,
  gst_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  amount NUMERIC(14,2) NOT NULL
);

CREATE TABLE boqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  project_id UUID,                                 -- FK added after projects
  quotation_id UUID REFERENCES quotations(id),
  code TEXT, title TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',            -- draft|approved|revised
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',           -- manual|ai_drawing
  created_by UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE boq_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boq_id UUID NOT NULL REFERENCES boqs(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES boq_items(id),         -- section tree
  seq INT NOT NULL, is_section BOOLEAN NOT NULL DEFAULT FALSE,
  item_id UUID REFERENCES items(id),
  description TEXT NOT NULL,
  qty NUMERIC(14,3), uom TEXT,
  rate NUMERIC(14,2), amount NUMERIC(14,2),
  wastage_pct NUMERIC(5,2) NOT NULL DEFAULT 0
);

-- ---------- 6. PROJECTS ----------
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  branch_id UUID REFERENCES branches(id),
  customer_id UUID REFERENCES customers(id),
  boq_id UUID REFERENCES boqs(id),
  code TEXT, name TEXT NOT NULL, type TEXT,        -- interior|civil|commercial|mep|turnkey
  address JSONB, gps_lat NUMERIC(10,7), gps_lng NUMERIC(10,7),
  status TEXT NOT NULL DEFAULT 'planned',          -- planned|active|on_hold|completed|cancelled
  start_date DATE, end_date DATE, actual_end_date DATE,
  contract_value NUMERIC(14,2), budget NUMERIC(14,2),
  progress_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  manager_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (company_id, code)
);
ALTER TABLE warehouses ADD CONSTRAINT fk_wh_project FOREIGN KEY (project_id) REFERENCES projects(id);
ALTER TABLE boqs ADD CONSTRAINT fk_boq_project FOREIGN KEY (project_id) REFERENCES projects(id);

CREATE TABLE project_members (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT,                                       -- pm|site_engineer|client_viewer...
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL, due_date DATE, completed_at TIMESTAMPTZ,
  billing_pct NUMERIC(5,2),                        -- for progress billing
  seq INT NOT NULL DEFAULT 0
);

CREATE TABLE wbs_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES wbs_nodes(id),
  code TEXT, name TEXT NOT NULL, seq INT NOT NULL DEFAULT 0
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  wbs_id UUID REFERENCES wbs_nodes(id),
  milestone_id UUID REFERENCES milestones(id),
  title TEXT NOT NULL, description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',             -- todo|in_progress|blocked|done
  priority TEXT NOT NULL DEFAULT 'medium',
  assignee_id UUID REFERENCES users(id),
  planned_start DATE, planned_end DATE,
  actual_start DATE, actual_end DATE,
  progress_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_project ON tasks(project_id, status);

CREATE TABLE task_dependencies (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'FS',                 -- FS|SS|FF|SF
  PRIMARY KEY (task_id, depends_on_id)
);

CREATE TABLE risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL, category TEXT,
  probability TEXT NOT NULL DEFAULT 'medium',      -- low|medium|high
  impact TEXT NOT NULL DEFAULT 'medium',
  mitigation TEXT, owner_id UUID,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- 7. SITE MANAGEMENT ----------
CREATE TABLE daily_site_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  weather TEXT, manpower_count INT,
  work_done TEXT, work_planned TEXT,
  source TEXT NOT NULL DEFAULT 'manual',           -- manual|ai_generated
  gps_lat NUMERIC(10,7), gps_lng NUMERIC(10,7),
  submitted_by UUID REFERENCES users(id),
  submitted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft',            -- draft|submitted|approved
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, report_date)
);

CREATE TABLE site_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id),
  person_type TEXT NOT NULL,                       -- employee|labour|contractor
  person_id UUID NOT NULL,                         -- employees.id or labour.id
  att_date DATE NOT NULL,
  check_in TIMESTAMPTZ, check_out TIMESTAMPTZ,
  gps_lat NUMERIC(10,7), gps_lng NUMERIC(10,7),
  hours NUMERIC(5,2), overtime_hours NUMERIC(5,2) NOT NULL DEFAULT 0,
  marked_by UUID,
  UNIQUE (project_id, person_type, person_id, att_date)
);

CREATE TABLE site_visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL, project_id UUID NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL, purpose TEXT, phone TEXT,
  in_at TIMESTAMPTZ NOT NULL, out_at TIMESTAMPTZ,
  logged_by UUID
);

CREATE TABLE site_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL, project_id UUID NOT NULL REFERENCES projects(id),
  type TEXT NOT NULL DEFAULT 'issue',              -- issue|delay|safety|quality
  title TEXT NOT NULL, description TEXT,
  severity TEXT NOT NULL DEFAULT 'medium',
  delay_days INT,                                  -- when type=delay
  status TEXT NOT NULL DEFAULT 'open',             -- open|in_progress|resolved
  raised_by UUID, assigned_to UUID, resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL, project_id UUID NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL, checklist JSONB,            -- [{item, ok, remarks}]
  result TEXT,                                     -- passed|failed|conditional
  inspected_by UUID, inspected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- 8. MRP / PROCUREMENT ----------
CREATE TABLE material_requirements (               -- derived from BOQ (MRP output)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id),
  boq_item_id UUID REFERENCES boq_items(id),
  item_id UUID NOT NULL REFERENCES items(id),
  required_qty NUMERIC(14,3) NOT NULL,
  wastage_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
  requested_qty NUMERIC(14,3) NOT NULL DEFAULT 0,  -- via MRs
  received_qty NUMERIC(14,3) NOT NULL DEFAULT 0,   -- via GRNs
  consumed_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
  needed_by DATE
);

CREATE TABLE material_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id),
  code TEXT, status TEXT NOT NULL DEFAULT 'draft', -- draft|submitted|approved|rejected|fulfilled
  needed_by DATE, remarks TEXT,
  requested_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);
CREATE TABLE material_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES material_requests(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id),
  qty NUMERIC(14,3) NOT NULL, fulfilled_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
  remarks TEXT
);

CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL, code TEXT,
  gstin TEXT, pan TEXT,
  email TEXT, phone TEXT, address JSONB,
  categories TEXT[],                               -- material categories supplied
  payment_terms TEXT, credit_days INT,
  rating NUMERIC(3,2),                             -- rolling avg of vendor_ratings
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (company_id, code)
);
CREATE TABLE vendor_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  account_name TEXT, account_no TEXT, ifsc TEXT, bank_name TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE vendor_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  title TEXT NOT NULL, start_date DATE, end_date DATE,
  value NUMERIC(14,2), file_id UUID REFERENCES files(id),
  status TEXT NOT NULL DEFAULT 'active'
);
CREATE TABLE vendor_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  po_id UUID,                                      -- rated against a PO
  quality INT, delivery INT, pricing INT,          -- 1..5
  remarks TEXT, rated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rfqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  material_request_id UUID REFERENCES material_requests(id),
  code TEXT, due_date DATE,
  status TEXT NOT NULL DEFAULT 'open',             -- open|closed|awarded
  created_by UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);
CREATE TABLE rfq_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id),
  qty NUMERIC(14,3) NOT NULL
);
CREATE TABLE rfq_quotes (                           -- vendor responses; comparison grid
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  received_at TIMESTAMPTZ, valid_until DATE, remarks TEXT,
  is_selected BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE rfq_quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES rfq_quotes(id) ON DELETE CASCADE,
  rfq_item_id UUID NOT NULL REFERENCES rfq_items(id),
  rate NUMERIC(14,2) NOT NULL, gst_rate NUMERIC(5,2), lead_time_days INT
);

CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  project_id UUID REFERENCES projects(id),
  warehouse_id UUID REFERENCES warehouses(id),     -- deliver-to
  rfq_id UUID REFERENCES rfqs(id),
  code TEXT, status TEXT NOT NULL DEFAULT 'draft', -- draft|pending_approval|approved|sent|partially_received|received|closed|cancelled
  order_date DATE NOT NULL DEFAULT CURRENT_DATE, expected_date DATE,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amt NUMERIC(14,2) NOT NULL DEFAULT 0,
  grand_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  terms TEXT, created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);
CREATE INDEX idx_po_company_status ON purchase_orders(company_id, status);
CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id),
  qty NUMERIC(14,3) NOT NULL, received_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
  rate NUMERIC(14,2) NOT NULL, gst_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  amount NUMERIC(14,2) NOT NULL
);

CREATE TABLE goods_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  po_id UUID NOT NULL REFERENCES purchase_orders(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  code TEXT, received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vehicle_no TEXT, invoice_no TEXT, remarks TEXT,
  received_by UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);
CREATE TABLE goods_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  po_item_id UUID NOT NULL REFERENCES purchase_order_items(id),
  accepted_qty NUMERIC(14,3) NOT NULL,
  rejected_qty NUMERIC(14,3) NOT NULL DEFAULT 0, rejection_reason TEXT
);

CREATE TABLE vendor_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  po_id UUID REFERENCES purchase_orders(id),
  grn_id UUID REFERENCES goods_receipts(id),
  invoice_no TEXT NOT NULL, invoice_date DATE NOT NULL,
  subtotal NUMERIC(14,2), tax_amt NUMERIC(14,2), total NUMERIC(14,2) NOT NULL,
  match_status TEXT NOT NULL DEFAULT 'unmatched',  -- unmatched|matched|mismatch (3-way)
  payment_status TEXT NOT NULL DEFAULT 'unpaid',   -- unpaid|partial|paid
  due_date DATE, file_id UUID REFERENCES files(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- 9. INVENTORY ----------
CREATE TABLE stock_ledger (                         -- immutable movement log
  id BIGSERIAL PRIMARY KEY,
  company_id UUID NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  item_id UUID NOT NULL REFERENCES items(id),
  project_id UUID REFERENCES projects(id),
  txn_type TEXT NOT NULL,                           -- grn|issue|transfer_in|transfer_out|return|adjustment
  ref_type TEXT, ref_id UUID,
  qty NUMERIC(14,3) NOT NULL,                       -- +in / -out
  rate NUMERIC(14,2),
  created_by UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ledger_wh_item ON stock_ledger(warehouse_id, item_id);

CREATE TABLE stock_balances (                       -- materialized current stock
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  item_id UUID NOT NULL REFERENCES items(id),
  company_id UUID NOT NULL,
  qty NUMERIC(14,3) NOT NULL DEFAULT 0,
  reserved_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (warehouse_id, item_id)
);

CREATE TABLE stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  from_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  to_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  code TEXT, status TEXT NOT NULL DEFAULT 'draft',  -- draft|in_transit|received|cancelled
  created_by UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_at TIMESTAMPTZ,
  UNIQUE (company_id, code)
);
CREATE TABLE stock_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id),
  qty NUMERIC(14,3) NOT NULL
);

CREATE TABLE stock_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  item_id UUID NOT NULL REFERENCES items(id),
  project_id UUID REFERENCES projects(id),
  qty NUMERIC(14,3) NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',            -- active|released|consumed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stock_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  code TEXT, status TEXT NOT NULL DEFAULT 'open',   -- open|completed
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(), completed_at TIMESTAMPTZ,
  created_by UUID
);
CREATE TABLE stock_audit_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES stock_audits(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id),
  system_qty NUMERIC(14,3) NOT NULL,
  counted_qty NUMERIC(14,3),
  variance NUMERIC(14,3)
);

-- ---------- 10. ASSETS ----------
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  code TEXT, name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'tool',                -- tool|vehicle|machinery
  purchase_date DATE, purchase_cost NUMERIC(14,2),
  depreciation_method TEXT DEFAULT 'slm',           -- slm|wdv
  depreciation_rate NUMERIC(5,2),
  current_value NUMERIC(14,2),
  status TEXT NOT NULL DEFAULT 'available',          -- available|assigned|maintenance|scrapped
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);
CREATE TABLE asset_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  project_id UUID REFERENCES projects(id),
  assigned_to UUID REFERENCES users(id),
  from_date DATE NOT NULL, to_date DATE,
  returned_at TIMESTAMPTZ
);
CREATE TABLE asset_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  type TEXT NOT NULL DEFAULT 'repair',               -- service|repair|inspection
  scheduled_date DATE, done_date DATE,
  cost NUMERIC(14,2), remarks TEXT
);

-- ---------- 11. WORKFORCE ----------
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  user_id UUID REFERENCES users(id),                 -- nullable: not all employees log in
  emp_code TEXT, full_name TEXT NOT NULL,
  designation TEXT, department TEXT,
  phone TEXT, email TEXT,
  join_date DATE, exit_date DATE,
  salary_type TEXT NOT NULL DEFAULT 'monthly',       -- monthly|daily|hourly
  salary_rate NUMERIC(14,2),
  bank JSONB, pf_uan TEXT, esi_no TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (company_id, emp_code)
);

CREATE TABLE labour (                                 -- daily-wage / contractor labour
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  contractor_vendor_id UUID REFERENCES vendors(id),   -- labour contractor
  name TEXT NOT NULL, skill TEXT,                     -- mason|carpenter|electrician|helper...
  daily_rate NUMERIC(14,2), phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  employee_id UUID NOT NULL REFERENCES employees(id),
  type TEXT NOT NULL DEFAULT 'casual',
  from_date DATE NOT NULL, to_date DATE NOT NULL,
  reason TEXT, status TEXT NOT NULL DEFAULT 'pending',
  approved_by UUID, acted_at TIMESTAMPTZ
);

CREATE TABLE payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  period_month INT NOT NULL, period_year INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',               -- draft|processed|paid
  processed_at TIMESTAMPTZ, created_by UUID,
  UNIQUE (company_id, period_month, period_year)
);
CREATE TABLE payroll_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  days_present NUMERIC(5,2), gross NUMERIC(14,2),
  deductions NUMERIC(14,2) NOT NULL DEFAULT 0,
  net NUMERIC(14,2), breakup JSONB
);

-- ---------- 12. FINANCE / INVOICING / COSTING ----------
CREATE TABLE cost_codes (                             -- costing dimensions
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  code TEXT NOT NULL, name TEXT NOT NULL,             -- MAT|LAB|EQP|SUB|OH
  UNIQUE (company_id, code)
);

CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id),
  version INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE budget_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  cost_code_id UUID REFERENCES cost_codes(id),
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL
);

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  project_id UUID REFERENCES projects(id),
  cost_code_id UUID REFERENCES cost_codes(id),
  category TEXT, description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL, gst_amt NUMERIC(14,2) NOT NULL DEFAULT 0,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  paid_via TEXT,                                      -- cash|bank|upi|card
  vendor_id UUID REFERENCES vendors(id),
  file_id UUID REFERENCES files(id),                  -- bill photo
  status TEXT NOT NULL DEFAULT 'pending',             -- pending|approved|rejected
  created_by UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_project ON expenses(project_id);

CREATE TABLE client_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  milestone_id UUID REFERENCES milestones(id),
  code TEXT, type TEXT NOT NULL DEFAULT 'progress',   -- advance|progress|final|credit_note|debit_note
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE, due_date DATE,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  cgst NUMERIC(14,2) NOT NULL DEFAULT 0, sgst NUMERIC(14,2) NOT NULL DEFAULT 0, igst NUMERIC(14,2) NOT NULL DEFAULT 0,
  tds_amt NUMERIC(14,2) NOT NULL DEFAULT 0,
  retention_amt NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_amt NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',               -- draft|sent|partially_paid|paid|overdue|void
  notes TEXT, created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);
CREATE TABLE client_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES client_invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  qty NUMERIC(14,3), uom TEXT, rate NUMERIC(14,2),
  gst_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  amount NUMERIC(14,2) NOT NULL
);

CREATE TABLE payments (                               -- AR receipts + AP payments
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  direction TEXT NOT NULL,                            -- in (from client) | out (to vendor/payroll)
  ref_type TEXT NOT NULL,                             -- client_invoice|vendor_invoice|payroll|expense|advance
  ref_id UUID,
  party_type TEXT, party_id UUID,
  amount NUMERIC(14,2) NOT NULL,
  method TEXT,                                        -- neft|upi|cheque|cash
  bank_account_id UUID,
  txn_ref TEXT, paid_on DATE NOT NULL DEFAULT CURRENT_DATE,
  tds_amt NUMERIC(14,2) NOT NULL DEFAULT 0,
  remarks TEXT, created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  name TEXT NOT NULL, account_no TEXT, ifsc TEXT, bank_name TEXT,
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0
);
CREATE TABLE bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  txn_date DATE NOT NULL, description TEXT,
  amount NUMERIC(14,2) NOT NULL,                      -- +credit / -debit
  matched_payment_id UUID REFERENCES payments(id),    -- reconciliation link
  reconciled_at TIMESTAMPTZ,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tds_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  payment_id UUID REFERENCES payments(id),
  section TEXT,                                       -- 194C|194J...
  base_amount NUMERIC(14,2), tds_amount NUMERIC(14,2),
  deducted_on DATE, deposited_on DATE, challan_no TEXT
);

-- Project costing rollup view
CREATE VIEW v_project_costing AS
SELECT p.id AS project_id, p.company_id, p.name, p.contract_value, p.budget,
  COALESCE(mat.cost,0) AS material_cost,
  COALESCE(exp.cost,0) AS expense_cost,
  COALESCE(mat.cost,0)+COALESCE(exp.cost,0) AS actual_cost,
  p.budget - (COALESCE(mat.cost,0)+COALESCE(exp.cost,0)) AS variance,
  COALESCE(inv.billed,0) AS billed,
  COALESCE(inv.billed,0) - (COALESCE(mat.cost,0)+COALESCE(exp.cost,0)) AS gross_profit
FROM projects p
LEFT JOIN (SELECT project_id, SUM(-qty*COALESCE(rate,0)) AS cost FROM stock_ledger WHERE txn_type='issue' GROUP BY project_id) mat ON mat.project_id=p.id
LEFT JOIN (SELECT project_id, SUM(amount) AS cost FROM expenses WHERE status='approved' GROUP BY project_id) exp ON exp.project_id=p.id
LEFT JOIN (SELECT project_id, SUM(total) AS billed FROM client_invoices WHERE status NOT IN ('draft','void') GROUP BY project_id) inv ON inv.project_id=p.id
WHERE p.deleted_at IS NULL;

-- ---------- 13. AI ----------
CREATE TABLE ai_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  type TEXT NOT NULL,                                 -- boq_from_drawing|material_plan|delay_prediction|cost_prediction|site_report|nlq
  status TEXT NOT NULL DEFAULT 'queued',              -- queued|running|done|failed
  input JSONB, output JSONB, error TEXT,
  entity_type TEXT, entity_id UUID,
  requested_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE ai_predictions (                          -- delay/cost snapshots per project
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id),
  kind TEXT NOT NULL,                                  -- delay|cost_overrun
  predicted_value NUMERIC(14,2),                       -- days or amount
  confidence NUMERIC(4,3),
  factors JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- SEED: permissions catalog + system roles (excerpt; full seed in seed.sql) ----------
