# BuildFlow ERP — Product Scope

This is the source of truth for **what BuildFlow must do**. `ARCHITECTURE.md` covers *how* it is built; this document covers *what* is built, what exists today, what is missing, and the order of work. Each module section ends with a **Status / gaps** block so a contributor (human or coding agent) can pick up a module and know exactly what to add.

Legend: ✅ built · 🟡 designed in `database/schema.sql`, not built · ❌ not designed yet

---

## 1. Product vision

BuildFlow is a single, multi-tenant SaaS ERP that runs **the whole business of a construction or interior contractor** — from the first enquiry to the final handover and the books of account — with AI that creates and updates records, and dashboards tailored to each role.

Hard requirements:

1. **Everything in one system:** CRM, sales, projects, drawings, site, quality, safety, materials, procurement, vendors and subcontractors, inventory, tools and assets, people and payroll, full double-entry accounting, client portal, vendor portal, AI, analytics.
2. **Web application, responsive** to phones and tablets. Site staff, clients and vendors will mostly use phones.
3. **Configurable permissions per role**, per company.
4. **AI that acts, not just answers:** it creates and updates records through the same permission-checked API as people, with human approval by default.
5. **Role-based dashboards and analysis.**
6. **India-first compliance:** GST (CGST/SGST/IGST), TDS, MSME payment rules, Indian number and date formats, INR. The design must not prevent other countries later.

---

## 2. Users and roles

Role templates are cloned into each company at signup and can be edited freely (`admin.roles.manage`).

| Role | Primary job in BuildFlow | Main device |
|---|---|---|
| Company Owner | Everything; profitability, cash, risk | Desktop + phone |
| Director | Read everything, approvals | Desktop + phone |
| Project Manager | Plan and run projects, approve site requests | Desktop + tablet |
| Site Engineer / Supervisor | Daily reports, attendance, material requests, QC/safety on site | **Phone** |
| QC Engineer *(new template)* | Inspections, NCRs, material tests, snagging | Tablet + phone |
| Safety Officer *(new template)* | Permits, incidents, toolbox talks, audits | Phone |
| Purchase Manager | Vendor quotes, POs, vendor onboarding, rate lists | Desktop |
| Store Manager | Goods receipts, issues, transfers, stock audits, tools | Tablet + phone |
| Finance / Accountant | Accounting, invoicing, payments, GST/TDS, reports | Desktop |
| HR | Employees, labour, leave, payroll | Desktop |
| Sales Executive | Leads, customers, quotations | Phone + desktop |
| Designer / Architect *(new template)* | Drawings, revisions, client selections | Desktop |
| **Client** (external) | Client portal — own projects only | **Phone** |
| **Vendor / Subcontractor** (external) | Vendor portal — own POs, work orders, bills | **Phone** |

**External users.** A user record links to *either* a customer or a vendor (`users.customer_id` / `users.vendor_id`, mutually exclusive, both null for staff). The server scopes every query for an external user to that customer or vendor automatically — this is enforced in one place, not per endpoint. ❌ *Not designed yet: the `users` table has no such link today, so the existing Client and Vendor templates cannot work.*

---

## 3. Cross-cutting foundations

These are shared by every module and are built once.

| Capability | Description | Status |
|---|---|---|
| Multi-tenancy | `company_id` on every business row, enforced in every service method | ✅ |
| Auth | JWT access + rotating refresh tokens | ✅ |
| Configurable RBAC | `module.resource.action` permission codes on roles | ✅ |
| Audit log | Every mutation recorded with actor (human or AI), before/after | ✅ (actor type for AI ❌) |
| Branches, warehouses | Company → branches → warehouses (site stores are warehouses with a project) | 🟡 |
| Files | Polymorphic attachments, GPS + timestamp for site photos, S3-compatible storage | 🟡 |
| Approval engine | Ordered, configurable approval steps by document type and amount threshold; reused by POs, quotations, expenses, leave, permits, change orders, journals | 🟡 (amount rules ❌) |
| **Checklist engine** | Reusable templates (sections, items, pass criteria, photo required, mandatory) → filled instances. Shared by QC inspections, safety audits, site inspections, handover | ❌ (today `inspections.checklist` is free JSON) |
| **Share-to-portal** | Every record that a client or vendor can see carries an explicit `shared_with_client` / `shared_with_vendor` flag; nothing is visible externally by default; costs and margins are never shareable | ❌ |
| Notifications | In-app, email, WhatsApp/SMS; per-user preferences; digest | 🟡 (channels ❌) |
| Numbering series | Configurable document numbers per company/branch/financial year (e.g. `PO/BLR/25-26/0042`) | 🟡 (leads only) |
| Comments and mentions | Threaded comments with @mentions on any record | ❌ |
| Import / export | CSV/Excel import for masters (items, vendors, customers, chart of accounts, opening balances); export of any list | ❌ |
| Print / PDF | Branded PDF templates for quotations, POs, invoices, work orders, bills, reports | ❌ |
| Offline-tolerant site flows | Attendance, daily report, photos and inspections can be captured with poor connectivity and synced later | ❌ |
| Localisation | INR + lakh/crore formatting, Indian financial year (Apr–Mar), English first; UI strings externalised for future languages (Hindi, Tamil, …) | ❌ |

