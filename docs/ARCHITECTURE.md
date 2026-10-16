# Concrete ERP — Architecture & API Design

## 1. System overview

Concrete is a multi-tenant SaaS ERP for construction and interior contractors. One deployment serves many companies; every business row carries a `company_id` and every query is scoped to it server-side (row-level tenancy). This keeps operations simple at early scale while leaving a clean migration path to schema-per-tenant or Postgres RLS if a large enterprise customer demands it.

```
┌──────────────┐   ┌───────────────┐
│ React (web)  │   │ React Native  │
└──────┬───────┘   └──────┬────────┘
       │  HTTPS / REST (JWT bearer) │
┌──────┴────────────────────┴──────┐
│      NestJS API  (api/v1)        │
│  Guards: JWT → Audience → Perms  │
│  Interceptor: Audit              │
│  Modules: Auth · RBAC · CRM ·    │
│  Sales · Projects · Site · MRP · │
│  Procurement · Inventory ·       │
│  Finance · AI                    │
├──────────┬───────────┬───────────┤
│PostgreSQL│ Redis     │ S3-compat │
│(system of│ (queues,  │ (files,   │
│ record)  │ cache)    │ drawings) │
└──────────┴───────────┴───────────┘
       │ async jobs (BullMQ)
┌──────┴───────────────────────────┐
│ Workers: AI (BOQ from drawings,  │
│ delay/cost prediction, NL query),│
│ notifications, report generation │
└──────────────────────────────────┘
```

## 2. Architectural decisions

| Decision | Choice | Why |
|---|---|---|
| Tenancy | Row-level (`company_id` on every table) | Cheapest to operate, safe when enforced in the service layer (never trusted from the client); revisit with RLS for enterprise tier |
| API style | REST (`/api/v1`) | Predictable, cache-friendly, easiest for mobile + third-party integrations; GraphQL can be layered later for the reporting screens |
| AuthN | JWT access (15 min) + rotating refresh (7 d, SHA-256 hash stored server-side) | Stateless for horizontal scale; rotation limits stolen-token blast radius |
| AuthZ | Permission codes (`module.resource.action`) on roles; roles per company, cloned from system templates at signup | "All permissions configurable per role" is a first-class product requirement |
| DB schema | Owned by versioned SQL (`database/schema.sql`), `synchronize: false` | Migrations are explicit and reviewable; no ORM drift in production |
| Money | `NUMERIC(14,2)`, quantities `NUMERIC(14,3)` | Never floats for money |
| Stock | Immutable `stock_ledger` + materialized `stock_balances` | Auditability first; balances are a projection that can always be rebuilt |
| Audit | Global interceptor writes every successful mutation | Compliance and dispute resolution for financial documents |
| AI features | Async `ai_jobs` queue with `input/output` JSONB | LLM/vision calls are slow and fallible; never block a user request on them |
| Deletes | Soft (`deleted_at`) on business entities | ERP data is legal/financial history |
| Ledger | Double-entry; balance, period locks and immutability enforced by Postgres triggers as well as the service | A bug in any module cannot leave the books unbalanced or rewrite history |
| Shared services | Numbering, approvals, notifications and entity access are global Nest modules; other modules inject them | One implementation of each cross-cutting concern; modules stay small |
| Files | Browser → object storage via presigned PUT; API stores metadata only | Large drawings and phone photos never stream through the API |
| Attachments & comments access | Follows the record they belong to (`ENTITY_REGISTRY`: entity type → table + read permissions, tenant check) | No separate permission model to keep in sync |
| Dashboards | Widget catalogue + per-role default layouts in code; one data endpoint per widget; layouts may name planned widgets that switch on when their module ships | Each role gets a relevant home screen now, and it fills in as modules land without layout migrations |
| Schema drift | `npm run schema:check` in CI compares every entity column with the migrated database | Catches an entity that no longer matches the SQL-owned schema |
| Posting rules | `accounts.system_key` maps each rule target (`ar_control`, `output_gst`, …) to one ledger per company | Companies rename / restructure their chart without touching code |

