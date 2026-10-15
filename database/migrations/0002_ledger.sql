-- Double-entry ledger core (SCOPE.md §5.14, backlog P0.7).
-- Rules enforced here, not only in the service layer:
--   * a posted journal entry balances (sum debit = sum credit, at least two lines)
--   * posted entries and their lines are immutable; corrections are reversals
--   * nothing posts into a locked period or a closed financial year

-- ---------- Chart of accounts ----------
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  parent_id UUID REFERENCES accounts(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('asset','liability','equity','income','expense')),
  is_group BOOLEAN NOT NULL DEFAULT FALSE,          -- groups hold no postings
  system_key TEXT,                                  -- posting-rule target, e.g. ar_control, output_gst
  party_ledger TEXT CHECK (party_ledger IN ('customer','vendor','employee')),  -- control account: lines carry a party
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code),
  UNIQUE (company_id, system_key)
);
CREATE INDEX accounts_company_parent_idx ON accounts (company_id, parent_id);

-- ---------- Financial years and monthly periods ----------
CREATE TABLE financial_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,                               -- e.g. 2025-26
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  closed_at TIMESTAMPTZ,
  UNIQUE (company_id, name),
  CHECK (end_date > start_date)
);

CREATE TABLE accounting_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  fy_id UUID NOT NULL REFERENCES financial_years(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','locked')),
  locked_by UUID, locked_at TIMESTAMPTZ,
  UNIQUE (fy_id, period_start)
);

-- ---------- Voucher types (numbering series) ----------
CREATE TABLE voucher_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  code TEXT NOT NULL,                               -- sales|purchase|receipt|payment|contra|journal|debit_note|credit_note
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  UNIQUE (company_id, code)
);

CREATE TABLE voucher_sequences (                    -- one counter per voucher type per financial year
  voucher_type_id UUID NOT NULL REFERENCES voucher_types(id) ON DELETE CASCADE,
  fy_id UUID NOT NULL REFERENCES financial_years(id) ON DELETE CASCADE,
  next_no INT NOT NULL DEFAULT 1,
  PRIMARY KEY (voucher_type_id, fy_id)
);

-- ---------- Journals ----------
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  fy_id UUID NOT NULL REFERENCES financial_years(id),
  voucher_type_id UUID NOT NULL REFERENCES voucher_types(id),
  number TEXT,                                      -- assigned on posting, e.g. JV/25-26/0001
  entry_date DATE NOT NULL,
  narration TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted','reversed')),
  source_type TEXT, source_id UUID,                 -- originating document (client_invoice, grn, payroll_run ...)
  reversal_of_id UUID REFERENCES journal_entries(id),
  reversed_by_id UUID REFERENCES journal_entries(id),
  posted_at TIMESTAMPTZ, posted_by UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, number)
);
CREATE INDEX journal_entries_company_date_idx ON journal_entries (company_id, entry_date);
CREATE INDEX journal_entries_source_idx ON journal_entries (source_type, source_id);

CREATE TABLE journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  line_no INT NOT NULL,
  account_id UUID NOT NULL REFERENCES accounts(id),
  debit NUMERIC(14,2) NOT NULL DEFAULT 0,
  credit NUMERIC(14,2) NOT NULL DEFAULT 0,
  party_type TEXT CHECK (party_type IN ('customer','vendor','employee')),
  party_id UUID,
  branch_id UUID REFERENCES branches(id),
  project_id UUID REFERENCES projects(id),
  cost_code_id UUID REFERENCES cost_codes(id),
  ref_type TEXT, ref_id UUID,                       -- bill-wise settlement: the document this line settles
  description TEXT,
  UNIQUE (entry_id, line_no),
  CHECK (debit >= 0 AND credit >= 0),
  CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);
CREATE INDEX journal_lines_account_idx ON journal_lines (company_id, account_id);
CREATE INDEX journal_lines_party_idx ON journal_lines (company_id, party_type, party_id);
CREATE INDEX journal_lines_project_idx ON journal_lines (project_id) WHERE project_id IS NOT NULL;

-- ---------- Integrity triggers ----------

-- Posted entries balance. Deferred so lines and the status flip can land in one transaction.
CREATE FUNCTION journal_entry_balanced() RETURNS trigger AS $$
DECLARE d NUMERIC; c NUMERIC; n INT;
BEGIN
  IF NEW.status = 'posted' THEN
    SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0), COUNT(*) INTO d, c, n
      FROM journal_lines WHERE entry_id = NEW.id;
    IF n < 2 THEN RAISE EXCEPTION 'journal entry % needs at least two lines', NEW.id; END IF;
    IF d <> c THEN RAISE EXCEPTION 'journal entry % is not balanced (debit % / credit %)', NEW.id, d, c; END IF;
    IF NEW.number IS NULL THEN RAISE EXCEPTION 'posted journal entry % has no number', NEW.id; END IF;
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER journal_entry_balanced_trg
  AFTER INSERT OR UPDATE ON journal_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION journal_entry_balanced();