---

## 4. Responsive web application

The UI must work properly at three sizes. ❌ *Today the stylesheet has one breakpoint (720 px) that hides the sidebar with no replacement, so phones have no navigation.*

| Width | Layout |
|---|---|
| Phone (< 640 px) | Bottom navigation (role-specific top 4–5 items + "More"), full-screen forms, lists rendered as cards, sticky primary action button, camera/GPS capture |
| Tablet (640–1024 px) | Collapsible icon sidebar, two-pane list/detail where useful, touch-sized controls |
| Desktop (> 1024 px) | Full sidebar, dense tables with column chooser, multi-pane screens, keyboard shortcuts |

Rules:

- One shared component library (buttons, inputs, tables-that-become-cards, filters, status pills, KPI tiles, charts, file/photo capture) with light/dark themes.
- Touch targets ≥ 44 px; no hover-only actions.
- Installable as a PWA (home-screen icon, offline shell, camera access).
- Every screen is checked at 375 px, 768 px and 1280 px before it is considered done.

---

## 5. Modules

### 5.1 CRM

Leads with an enforced pipeline (`new → contacted → site_visit → quotation → negotiation → won/lost`), follow-ups, customers, contacts, meetings, notes, lead sources and campaigns, conversion of a won lead into a customer + quotation.

**Status / gaps:** ✅ leads (API, pipeline, follow-ups, board UI). 🟡 customers, contacts, meetings, notes. ❌ lead-to-customer conversion flow, lead source/campaign reporting.

### 5.2 Sales — quotations, BOQ, change orders

- Quotations with version chain, discount, taxes, terms; client approval (portal or in person); convert to project.
- **BOQ**: hierarchical items with quantity, unit, rate, wastage %; source `manual` or `ai_drawing`; linked to drawings and to cost codes.
- **Rate analysis**: build a BOQ rate from material + labour + equipment + overhead + margin.
- **Change orders / variations**: added, removed or changed scope after award; cost and time impact; client approval; flows into BOQ, budget, schedule and invoicing.

**Status / gaps:** 🟡 quotations, quotation items, BOQs, BOQ items. ❌ rate analysis, change orders.

### 5.3 Project management

Projects, members, milestones with billing %, WBS, tasks with dependencies (FS/SS/FF/SF), Gantt and Kanban views, baseline vs actual schedule, critical path, progress % (by quantity, not just by date), risks, meetings and minutes, project documents.

**Status / gaps:** 🟡 projects, members, milestones, WBS, tasks, dependencies, risks. ❌ baselines, progress measured against BOQ quantities, meeting minutes.

### 5.4 Drawings management

- **Drawing register**: number, title, discipline (architectural, structural, MEP, interior, landscape), sheet size, scale, project, zone/floor.
- **Revisions** (R0, R1, …) with status: `draft → for_review → approved → for_construction → superseded`; only the latest "for construction" revision is shown on site by default.
- **Transmittals**: a batch of drawings issued to a client, consultant or subcontractor, with acknowledgment.
- **Review and markup**: comments pinned to a location on the drawing; approve/reject by client or consultant.
- **Links**: drawing ↔ BOQ items, tasks, snags, RFIs.
- **RFIs** (requests for information) raised on a drawing, with response and due date.
- Viewer for PDF and images in the browser, usable on a tablet on site.

