-- Clients module (SCOPE.md §5.1, backlog P1 item 9).
-- A client is who the company contracts with and invoices; a client can have many projects.

ALTER TABLE clients
  ADD COLUMN code TEXT,                                   -- CL-0001 (numbering series 'client')
  ADD COLUMN state_code TEXT,                             -- GST state code (place of supply), e.g. 33 = Tamil Nadu
  ADD COLUMN billing_address JSONB,                       -- {line1, line2, city, state, pincode}
  ADD COLUMN site_addresses JSONB NOT NULL DEFAULT '[]',  -- [{label, line1, city, state, pincode}]
  ADD COLUMN credit_limit NUMERIC(14,2),                  -- NULL = no limit set
  ADD COLUMN credit_days INT CHECK (credit_days IS NULL OR credit_days BETWEEN 0 AND 365),
  ADD COLUMN payment_terms TEXT,
  ADD COLUMN notes TEXT,
  ADD COLUMN source_lead_id UUID REFERENCES leads(id),
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD CONSTRAINT clients_type_check CHECK (type IN ('individual', 'business')),
  ADD CONSTRAINT clients_credit_limit_check CHECK (credit_limit IS NULL OR credit_limit >= 0);

-- The old single address column becomes the billing address.
UPDATE clients SET billing_address = address WHERE billing_address IS NULL AND address IS NOT NULL;

CREATE UNIQUE INDEX clients_company_code_uq ON clients (company_id, code) WHERE code IS NOT NULL;
CREATE UNIQUE INDEX clients_company_gstin_uq ON clients (company_id, upper(gstin)) WHERE gstin IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX clients_company_name_idx ON clients (company_id, lower(name)) WHERE deleted_at IS NULL;
CREATE INDEX clients_company_phone_idx ON clients (company_id, phone) WHERE phone IS NOT NULL;

ALTER TABLE contacts
  ADD COLUMN notes TEXT,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN deleted_at TIMESTAMPTZ;
CREATE INDEX contacts_client_idx ON contacts (client_id) WHERE deleted_at IS NULL;
-- At most one primary contact per client.
CREATE UNIQUE INDEX contacts_one_primary_uq ON contacts (client_id) WHERE is_primary AND deleted_at IS NULL;

CREATE INDEX leads_client_idx ON leads (client_id) WHERE client_id IS NOT NULL;
