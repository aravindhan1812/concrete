# Concrete ERP

AI-powered Construction & Interior Project Management SaaS — Phase 0 foundation.

## What's in this repo

| Piece | Where | Status |
|---|---|---|
| **Product scope, gaps and delivery plan** | `docs/SCOPE.md` | ✅ |
| Architecture & API design | `docs/ARCHITECTURE.md` | ✅ |
| Complete database schema (82 tables, all 13 modules) | `database/schema.sql` | ✅ |
| Permission catalog + 11 role templates | `database/seed.sql` | ✅ |
| Backend scaffold: JWT + refresh rotation, multi-tenancy, configurable RBAC, audit logging | `backend/` | ✅ compiles, 10/10 unit tests pass |
| CRM Leads module end-to-end (API + pipeline state machine + tests + UI) | `backend/src/modules/leads`, `frontend/` | ✅ |
| Web frontend: login/registration, app shell (light/dark), leads pipeline board | `frontend/` | ✅ builds |

## Run everything (Docker)

```bash
docker compose up --build
```

- Web: http://localhost:5173 — register a company, then work the leads board.
- API: http://localhost:3000/api/v1
- Postgres loads `schema.sql` + `seed.sql` automatically on first start; the API applies later migrations when it starts.
- MinIO (S3-compatible file storage): API on http://localhost:9000, console on http://localhost:9001 (`concrete` / `concrete-secret`).

## Run for development

```bash
# 1. Database
docker compose up db

# 2. API
cd backend && cp .env.example .env && npm install && npm run start:dev

# 3. Web
cd frontend && npm install && npm run dev
```

## Checks (what CI runs)

```bash
cd backend  && npm run lint && npm run typecheck && npm test && npm run build
cd frontend && npm run lint && npm run typecheck && npm run build
```

GitHub Actions (`.github/workflows/ci.yml`) runs these on every push, plus applies the database baseline and all migrations to a fresh Postgres.

## Database migrations

`database/schema.sql` + `seed.sql` are the baseline; every later change is a numbered file in `database/migrations/` (see the README there).

```bash
cd backend && DATABASE_URL=postgres://concrete:concrete@localhost:5432/concrete npm run migrate
npm run migrate -- status
```

The API container runs pending migrations before it starts.

Covers tenant scoping, the lead pipeline state machine (illegal moves rejected, lost requires a reason), login, and refresh-token rotation.

## What's next

The full scope and phased plan live in [`docs/SCOPE.md`](docs/SCOPE.md). The summary below is the original Phase 0 roadmap.

### Original roadmap (Phases 1–4)

1. **Core loop**: clients, quotations → BOQ → project conversion, tasks/milestones.
2. **Site + procurement**: daily reports, attendance, MR → RFQ → PO → GRN → stock.
3. **Finance**: expenses, client invoicing (GST/TDS/retention), payments, costing dashboard.
4. **AI + mobile**: BOQ from drawings, delay prediction, NL queries, React Native app.

The schema for all of these already exists; each phase is "write the NestJS module + screens against tables that are already designed." This repo is structured so a coding agent (e.g. Claude Code) can pick up a module per session.
