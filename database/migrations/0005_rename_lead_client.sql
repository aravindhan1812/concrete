-- Follow-up to 0003: leads.customer_id (the client a won lead converts into) was missed.
ALTER TABLE leads RENAME COLUMN customer_id TO client_id;
