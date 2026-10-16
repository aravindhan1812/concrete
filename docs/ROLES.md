# Concrete — Roles & Responsibilities

Who does what in a construction / interior company, and how Concrete models it. `SCOPE.md` says *what* the product does; this document says *who* does it. Role templates and permission sets live in `database/migrations/0006_roles_responsibilities.sql` and are cloned into every company at signup; companies can edit them freely.

## 1. How access works

Access is three questions, answered in this order:

| Question | Mechanism | Example |
|---|---|---|
| **Who are you?** | Login kind: `staff`, `client` or `vendor` (portal) | A subcontractor logs in as a vendor-kind user linked to their vendor record |
| **What may you do?** | Permission codes on roles (`module.resource.action`) | A site engineer holds `site.measurements.record`, not `site.measurements.verify` |
| **Which records?** | Data scope on roles | A site engineer sees only the projects they are assigned to |

**Data scopes**

| Scope | Sees | Roles |
|---|---|---|
| `company` | Everything in the company | Owner, Director, Purchase Manager, Store Manager, Finance, HR, Sales |
| `assigned_projects` | Only projects they are a member of (`project_members`), and everything inside those projects | Project Manager, Planning Engineer, Site Engineer, MEP Engineer, Site Supervisor, QS, QC, Safety, Site Storekeeper, Designer |
| `own_records` | Only records linked to their client or vendor | Client, Vendor, Subcontractor, Labour Contractor |

A user with several roles gets the broadest scope. Portal logins can never get more than `own_records`, even if a role is misconfigured. Each person's responsibility on a project (PM, site engineer, QC…) is recorded on their project membership, so the same engineer can be the site engineer on one project and the QC engineer on another.

**Approval authority** is separate from permissions: approval rules (entity type + amount band → approver role, per step) decide *who must sign*, so limits like "PM up to ₹1 lakh, Director above ₹5 lakh" are configured per company, not hard-coded (see §6).

## 2. Organisation

```
                          Company Owner / MD
                                 │
                             Director(s)
        ┌────────────────┬───────┴────────┬──────────────────┬───────────────┐
   Projects            Supply           Finance             HR            Sales & Design
        │                 │                │                  │                 │
 Project Manager    Purchase Manager    Finance /         HR / Admin     Sales Executive
   ├ Planning Engineer
   ├ Site Engineer   Store Manager      Accounts                         Designer / Architect
   │   └ Site Supervisor / Foreman
   │        └ Labour gangs (own + contractor)
   ├ MEP Engineer (electrical · plumbing · HVAC · fire)
   │   └ MEP subcontractors
   ├ Quantity Surveyor (billing)
   ├ QC Engineer
   ├ Safety Officer
   └ Site Storekeeper

 External:  Client · Vendor (supplier) · Subcontractor · Labour Contractor
```

## 3. Staff roles

### Company Owner
- **Responsible for:** profit, cash, risk, final approvals, company settings, who has access.
- **In Concrete:** every module; configures roles, approval rules, numbering, chart of accounts.
- **Scope:** company · **Device:** desktop + phone
- **Approves:** anything above the Director's limit; write-offs; period close.
- **Dashboard:** revenue, gross margin, cash, receivables / payables ageing, projects at risk, pipeline, safety record.

### Director
- **Responsible for:** oversight of all projects and departments; high-value approvals.
- **In Concrete:** read access everywhere; every approval permission; reports and AI.
- **Scope:** company · **Device:** desktop + phone
- **Approves:** high-value POs, work orders, change orders, client RA bills, expenses (per rules).

### Project Manager (PM)
- **Responsible for:** delivering assigned projects on time, within budget and quality; client coordination; planning and re-planning; procurement needs; certifying progress for billing; managing subcontractors.
- **Daily in Concrete:** reviews daily site reports; approves schedule changes and baselines prepared by the planning engineer; approves material requests, subcontractor bills, labour wage sheets and site expenses within limits; approves drawings for construction; signs off client RA bills; closes NCRs; approves permits to work; tracks risks, budget vs actual.
- **Scope:** assigned projects · **Device:** desktop + tablet
- **Approves:** material requests, POs up to their limit, subcontractor RA bills, labour wage sheets, site expenses, client RA bills (before Finance invoices), drawings, permits.
- **Dashboard:** schedule variance, cost vs budget per project, pending approvals, open issues / NCRs / snags, upcoming milestones and billing.

