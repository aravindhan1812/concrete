-- External users: a login may belong to a customer (client portal) or a vendor (vendor portal).
-- Staff users have neither link. The CHECK keeps the two mutually exclusive.
ALTER TABLE users
  ADD COLUMN customer_id UUID REFERENCES customers(id),
  ADD COLUMN vendor_id UUID REFERENCES vendors(id),
  ADD CONSTRAINT users_single_external_link CHECK (customer_id IS NULL OR vendor_id IS NULL);

CREATE INDEX users_customer_id_idx ON users (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX users_vendor_id_idx ON users (vendor_id) WHERE vendor_id IS NOT NULL;

-- Portal permissions. Routes served to external users declare an audience (see
-- backend/src/common/guards/audience.guard.ts); these codes let roles be configured per company.
INSERT INTO permissions (code, module, description) VALUES
  ('portal.client', 'portal', 'Use the client portal'),
  ('portal.vendor', 'portal', 'Use the vendor portal');

-- Attach them to the system templates and to every company's cloned Client / Vendor roles.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'portal.client'
WHERE r.name = 'Client'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'portal.vendor'
WHERE r.name = 'Vendor'
ON CONFLICT DO NOTHING;