## 3. Domain map (schema sections → modules)

1. **Tenancy & identity** — companies, branches, warehouses, users, roles, permissions, refresh tokens.
2. **Shared infra** — files (polymorphic attachments with GPS for site photos), audit logs, notifications, generic approval engine (`approval_requests` + ordered `approval_steps`) reused by POs, quotations, expenses, leave.
3. **CRM** — clients, contacts, **leads with an enforced pipeline state machine** (`new → contacted → site_visit → quotation → negotiation → won/lost`), follow-ups, meetings, notes.
4. **Sales** — quotations (version chain via `parent_id`), BOQs (hierarchical `boq_items` with wastage %, `source = manual | ai_drawing`).
5. **Projects** — projects, members, milestones (with `billing_pct` for progress invoicing), WBS, tasks + dependencies (FS/SS/FF/SF), risks.
6. **Site** — daily reports (unique per project/day, AI-generatable), GPS attendance for employees *and* labour, visitors, issues/delays/safety/quality, inspections with JSONB checklists.
7. **MRP & procurement** — material requirements derived from BOQ (required → requested → received → consumed funnel), material requests, RFQs with vendor quote comparison, POs, GRNs (accepted/rejected qty), vendor invoices with 3-way match status.
8. **Inventory** — ledger + balances + reservations, transfers between warehouses (site stores are warehouses with `project_id`), stock audits with variance.
9. **Assets** — tools/vehicles/machinery, assignment history, maintenance, SLM/WDV depreciation fields.
10. **Workforce** — employees (may or may not have logins), daily-wage labour under contractor vendors, leave, payroll runs.
11. **Finance** — cost codes (MAT/LAB/EQP/SUB/OH), budgets, expenses with bill photos, client invoices (advance/progress/final, CGST/SGST/IGST, TDS, retention), payments in/out, bank reconciliation, TDS register. `v_project_costing` view rolls up budget vs actual vs billed vs gross profit per project.
12. **AI** — `ai_jobs` (BOQ-from-drawing, material planning, delay/cost prediction, site-report generation, natural-language query) and `ai_predictions` snapshots.

## 4. API design

Base URL `/api/v1`. Bearer JWT on everything except `auth/register-company`, `auth/login`, `auth/refresh`. Errors are `{ statusCode, message }`; validation errors list every failing field. List endpoints take `page`, `pageSize` (max 100) and return `{ data, total, page, pageSize }`.

### Conventions
- `POST /resource` create · `GET /resource` list · `GET /resource/:id` detail · `PATCH /resource/:id` update · `DELETE /resource/:id` soft delete.
- State changes are explicit sub-resources, not generic updates: `PATCH /crm/leads/:id/status`, `POST /procurement/pos/:id/approve`. This is what lets the server enforce workflow rules.
- Every route declares required permission codes; the guard passes if the user holds **any** of them.
- Every route has an **audience**. Routes without `@Audience(...)` serve staff only; portal routes opt in with `@Audience('client')` / `@Audience('vendor')` and scope their queries by `user.clientId` / `user.vendorId`. A client or vendor login therefore cannot reach an internal endpoint even if a misconfigured role granted it the permission.

### Implemented in this scaffold