### Planning Engineer
- **Responsible for:** the project schedule — work breakdown, activity durations and dependencies, the baseline, the critical path; weekly and monthly look-ahead plans; tracking actual progress against plan; delay analysis and recovery plans; resource and material requirement plans that feed procurement.
- **Daily in Concrete:** builds and re-plans the schedule (Gantt); sets baselines for PM approval; reads daily reports and task progress from site; publishes look-ahead plans; flags slipping activities and critical-path risk; raises material requirements ahead of need; maintains the risk register with the PM.
- **Scope:** assigned projects · **Device:** desktop
- **Holds:** `projects.schedule.manage` (with the PM). Site and MEP engineers update progress on tasks but cannot change the plan.
- **Dashboard:** planned vs actual progress (S-curve), critical-path activities, delayed tasks, look-ahead for the next 2–4 weeks, material needed vs ordered.

### Site Engineer
- **Responsible for:** executing work on site as per drawings, specifications and schedule; supervising supervisors and subcontractors; measurements; material planning; quality and safety on site.
- **Daily in Concrete:** submits the daily progress report (work done by BOQ item, manpower, equipment, weather, hindrances, photos); marks attendance; records measurements; raises material requests; issues material from the site store; requests inspections and permits; reports issues, snags and incidents; updates task progress; records petty-cash expenses.
- **Scope:** assigned projects · **Device:** phone (on site), tablet
- **Cannot:** approve their own material requests, verify their own measurements, approve wage sheets.
- **Dashboard:** today's tasks, attendance, pending material requests, inspections due, open permits and issues.

### MEP Engineer
- **Responsible for:** mechanical, electrical and plumbing services — power and lighting, plumbing and drainage, HVAC, fire-fighting and fire alarm, low-voltage systems; coordination of MEP drawings with civil and interior work; supervising MEP subcontractors; testing and commissioning (insulation resistance / megger, pressure and leak tests, HVAC balancing, fire-system tests); as-built MEP drawings for handover.
- **Daily in Concrete:** reports MEP progress in the daily report; records MEP measurements for subcontractor bills; uploads MEP coordination and shop drawings; raises MEP material requests; requests electrical / hot-work permits; carries out and records MEP tests with photos; raises and closes MEP snags; flags clashes and hindrances.
- **Scope:** assigned projects · **Device:** tablet + phone
- **Cannot:** verify measurements or approve subcontractor bills (QS verifies, PM approves).
- **Dashboard:** MEP progress by system, tests due / failed, open MEP snags, MEP material pending, subcontractor progress.

### Site Supervisor / Foreman
- **Responsible for:** day-to-day labour gangs, work allocation, discipline, housekeeping, basic safety.
- **Daily in Concrete (phone only, minimal typing):** marks labour attendance (photo + GPS), allocates gangs to tasks, posts progress photos, reports issues and incidents, flags material shortages.
- **Scope:** assigned projects · **Device:** phone
- **Cannot:** see costs, rates, wages or anything financial.

### Quantity Surveyor (QS) / Billing Engineer
- **Responsible for:** BOQ and rate analysis, measurement verification, client running-account (RA) bills, subcontractor work orders and bill verification, variations / change-order costing, reconciliation of material (theoretical vs actual).
- **Daily in Concrete:** verifies measurements recorded by site engineers; prepares client RA bills from certified quantities; creates subcontractor work orders; verifies subcontractor RA bills against measurements (with deductions for retention, advance recovery, material supplied, damage); maintains the BOQ.
- **Scope:** assigned projects · **Device:** desktop
- **Cannot:** approve the bills they prepare (PM / Director approve).

### QC Engineer
- **Responsible for:** inspection and test plans, stage inspections, material testing (cube tests, steel certificates), non-conformance, snagging, handover quality documents.
- **In Concrete:** performs inspections with checklists and photos; logs test results; raises and closes NCRs; manages snag lists.
- **Scope:** assigned projects · **Device:** tablet + phone

### Safety Officer
- **Responsible for:** site safety plan, inductions and toolbox talks, permits to work, PPE, incident investigation, safety audits.
- **In Concrete:** approves / closes permits; records toolbox talks and inductions (non-inducted workers are flagged at attendance); investigates incidents; runs safety audits; maintains the PPE register and certificate expiry list.
- **Scope:** assigned projects · **Device:** phone

### Site Storekeeper
- **Responsible for:** the site store: receiving material (GRN), issuing to work against requests, transfers, stock counts, tools on site.
- **In Concrete:** posts GRNs with accepted / rejected quantities and photos; issues material to tasks; transfers; raises requests when stock is low.
- **Scope:** assigned projects · **Device:** tablet + phone

