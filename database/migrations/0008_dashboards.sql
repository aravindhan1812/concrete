-- Dashboard framework (SCOPE.md §7, backlog P0.8).
--  * roles.dashboard_layout: an admin override of a role's default widget list (NULL = built-in default)
--  * user_dashboard_layouts: a person's own order / hidden widgets (NULL row = follow their roles)

ALTER TABLE roles ADD COLUMN dashboard_layout JSONB;   -- ["finance.position", "projects.summary", ...]

CREATE TABLE user_dashboard_layouts (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id),
  layout JSONB NOT NULL,                               -- [{"key": "sales.pipeline", "hidden": false}, ...]
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