**Status / gaps:** ❌ entire module. Only the generic `files` table exists.

### 5.5 Site management

Daily site reports (one per project per day; weather, manpower, equipment, work done by BOQ item, materials used, photos, hindrances), GPS attendance for employees and labour, visitors, issues and delays, labour productivity.

**Status / gaps:** 🟡 daily reports, attendance, visitors, issues, inspections. ❌ work-done quantities by BOQ item (needed for progress and subcontractor billing), offline capture.

### 5.6 Quality control

- **Inspection and test plans** per work stage, built from checklist templates.
- **Inspection requests**: site engineer requests → QC engineer or client inspects → pass / fail / conditional, with photos and GPS per item. Optional rule: the next task stays blocked until the inspection passes.
- **Material tests**: cube tests (7 and 28 day), steel test certificates, lab reports, linked to goods receipts and batches; due-date reminders.
- **Non-conformance reports (NCR)**: defect, root cause, corrective and preventive action, owner, deadline, close-out evidence.
- **Snagging / punch lists**: pinned on the drawing, before/after photos, assigned to a subcontractor, client sign-off.
- **Handover pack**: as-built drawings, warranties, O&M manuals; defect-liability-period register.

**Status / gaps:** 🟡 basic `inspections`, `site_issues` (type `quality`). ❌ templates (checklist engine), inspection requests, material tests, NCRs, snags, handover.

### 5.7 Safety (HSE)

- **Incidents and near-misses**: type, severity, people involved, injury details, photos, investigation, root cause, corrective actions, lost-time tracking.
- **Permits to work**: height, hot work, excavation, electrical, confined space — approval, validity window, closure.
- **Toolbox talks and inductions**: topic, attendees (staff and labour), signature or selfie; non-inducted workers are flagged at attendance.
- **Safety inspections and audits** using the checklist engine.
- **PPE issue register** per worker (linked to inventory).
- **Certifications with expiry** for workers and equipment (operator licences, lifting equipment tests, extinguisher refills) with reminders.

**Status / gaps:** 🟡 `site_issues` (type `safety`). ❌ everything else.

### 5.8 Materials management (MRP)

Material requirements derived from the BOQ (`required → requested → ordered → received → consumed`), material requests from site with approval, reconciliation of theoretical vs actual consumption, wastage tracking against the BOQ wastage %.

**Status / gaps:** 🟡 items, categories, units, material requirements, material requests. ❌ consumption reconciliation report.

### 5.9 Procurement

RFQs to multiple vendors → quote comparison grid → PO (with approval thresholds) → goods receipt (accepted/rejected quantity, photos) → vendor invoice with **3-way match** (PO vs GRN vs invoice) → payment. Purchase returns and debit notes. Direct site purchases (petty cash) with bill photo.

**Status / gaps:** 🟡 RFQs, quotes, POs, GRNs, vendor invoices. ❌ purchase returns, debit notes, approval thresholds.

### 5.10 Vendor and subcontractor management

- **Vendor types**: material supplier, subcontractor, labour contractor, equipment hire, service provider.
- **Onboarding**: registration (staff-entered or self-service via portal), approval workflow, status `pending → approved → on_hold → blacklisted`.
- **Compliance documents** with expiry reminders: GST certificate, PAN, MSME/Udyam, cancelled cheque, insurance, labour licence, PF/ESI registration.
- **Contacts** (multiple per vendor) and bank accounts.
- **Rate contracts**: item-wise agreed rates with validity, auto-applied on PO and RFQ comparison.
- **Subcontractor work orders**: scope, BOQ-linked rates, measurement of work done, **running-account (RA) bills**, retention, advance recovery, debit notes (wastage, damage, material supplied by us), final bill.
- **Vendor ledger**: payables, ageing, advances, debit/credit notes, TDS section and rate, MSME 45-day payment tracking.
- **Performance scoring** from real data: on-time delivery and rejection rate (from GRNs), price vs other quotes, snag count (from QC), plus manual ratings → combined score used in vendor selection.

**Status / gaps:** 🟡 vendors, bank accounts, contracts (value only), ratings (manual). ❌ types, onboarding status, compliance documents, contacts, rate contracts, work orders, RA bills, computed scoring, user–vendor link.

### 5.11 Inventory

