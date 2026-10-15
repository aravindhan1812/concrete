-- Shared backend services (SCOPE.md §3, backlog P0.5):
-- document numbering, approval rules, file lifecycle, comments, notification indexes.

-- ---------- Document numbering ----------
-- One series per document type per company. The pattern supports {PREFIX}, {FY}, {YYYY}, {MM},
-- {BRANCH} and {SEQ:n} (zero-padded to n digits). Counters live in number_sequences keyed by the
-- period the series resets on ('' for never, the FY name for yearly).
CREATE TABLE numbering_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  doc_type TEXT NOT NULL,                           -- lead|quotation|project|po|grn|client_invoice|...
  prefix TEXT NOT NULL,
  pattern TEXT NOT NULL DEFAULT '{PREFIX}/{FY}/{SEQ:4}',
  reset TEXT NOT NULL DEFAULT 'yearly' CHECK (reset IN ('yearly','never')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, doc_type)
);

CREATE TABLE number_sequences (
  series_id UUID NOT NULL REFERENCES numbering_series(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,                         -- '' (never) or FY name, e.g. 2026-27
  branch_id UUID,                                   -- reserved for per-branch series
  next_no INT NOT NULL DEFAULT 1,
  PRIMARY KEY (series_id, period_key)
);

-- ---------- Approval engine ----------
-- Rules: for an entity type and amount band, which role approves at which step.
-- A request picks every rule whose band contains the amount, ordered by step_no.
CREATE TABLE approval_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  entity_type TEXT NOT NULL,                        -- purchase_order|quotation|expense|leave|permit|change_order|journal_entry
  step_no INT NOT NULL CHECK (step_no >= 1),
  approver_role_id UUID NOT NULL REFERENCES roles(id),
  min_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  max_amount NUMERIC(14,2),                         -- NULL = no upper bound
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (max_amount IS NULL OR max_amount >= min_amount)
);
CREATE INDEX approval_rules_lookup_idx ON approval_rules (company_id, entity_type) WHERE is_active;

ALTER TABLE approval_requests
  ADD COLUMN title TEXT,
  ADD COLUMN amount NUMERIC(14,2),
  ADD COLUMN current_step INT,
  ADD COLUMN decided_at TIMESTAMPTZ;
CREATE INDEX approval_requests_entity_idx ON approval_requests (company_id, entity_type, entity_id);
CREATE INDEX approval_requests_status_idx ON approval_requests (company_id, status);
ALTER TABLE approval_steps ADD COLUMN company_id UUID;
CREATE INDEX approval_steps_pending_idx ON approval_steps (company_id, status, approver_role_id);

-- ---------- Files ----------
-- Uploads go straight from the browser to object storage with a presigned URL; the row is created
-- as 'pending' and becomes 'ready' once the API confirms the object exists.
ALTER TABLE files
  ADD COLUMN status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('pending','ready','deleted')),
  ADD COLUMN deleted_at TIMESTAMPTZ;
CREATE INDEX files_entity_idx ON files (company_id, entity_type, entity_id) WHERE status = 'ready';

-- ---------- Comments ----------
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  parent_id UUID REFERENCES comments(id),
  author_id UUID NOT NULL REFERENCES users(id),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 10000),
  mentions UUID[] NOT NULL DEFAULT '{}',
  shared_with_client BOOLEAN NOT NULL DEFAULT FALSE,
  shared_with_vendor BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);
CREATE INDEX comments_entity_idx ON comments (company_id, entity_type, entity_id, created_at);

-- ---------- Notifications ----------
CREATE INDEX notifications_user_unread_idx ON notifications (user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);

-- ---------- Permissions ----------
INSERT INTO permissions (code, module, description) VALUES
  ('approvals.read', 'approvals', 'View approval requests across the company'),
  ('approvals.rules.manage', 'approvals', 'Configure approval rules and thresholds');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('approvals.read','approvals.rules.manage')
WHERE r.name = 'Company Owner'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'approvals.read'
WHERE r.name IN ('Director', 'Finance', 'Project Manager')
ON CONFLICT DO NOTHING;

-- ---------- Carry existing lead codes over to the numbering service ----------
-- Leads used LD-0001… counted per company; seed each company's series so numbering continues.
INSERT INTO numbering_series (company_id, doc_type, prefix, pattern, reset)
SELECT id, 'lead', 'LD', '{PREFIX}-{SEQ:4}', 'never' FROM companies
ON CONFLICT (company_id, doc_type) DO NOTHING;

INSERT INTO number_sequences (series_id, period_key, next_no)
SELECT s.id, '', COALESCE(MAX(NULLIF(regexp_replace(l.code, '\D', '', 'g'), '')::int), 0) + 1
FROM numbering_series s LEFT JOIN leads l ON l.company_id = s.company_id
WHERE s.doc_type = 'lead'
GROUP BY s.id
ON CONFLICT (series_id, period_key) DO NOTHING;