### Designer / Architect
- **Responsible for:** drawings and revisions, design changes, client material and finish selections (interiors).
- **In Concrete:** uploads drawings and revisions, issues transmittals, answers RFIs, manages selection boards for client approval.
- **Scope:** assigned projects · **Device:** desktop

### Purchase Manager
- **Responsible for:** vendor base and onboarding, RFQs and comparison, POs, rate contracts, vendor credit terms, delivery follow-up.
- **Scope:** company · **Device:** desktop
- **Approves:** nothing on their own POs — POs go through approval rules.

### Store Manager
- **Responsible for:** central stores, stock levels and reorder, inter-site transfers, tools and asset register, stock audits.
- **Scope:** company · **Device:** desktop + tablet

### Finance / Accounts
- **Responsible for:** client invoicing (from approved RA bills), receipts, vendor and subcontractor payments, payroll and wage payments, expenses, ledger, GST / TDS, bank reconciliation, financial reports.
- **Scope:** company · **Device:** desktop
- **Approves:** expenses (per rules); posts and reverses journals.

### HR / Admin
- **Responsible for:** employees, labour register, attendance consolidation, leave, payroll, labour wage sheets, statutory compliance (PF, ESI, PT), contract-labour compliance.
- **Scope:** company · **Device:** desktop

### Sales Executive
- **Responsible for:** leads, site visits, client relationships, quotations until the order is won.
- **Scope:** company · **Device:** phone + desktop

## 4. External parties

### Client
- **In Concrete (client portal):** progress, shared photos and reports; approves quotations, change orders, drawings and selections; sees invoices and pays; raises snags; downloads the handover pack.
- **Sees:** only their own projects and only what is explicitly shared. Never costs, margins or vendor rates.

### Vendor (material supplier)
- **In Concrete (vendor portal):** accepts POs, updates delivery dates, answers RFQs, uploads invoices, sees payments and their ledger statement.

### Subcontractor
A vendor of type `subcontractor` that executes a scope of work (e.g. waterproofing, false ceiling, MEP) under a **work order**.
- **In Concrete:** accepts work orders; sees certified measurements; submits RA bills; sees deductions (retention, advance recovery, material supplied, debit notes) and payments; uploads compliance documents.
- **Supervision:** site engineer records their progress and measurements; QS verifies their bills; PM approves; QC raises NCRs / snags against them; their score feeds vendor rating.

### Labour Contractor
A vendor of type `labour_contractor` that supplies labour gangs (masons, helpers, carpenters…).
- **In Concrete:** sees their own labour list and site attendance; submits labour bills; uploads statutory proof (PF / ESI challans, labour licence); sees payments.
- **Why it matters:** as principal employer, the company is liable if the contractor does not pay wages or statutory dues (Contract Labour Act), so bills are checked against **our** attendance and challans before payment.

## 5. Labour

Most labourers will **not** have a login; they are records that other roles act on.

| Type | Who pays | Record | Attendance | Wages |
|---|---|---|---|---|
| **Company daily-wage labour** | Company directly | `labour` (no contractor) | Supervisor / site engineer marks daily (photo + GPS) | Wage sheet = days × daily rate + overtime → PM approves → Finance pays (bank / UPI / cash) |
| **Contractor labour** | Labour contractor | `labour` linked to the contractor vendor | Same, by our supervisor (the contractor sees it) | Contractor's labour bill is verified against our attendance → PM approves → paid to contractor; statutory proof required |
| **Subcontractor's workers** | Subcontractor | Optional (headcount in daily report; named only where the site requires it, e.g. safety induction) | Headcount in daily report | Included in the subcontractor's work-order bill |
| **Staff on daily / monthly wage** | Company | `employees` (with or without login) | Attendance / leave | Payroll |

Every labourer record holds: name, photo, skill (mason, carpenter, bar bender, electrician, plumber, painter, helper…), daily rate, contractor (if any), phone, ID proof reference, emergency contact, safety induction date, PPE issued, certifications (e.g. scaffolding, welding) with expiry.

**Later (P4):** an optional worker self-service on the phone (OTP login, no password) to see own attendance, wages and payslips, in the worker's language. It would be a fourth login kind (`worker`) scoped to the worker's own records.

## 6. Who does what — key workflows

R = does it · A = approves / accountable · C = consulted · I = informed