Immutable stock ledger + materialised balances, multiple warehouses including site stores, issue to project/task, transfers between warehouses (with in-transit state), reservations against projects, stock audits with variance, batch / serial tracking where needed, reorder levels and alerts, valuation (weighted average; FIFO optional).

**Status / gaps:** 🟡 ledger, balances, transfers, reservations, audits. ❌ batches/serials, reorder rules, valuation method setting.

### 5.12 Tools, equipment and assets

Register of tools, vehicles and machinery; QR/barcode tags; check-out / check-in to people and sites; maintenance schedules and history; fuel and hour-meter logs; hire-in equipment (from vendors) vs owned; depreciation (SLM/WDV) posted to accounts; certification expiry (linked to safety).

**Status / gaps:** 🟡 assets, assignments, maintenance, depreciation fields. ❌ QR tags, fuel/hour logs, hire-in tracking, depreciation posting.

### 5.13 People management (HR and payroll)

Employees (with or without a login), daily-wage labour under labour contractors, skills and certifications, attendance (from site GPS attendance), leave with approval, overtime, advances and loans, payroll runs with PF/ESI/PT/TDS, payslips, labour wage payments, statutory registers.

**Status / gaps:** 🟡 employees, labour, leave, payroll runs and items. ❌ statutory deductions, advances, overtime, payroll posting to accounts.

### 5.14 Accounting — full double-entry

BuildFlow is the **system of record for the books**. Every financial document posts balanced journal entries automatically; no module writes money figures that the ledger does not know about.

**Core ledger**

- **Chart of accounts**: hierarchical groups (Assets, Liabilities, Equity, Income, Expenses → sub-groups → ledgers), seeded with an Indian contractor template, fully editable.
- **Journal entries**: header + lines; every entry must balance (sum of debits = sum of credits), enforced in the database and the service layer.
- **Dimensions on every line**: branch, **project**, cost code (MAT/LAB/EQP/SUB/OH), and optionally cost centre — so project P&L comes straight from the ledger.
- **Sub-ledgers**: customers (receivables) and vendors (payables) are party ledgers under control accounts, with bill-by-bill tracking (which payment settled which invoice).
- **Voucher types**: sales, purchase, receipt, payment, contra, journal, debit note, credit note — each with its own numbering series.
- **Financial years and periods**: Indian FY (Apr–Mar) by default; period locking so closed months cannot be changed; year-end closing entry carrying profit to reserves.
- **Opening balances** import for companies migrating from Tally/Zoho/Excel.
- **Immutability**: posted entries are never edited or deleted — they are reversed and re-posted, with both visible in the audit trail.

**Automatic posting rules** (configurable account mapping per company)

| Source document | Debit | Credit |
|---|---|---|
| Client invoice (progress/final) | Customer receivable | Contract revenue; Output GST; Retention receivable split out |
| Client advance received | Bank | Customer advance (liability) |
| Advance adjusted in invoice | Customer advance | Customer receivable |
| Payment received | Bank; TDS receivable | Customer receivable |
| GRN (goods received, not invoiced) | Inventory / project material cost | GRN clearing (liability) |
| Vendor invoice | GRN clearing; Input GST | Vendor payable; TDS payable |
| Subcontractor RA bill | Project subcontract cost; Input GST | Subcontractor payable; Retention payable; TDS payable; advance recovered |
| Vendor payment | Vendor payable | Bank |
| Stock issue to project | Project material cost | Inventory |
| Expense claim / petty cash | Expense (by cost code, project) ; Input GST | Employee payable / Cash |
| Payroll run | Salaries & wages (by project where allocated) | Salary payable; PF/ESI/PT/TDS payable |
| Asset depreciation | Depreciation expense | Accumulated depreciation |
| Bank charges / interest (from reconciliation) | Bank charges / Bank | Bank / Interest income |

**Banking**: multiple bank and cash accounts, statement import (CSV/Excel), auto-matching to payments and receipts, reconciliation report, cheque/PDC register.

**Tax**

- GST: input/output by rate and place of supply (CGST/SGST vs IGST), reverse charge, ITC tracking, GSTR-1 and GSTR-3B summaries, export for filing; e-invoice and e-way bill integration later.
- TDS: deducted on payables (by section: 194C, 194J, 194I, …) and suffered on receivables; TDS payable register; challan and quarterly return summaries; Form 16A tracking.

