-- The paying party in construction is the client; a client can have many projects.
-- Rename customer → client everywhere (table, columns, indexes, permissions, ledger party types).

ALTER TABLE customers RENAME TO clients;
ALTER INDEX idx_customers_company RENAME TO idx_clients_company;

ALTER TABLE contacts        RENAME COLUMN customer_id TO client_id;
ALTER TABLE quotations      RENAME COLUMN customer_id TO client_id;
ALTER TABLE projects        RENAME COLUMN customer_id TO client_id;
ALTER TABLE client_invoices RENAME COLUMN customer_id TO client_id;
ALTER TABLE users           RENAME COLUMN customer_id TO client_id;   -- CHECK users_single_external_link follows the rename
ALTER INDEX users_customer_id_idx RENAME TO users_client_id_idx;

-- Permissions
UPDATE permissions SET code = 'crm.clients.read',   description = 'View clients'   WHERE code = 'crm.customers.read';
UPDATE permissions SET code = 'crm.clients.manage', description = 'Manage clients' WHERE code = 'crm.customers.manage';

-- Ledger party types
ALTER TABLE accounts DROP CONSTRAINT accounts_party_ledger_check;
UPDATE accounts SET party_ledger = 'client' WHERE party_ledger = 'customer';
ALTER TABLE accounts ADD CONSTRAINT accounts_party_ledger_check CHECK (party_ledger IN ('client','vendor','employee'));
UPDATE accounts SET system_key = 'client_advance', name = 'Client Advances' WHERE system_key = 'customer_advance';

-- Posted lines are immutable (journal_line_draft_only_trg). This rename changes only the label of
-- the party type, never an amount or account, so the trigger is suspended for this one statement
-- inside the migration's transaction and re-enabled before commit.
ALTER TABLE journal_lines DROP CONSTRAINT journal_lines_party_type_check;
ALTER TABLE journal_lines DISABLE TRIGGER journal_line_draft_only_trg;
UPDATE journal_lines SET party_type = 'client' WHERE party_type = 'customer';
ALTER TABLE journal_lines ENABLE TRIGGER journal_line_draft_only_trg;
ALTER TABLE journal_lines ADD CONSTRAINT journal_lines_party_type_check CHECK (party_type IN ('client','vendor','employee'));