| Method & path | Permission | Notes |
|---|---|---|
| `POST /auth/register-company` | public | Creates company + clones 11 role templates + owner user |
| `POST /auth/login` | public | Returns user (with flattened permissions), access + refresh tokens |
| `POST /auth/refresh` | public | Rotates refresh token (old one revoked) |
| `POST /auth/logout` | authenticated | Revokes refresh token |
| `GET /rbac/permissions` | `admin.roles.manage` | Full permission catalog |
| `GET/POST /rbac/roles` | `admin.roles.manage` | Company's roles |
| `PUT /rbac/roles/:id/permissions` | `admin.roles.manage` | Replace a role's permission set |
| `GET /admin/users` | `admin.users.manage` | Filter: `kind` (staff/client/vendor), `search`; paginated |
| `GET /admin/users/:id` | `admin.users.manage` | |
| `POST /admin/users` | `admin.users.manage` | Staff login, or portal login with exactly one of `clientId` / `vendorId` (must belong to the company) |
| `PATCH /admin/users/:id` | `admin.users.manage` | Name, roles, password, active flag; the external link is immutable |
| `DELETE /admin/users/:id` | `admin.users.manage` | Deactivates (never your own account) |
| `POST /accounting/setup` | `finance.ledger.manage` | Idempotent: default chart of accounts, voucher types, current FY (also runs at company registration) |
| `GET /accounting/accounts` | `finance.ledger.read` | Flat chart ordered by code; `withBalances=true` adds rolled-up balances |
| `POST /accounting/accounts` · `PATCH /accounting/accounts/:id` | `finance.ledger.manage` | Add / rename / re-parent / deactivate; `systemKey` re-points a posting rule |
| `GET /accounting/voucher-types` | `finance.ledger.read` | SAL, PUR, RCT, PAY, CON, JV, DN, CN |
| `GET /accounting/financial-years` · `POST` | `finance.ledger.read` / `.manage` | Years with their monthly periods |
| `POST /accounting/periods/:id/lock` · `/unlock` | `finance.ledger.manage` | Nothing posts into a locked period |
| `POST /accounting/financial-years/:id/close` | `finance.ledger.manage` | Locks every period, marks the year closed |
| `GET /accounting/journals` | `finance.ledger.read` | Filters: `voucherType`, `status`, `from`, `to`, `accountId`, `projectId` |
| `POST /accounting/journals` | `finance.ledger.post` | Lines by `accountId` or `systemKey`; validated, numbered `PREFIX/FY/0001`, posted atomically |
| `POST /accounting/journals/:id/reverse` | `finance.ledger.post` | Mirror-image entry linked both ways; the original becomes `reversed` |
| `GET /accounting/reports/trial-balance` | `finance.ledger.read` | `from`/`to`; opening carried from before `from` |
| `GET /accounting/reports/ledger/:accountId` | `finance.ledger.read` | Account statement with running balance |
| `GET /admin/numbering` · `PUT /admin/numbering/:docType` | `admin.settings.manage` | Document number series: prefix, pattern (`{PREFIX}` `{FY}` `{YYYY}` `{MM}` `{BRANCH}` `{SEQ:n}`), yearly or never reset |
| `GET /approvals?box=inbox\|mine\|all` | authenticated (`all` needs `approvals.read`) | Requests waiting on my roles / raised by me / everything |
| `GET /approvals/:id` · `POST /approvals/:id/decide` · `/cancel` | approver of the current step / requester | Reject needs a reason; requesters can't approve their own |
| `GET/POST /approvals/rules` · `PATCH /approvals/rules/:id` | `approvals.rules.manage` | Entity type + amount band → approver role per step |
| `POST /files/uploads` → `PUT <presigned url>` → `POST /files/:id/complete` | read access to the attached record | Direct-to-storage upload; type allowlist, 100 MB cap, optional GPS + capture time |
| `GET /files?entityType&entityId` · `GET /files/:id/url` · `DELETE /files/:id` | read access to the record | Short-lived presigned download URL; soft delete |
| `GET/POST /comments` · `PATCH/DELETE /comments/:id` | read access to the record (edit/delete own) | Threaded replies; @mentions notify staff of the same company |
| `GET /crm/clients` | `crm.clients.read` | Search (name, code, phone, email, GSTIN, contact), `status` active / inactive / all; assigned-project roles see only their projects' clients; credit shown to client managers and finance |
| `GET /crm/clients/:id` | `crm.clients.read` | With contacts, leads, projects (scoped) and credit position from the ledger |
| `GET /crm/clients/duplicates` | `crm.clients.read` | Same GSTIN, phone, email or similar name |
| `POST /crm/clients` · `PATCH /crm/clients/:id` · `DELETE /crm/clients/:id` | `crm.clients.manage` | GSTIN checksum-validated, state and PAN derived; unique GSTIN per company; delete refused while money is owed or projects are live |
| `POST/PATCH/DELETE /crm/clients/:id/contacts[/:contactId]` | `crm.clients.manage` | Exactly one primary contact while any exist |
| `POST /crm/leads/:id/convert` | `crm.clients.manage` | Create a client from the lead (contact becomes primary) or link an existing one |
| `GET /crm/gst/states` · `GET /crm/gst/validate/:gstin` | `crm.clients.read` | GST state list; GSTIN check for forms |
| `GET /people/directory` | staff | Names and roles of active staff (for @mentions and pickers) |
| `GET /dashboard` | authenticated | The user's widgets: their roles' layouts (or admin overrides) filtered by permission, their own order / hidden flags, plus planned widgets as `upcoming` |
| `GET /dashboard/widgets/:key` | the widget's permissions | Data for one widget, filtered by tenant and data scope |
| `GET /dashboard/catalog` · `PUT /dashboard/layout` · `DELETE /dashboard/layout` | authenticated | Customise own dashboard (reorder, hide) or reset to role default |
| `PUT /rbac/roles/:id/dashboard` | `admin.roles.manage` | Override a role's default widgets (`null` restores the built-in layout) |
| `GET /notifications` · `/unread-count` · `POST /notifications/:id/read` · `/read-all` | own (staff and portal) | In-app notifications |
| `GET /crm/leads` | `crm.leads.read` | Filter: `status`, `search` (title/contact/phone), paginated |
| `GET /crm/leads/stats` | `crm.leads.read` or `reports.read` | Count + pipeline value by status |
| `GET /crm/leads/:id` | `crm.leads.read` | Includes follow-ups |
| `POST /crm/leads` | `crm.leads.create` | Auto-assigns serial code `LD-0001…`; owner defaults to creator |
| `PATCH /crm/leads/:id` | `crm.leads.update` | |
| `PATCH /crm/leads/:id/status` | `crm.leads.update` | State machine enforced; `lost` requires `lostReason` |
| `POST /crm/leads/:id/follow-ups` | `crm.leads.update` | Also bumps the lead's `nextFollowUpAt` |
| `DELETE /crm/leads/:id` | `crm.leads.delete` | Soft delete |