**Construction-specific**

- Retention receivable and payable, released on milestone or after the defect-liability period.
- Mobilisation advance and its recovery across bills.
- Revenue recognition on work-in-progress (percentage of completion), with WIP and unbilled revenue at period end.
- Project costing straight from the ledger: budget vs committed (open POs/work orders) vs actual vs billed vs margin.

**Reports**: day book, ledger, trial balance, profit and loss, balance sheet, cash flow, receivable and payable ageing, project-wise P&L, cost-code analysis, GST and TDS reports, budget vs actual. All filterable by branch, project and period, all exportable to Excel/PDF.

**Integration**: export to Tally (XML) for companies whose auditors insist; API for other tools. BuildFlow remains the master.

**Status / gaps:** 🟡 cost codes, budgets, expenses, client invoices, payments, bank accounts and transactions, TDS register, `v_project_costing` view. ❌ chart of accounts, journal entries and lines, voucher types, financial years and period locks, posting rules, party sub-ledgers and bill-wise settlement, GST returns, retention/advance accounting, WIP recognition, financial reports. `v_project_costing` will be rebuilt on top of the ledger.

### 5.15 Client portal

- Project view: progress %, milestones, schedule summary, shared photo/daily-update feed.
- Commercial: quotations and BOQ approval, **change order approval**, invoices, payment history, outstanding balance, online payment.
- Drawings and selections: review/approve drawings, choose materials and finishes (important for interiors), comment.
- Snags and handover: raise snags, approve fixes, download the handover pack.
- Messages per project and meeting minutes.
- Only records explicitly shared with the client are visible; internal costs and margins are never exposed.
- Designed for phones first.

**Status / gaps:** 🟡 "Client" role template. ❌ user–customer link, share flags, all portal screens, online payments.

### 5.16 Vendor portal

Self-registration and document upload, PO acceptance and delivery-date updates, RFQ responses, work order acceptance, invoice and RA bill submission, payment status and ledger statement, performance score visible to the vendor. Phone first.

**Status / gaps:** 🟡 "Vendor" role template. ❌ user–vendor link and all portal screens.

---

## 6. AI

AI in BuildFlow **does work**, not just chat. It runs through the same API and permission checks as a human user, under a clearly marked AI actor.

**Principles**

1. **Tool-based actions**: every AI capability is a typed action (e.g. `create_project_from_lead`, `draft_material_request`, `update_task_progress`) that maps to an existing API endpoint and permission.
2. **Propose, then apply**: by default the AI produces a *proposed change set* that a person reviews and approves; per company and per action, trusted low-risk actions can be set to auto-apply.
3. **Never exceed the requesting user's permissions.** AI acting for a site engineer can only do what a site engineer can do.
4. **Fully audited**: audit log records actor = AI, on behalf of which user, the prompt/context, and the approval.
5. **Asynchronous**: long jobs (drawing analysis, report generation) run in the background queue and notify when done.

**Capabilities**

| Area | What the AI does |
|---|---|
| Sales | Generate BOQ from drawings; suggest rates from history and rate contracts; draft quotations |
| Projects | Create project, WBS, milestones and task schedule from a won quotation/BOQ; re-plan after delays |
| Site | Draft daily report from photos, voice notes and attendance; update task progress from the report |
| Materials | Plan material requirements from schedule + BOQ; draft material requests ahead of need |
| Procurement / vendors | Suggest vendors for a request; flag price anomalies; extract invoice and bill data from uploaded documents; predict late deliveries |
| Quality / safety | Detect missing PPE or hazards in site photos; suggest checklist items; summarise NCR root causes |
| Accounting | Categorise expenses from bill photos; suggest bank-reconciliation matches; flag unusual entries |
| Analysis | Answer natural-language questions ("which projects are over budget on steel?") with tables and charts, scoped to the user's permissions |
| Prediction | Delay and cost-overrun risk per project; cash-flow forecast |

**Status / gaps:** 🟡 `ai_jobs`, `ai_predictions`. ❌ action catalog, proposed-change-set model and approval UI, AI actor in audit log, all capabilities.

---

## 7. Dashboards and analytics

A dashboard framework built from shared widgets (KPI tile, trend chart, breakdown chart, table, alert list, map), filtered automatically by the viewer's permissions and scope. Each role template ships with a default dashboard; users can rearrange, and admins can edit per role.