-- Posting into a locked period or a closed year is refused.
CREATE FUNCTION journal_entry_period_open() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'posted' AND (TG_OP = 'INSERT' OR OLD.status <> 'posted') THEN
    IF EXISTS (SELECT 1 FROM financial_years WHERE id = NEW.fy_id AND status = 'closed') THEN
      RAISE EXCEPTION 'financial year is closed';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM financial_years WHERE id = NEW.fy_id AND NEW.entry_date BETWEEN start_date AND end_date) THEN
      RAISE EXCEPTION 'entry date % is outside the financial year', NEW.entry_date;
    END IF;
    IF EXISTS (SELECT 1 FROM accounting_periods WHERE fy_id = NEW.fy_id AND status = 'locked'
               AND NEW.entry_date BETWEEN period_start AND period_end) THEN
      RAISE EXCEPTION 'accounting period containing % is locked', NEW.entry_date;
    END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER journal_entry_period_open_trg
  BEFORE INSERT OR UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION journal_entry_period_open();

-- Immutability: a posted entry may only move to 'reversed' (recording which entry reversed it).
CREATE FUNCTION journal_entry_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN RAISE EXCEPTION 'posted journal entries cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'reversed' THEN RAISE EXCEPTION 'reversed journal entries cannot be changed'; END IF;
  IF OLD.status = 'posted' THEN
    IF NEW.status <> 'reversed'
       OR NEW.number IS DISTINCT FROM OLD.number OR NEW.entry_date <> OLD.entry_date
       OR NEW.narration IS DISTINCT FROM OLD.narration OR NEW.fy_id <> OLD.fy_id
       OR NEW.voucher_type_id <> OLD.voucher_type_id OR NEW.company_id <> OLD.company_id
       OR NEW.source_type IS DISTINCT FROM OLD.source_type OR NEW.source_id IS DISTINCT FROM OLD.source_id
       OR NEW.reversal_of_id IS DISTINCT FROM OLD.reversal_of_id OR NEW.posted_at IS DISTINCT FROM OLD.posted_at
    THEN RAISE EXCEPTION 'posted journal entries are immutable; post a reversal instead'; END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER journal_entry_immutable_trg
  BEFORE UPDATE OR DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION journal_entry_immutable();

-- Lines can only be written while the entry is a draft.
CREATE FUNCTION journal_line_draft_only() RETURNS trigger AS $$
DECLARE eid UUID; st TEXT;
BEGIN
  eid := COALESCE(NEW.entry_id, OLD.entry_id);
  SELECT status INTO st FROM journal_entries WHERE id = eid;
  IF st IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'lines of a % journal entry cannot be changed', st; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF EXISTS (SELECT 1 FROM accounts WHERE id = NEW.account_id AND (is_group OR NOT is_active)) THEN
    RAISE EXCEPTION 'account % is a group or inactive and cannot take postings', NEW.account_id;
  END IF;
  IF EXISTS (SELECT 1 FROM accounts WHERE id = NEW.account_id AND company_id <> NEW.company_id) THEN
    RAISE EXCEPTION 'account belongs to another company';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER journal_line_draft_only_trg
  BEFORE INSERT OR UPDATE OR DELETE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION journal_line_draft_only();

-- ---------- Balances ----------
CREATE VIEW v_account_balances AS
SELECT a.company_id, a.id AS account_id, a.code, a.name, a.type, a.parent_id,
       COALESCE(SUM(l.debit),0) AS debit, COALESCE(SUM(l.credit),0) AS credit,
       CASE WHEN a.type IN ('asset','expense') THEN COALESCE(SUM(l.debit),0) - COALESCE(SUM(l.credit),0)
            ELSE COALESCE(SUM(l.credit),0) - COALESCE(SUM(l.debit),0) END AS balance
FROM accounts a
LEFT JOIN journal_lines l ON l.account_id = a.id
LEFT JOIN journal_entries e ON e.id = l.entry_id AND e.status IN ('posted','reversed')
GROUP BY a.company_id, a.id;

-- ---------- Permissions ----------
INSERT INTO permissions (code, module, description) VALUES
  ('finance.ledger.read',   'finance', 'View accounts, journals and financial reports'),
  ('finance.ledger.post',   'finance', 'Post and reverse journal entries'),
  ('finance.ledger.manage', 'finance', 'Manage chart of accounts, financial years and period locks');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('finance.ledger.read','finance.ledger.post','finance.ledger.manage')
WHERE r.name IN ('Company Owner', 'Finance')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'finance.ledger.read'
WHERE r.name = 'Director'
ON CONFLICT DO NOTHING;