The remaining modules follow the same pattern; their resource names map 1:1 to the schema sections above (e.g. `/sales/quotations`, `/projects/:id/tasks`, `/procurement/material-requests`, `/inventory/transfers`, `/finance/invoices`).

## 5. Security model

- Passwords: bcrypt (cost 10). Refresh tokens: 48 random bytes, only the SHA-256 hash is stored.
- Tenant isolation is enforced in **every service method signature** — `findOne(companyId, id)` — so forgetting it is a compile-visible smell, not a silent leak.
- External users: `users.client_id` / `users.vendor_id` (mutually exclusive, DB CHECK). The JWT carries `kind` and the linked id; `AudienceGuard` is the single enforcement point that keeps portal logins off internal routes.
- `ValidationPipe({ whitelist: true })` strips unknown fields; DTOs whitelist enums for sources/segments/statuses.
- Global audit interceptor records who did what to which entity, scrubbing password/token fields.
- Secrets via environment only; `.env.example` documents the contract.

## 6. Scaling path

Phase 1 (≤ ~200 companies): single Postgres + API replicas behind a load balancer. Phase 2: Redis-backed queues for AI/report/notification workers, read replica for reports. Phase 3: partition `stock_ledger` and `audit_logs` by month, move hot dashboards to materialized views refreshed on a schedule, evaluate RLS for the enterprise tier.