| Role | Headline content |
|---|---|
| Owner / Director | Revenue, gross margin, cash position, receivables and payables ageing, projects at risk, pipeline value, safety LTI-free days |
| Project Manager | Schedule variance, cost vs budget per project, open issues/NCRs/snags, pending approvals, upcoming milestones and billing |
| Site Engineer | Today's tasks, attendance, pending material requests, inspections due, open permits |
| QC Engineer | Inspections due, first-time pass rate, open NCRs by age, snags by subcontractor, tests due |
| Safety Officer | Incident and near-miss trend, open permits, toolbox talk compliance, expiring certifications |
| Purchase Manager | Open requests and POs, late deliveries, price trends, vendor scores, expiring vendor documents |
| Store Manager | Stock below reorder level, pending GRNs and transfers, tools checked out, audit variances |
| Finance | Cash and bank, receivables/payables ageing, GST/TDS due dates, unreconciled bank lines, project P&L |
| HR | Headcount, attendance %, leave pending, payroll status, labour cost by project |
| Sales | Pipeline by stage, conversion rate, follow-ups due, quotations awaiting client |
| Client (portal) | Progress, next milestone, amount due, items awaiting their approval |
| Vendor (portal) | Open POs/work orders, bills submitted vs paid, their performance score |

Plus a **report builder** (choose dataset, columns, filters, grouping, chart) and scheduled email of any report.

**Status / gaps:** 🟡 `reports.read` permission. ❌ everything else.

---

## 8. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | List pages < 1 s at p95 for 10k rows per company; dashboards < 2 s |
| Availability | 99.5 % initially; daily backups with point-in-time recovery |
| Security | Tenant isolation tests on every module; OWASP top-10 review; MFA for owners and finance; encryption at rest for files |
| Data protection | Compliance with India's DPDP Act; per-company data export and deletion |
| Auditability | Every mutation audited; financial records immutable after posting |
| Testing | Unit tests per service (tenant scoping, state machines, posting rules); end-to-end tests of the main flows; responsive checks at 3 widths |
| Accessibility | WCAG 2.1 AA for core flows |

---

## 9. Delivery plan

Each phase ends with working, tested screens — not just APIs.

| Phase | Scope |
|---|---|
| **1. Foundation** | Responsive app shell (phone/tablet/desktop), component library, dashboard framework; schema additions: external-user link (customer/vendor), share flags, checklist engine, drawings, vendor types/onboarding/compliance/rate contracts/work orders/RA bills, QC and safety tables, **double-entry ledger** (chart of accounts, journals, voucher types, financial years, posting-rule mapping), AI actions and proposed change sets; new role templates (QC Engineer, Safety Officer, Designer) and permissions |
| **2. Core flow** | Customers and contacts, lead → customer conversion, quotations, BOQ, rate analysis, change orders, project conversion, WBS, milestones, tasks, Gantt; drawings register, revisions, transmittals, RFIs |
| **3. Site, quality, safety, supply chain** | Daily reports, attendance, issues; QC inspections, tests, NCRs, snags; safety incidents, permits, toolbox talks; MRP, material requests, RFQs, POs, GRNs; vendors and subcontractors (onboarding, rate contracts, work orders, RA bills); inventory and transfers; tools and assets |
| **4. People and accounting** | HR, labour, leave, payroll; full accounting: posting rules for every document, banking and reconciliation, GST and TDS, retention and advances, WIP, financial and project reports, Tally export |
| **5. Portals** | Client portal and vendor portal (phone first), online payments |
| **6. AI and analytics** | AI action catalog with propose/approve, document extraction, daily report drafting, BOQ from drawings, predictions, natural-language analysis, role dashboards completed, report builder |

---

## 10. Open questions

1. **Target customer size** — small interior firms, mid-size builders, or both? Affects default approval and procurement depth.
2. **Payroll depth** — full statutory payroll inside BuildFlow, or attendance + wage calculation exported to a payroll provider?
3. **Payment gateway** for the client portal (Razorpay, Cashfree, …).
4. **Messaging channel** — WhatsApp Business API for notifications and portal links?
5. **Languages** beyond English, and which first.
6. **Native mobile app** — is the responsive PWA enough, or is a React Native app still planned for site staff (offline, background GPS)?