| Workflow | Site Supervisor | Site Engineer | PM | QS | QC | Safety | Storekeeper | Purchase | Finance | Director | External |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Daily progress report | C (photos, headcount) | **R** | A (review) | I | I | I | | | | I | Client I (if shared) |
| Labour attendance | **R** | R | I | | | C (induction check) | | | I | | Labour contractor I |
| Labour wage sheet / contractor labour bill | | C | **A** | | | | | | R (pay) | | Labour contractor R (bill) |
| Material request → PO | C | **R** (request) | A (request) | | | | C (stock check) | **R** (RFQ, PO) | | A (above limit) | Vendor R (quote, deliver) |
| Goods receipt | | C | I | | C (tests) | | **R** | I | I | | Vendor I |
| Measurement → client RA bill | | **R** (record) | **A** | **R** (verify, prepare) | | | | | R (invoice) | A (above limit) | Client A (certify) |
| Subcontractor work order & RA bill | | R (measure) | **A** | **R** (WO, verify) | C | | | C | R (pay) | A (above limit) | Subcontractor R (bill) |
| Inspection / NCR | | R (request) | A (close NCR) | | **R** | | | | | | Subcontractor R (rectify) |
| Permit to work | C | **R** (request) | I | | | **A** | | | | | Subcontractor C |
| Incident | R (report) | R (report) | I | | | **R** (investigate) | | | | I | |
| Change order | | C | **R** | R (cost) | | | | | I | A (above limit) | Client **A** |
| Drawing for construction | | I | **A** | I | I | | | | | | Designer **R** |

**Planning and MEP workflows**

| Workflow | Planning Engineer | MEP Engineer | Site Engineer | PM | QS | QC | Purchase | Director | External |
|---|---|---|---|---|---|---|---|---|---|
| Project schedule & baseline | **R** | C (MEP sequence) | C | **A** | I | | I | I (major change) | Client I (milestones) |
| Weekly / monthly look-ahead plan | **R** | C | C | A | | | I (material needs) | | |
| Delay analysis & recovery plan | **R** | C | C | **A** | C (cost impact) | | | I | Client I / A (extension of time) |
| Material requirement plan | **R** | R (MEP items) | C | A | C | | **R** (procure) | | |
| MEP drawing coordination | C | **R** | C | A | | | | | Designer C · MEP subcontractor C |
| MEP testing & commissioning | | **R** | I | A | | C | | | MEP subcontractor R · Client I |
| MEP subcontractor measurement & bill | | **R** (measure) | | **A** | **R** (verify) | | | A (above limit) | Subcontractor R (bill) |

### Recommended approval rules (configured per company)

| Document | Step 1 | Step 2 | Step 3 |
|---|---|---|---|
| Material request | PM | — | — |
| Purchase order | PM (all) | Finance (> ₹1,00,000) | Director (> ₹5,00,000) |
| Subcontractor work order | PM (all) | Director (> ₹5,00,000) | — |
| Subcontractor RA bill | QS verifies (R) → PM (all) | Director (> ₹5,00,000) | — |
| Labour wage sheet / labour bill | PM | Finance (> ₹2,00,000) | — |
| Site expense | PM (≤ ₹25,000) | Finance (> ₹25,000) | — |
| Client RA bill | PM | Director (> ₹25,00,000) | — |
| Change order | PM | Director (> ₹1,00,000) | Client (portal) |

Limits are examples; each company sets its own in **Admin → Approval rules**. A person never approves their own request.

## 7. Implementation status

| Piece | Status |
|---|---|
| 21 role templates with permission sets and data scopes; synced to every company | ✅ migrations 0006, 0007 |
| Permission codes for site, labour, quality, safety, drawings, billing, subcontracting, portals | ✅ |
| `dataScope` on roles, in the login token and on `AuthUser`; `PATCH /rbac/roles/:id` to change it | ✅ |
| `ProjectScopeService` (`projectIds`, `assertProject`) for project-level modules | ✅ (used from P1 as project modules are built) |
| Vendor types (`supplier`, `subcontractor`, `labour_contractor`, `equipment_hire`, `service_provider`) | ✅ column; screens in P2 |
| Project membership with per-project responsibility (assign PM, site engineer…) | 🟡 table exists; screens and API with the Projects module (P1) |
| Default approval rules seeded per company | ❌ with the first modules that submit approvals |
| Labour register, attendance and wage sheets | ❌ P2 (site) / P3 (wages) |
| Worker self-service login | ❌ P4 |
