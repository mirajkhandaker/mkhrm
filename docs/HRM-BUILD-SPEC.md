# HRM — Build Specification for Claude Code

You are building a Human Resource Management web application. This document is your single source of truth. Follow it exactly. Where it does not specify a detail, choose the simplest option consistent with the conventions in §4 and keep going — do not stop to ask.

---

## 0. How to execute this build

Build the system following the **phase order and dependency map in §11**. A phase may begin as soon as its declared dependencies are met — phases whose dependencies are satisfied may be built **in parallel**. Within a single feature, once its shared DTO/type contract is added to `packages/types`, the **backend and frontend tracks may proceed concurrently**.

This document is a **living tracker**. Every phase in §11 has checklist items split into **Backend**, **Frontend**, and **Tests** tracks, each with a status marker. As you work, update these markers in the file (see the legend in §11) so progress is always visible and parallel work does not collide. Commit the updated spec along with the code.

For each feature you work, in this order:
1. Add the feature's **shared types/DTO contract** to `packages/types` (enums, request/response shapes). This unblocks backend and frontend to run in parallel.
2. **Backend track:** create the TypeORM entities + migration (run and verify the schema first), then the NestJS module — service(s), controller(s), DTOs with validation, RBAC guards.
3. **Frontend track:** build the screens with shadcn/ui and the §10 design tokens, against the agreed contract (mock the API only until the backend endpoint is ready, then wire it).
4. Write the **tests** listed for the phase.
5. Flip each checklist marker as items complete; verify every **acceptance criterion** and fix until all pass.
6. Commit per working slice with a clear message.

After each phase, output a short status: which markers changed, what files changed, and confirmation each acceptance criterion passes.

Maintain a root `CLAUDE.md` capturing the conventions in §4, the design tokens in §10, and the run/migrate/seed/test commands, and keep it updated as the build progresses.

Generate a seed script early (in Phase 1) and extend it every phase so every feature has data to exercise.

---

## 1. Product scope

Build an HRM that handles:
- **HR information**: employees, departments, designations, documents, and full employment lifecycle (promotion, department transfer, probation → permanent confirmation, status history).
- **Compensation**: per-employee salary structures with configurable components ("slabs"), entered as either Basic or Gross with the rest derived; provident fund (PF) and other benefits. Tracking only — no monthly payroll run in v1.
- **Attendance & scheduling**: fixed 9-to-5 shifts, roster-based shifts, per-employee schedules; live clock in/out; bulk import of attendance device exports (Excel/CSV); regularization requests.
- **Leave management**: configurable leave types (Sick, Casual, Earned, Government Holiday, Unpaid, Maternity, etc.), accrual, balances, applications with approval, immutable balance ledger.
- **Requisition**: generic internal requests (asset/purchase/recruitment) routed through approval.
- **Travel & expense**: pre-trip travel requests and post-trip expense claims with receipts and reimbursement.
- **Approvals**: one configurable multi-step approval engine shared by leave, requisition, travel, expense, and regularization.
- **Dashboards, reports, notifications**: role-specific dashboards, CSV/Excel exports, in-app notifications.

---

## 2. Stack & hard constraints

- **Backend:** NestJS (modular monolith). **ORM:** TypeORM with PostgreSQL.
- **Frontend:** Next.js (App Router, TypeScript), Tailwind CSS, shadcn/ui.
- **Monorepo:** pnpm + turborepo. `apps/api`, `apps/web`, shared `packages/`.
- **Auth:** email/password + JWT (short-lived access token + rotating refresh token in an HTTP-only cookie). RBAC.
- The system is **single-organization, multi-department**. Do not build multi-tenancy. (Design tables so an `organization_id` could be added later, but do not add it now.)
- Use TypeORM **migrations** for all schema changes. Set `synchronize: false` in every environment except first local bring-up. Never edit a migration that has already run; generate a new one.
- Do **not** use `localStorage`/`sessionStorage` in any artifact-style preview; persist through the API.
- Compute all status, totals, balances, and salary figures **server-side**. Never trust the client for these.

---

## 3. Repository layout to create

```
hrm/
├─ apps/
│  ├─ api/                     NestJS modular monolith
│  │  └─ src/
│  │     ├─ modules/
│  │     │  ├─ auth/
│  │     │  ├─ employees/
│  │     │  ├─ compensation/
│  │     │  ├─ attendance/
│  │     │  ├─ imports/
│  │     │  ├─ leave/
│  │     │  ├─ approvals/
│  │     │  ├─ requisitions/
│  │     │  ├─ travel/
│  │     │  └─ notifications/
│  │     ├─ common/            guards, decorators, interceptors, error envelope
│  │     ├─ database/          DataSource, migrations, seeds
│  │     └─ config/            zod-validated env
│  └─ web/                     Next.js App Router
├─ packages/
│  ├─ types/                   shared enums + DTO types (single source of truth)
│  └─ config/                  shared eslint, tsconfig, tailwind preset
└─ .env.example                DB connection + secrets template
```

Each backend module owns `entities/`, `dto/`, its service(s), controller, and module file.

---

## 4. Global engineering conventions (apply in every phase)

- **One entity per file** under each module's `entities/`. Table names snake_case via `@Entity({ name: '...' })`. Use the repository pattern in services; do not put query logic in controllers.
- **Shared vocabulary** lives in `packages/types`: all status strings, component types, roles, and enums. Backend entities and frontend both import these. Never duplicate an enum.
- **Validation:** every endpoint uses DTOs with `class-validator`. Reject unknown fields (`whitelist: true, forbidNonWhitelisted: true`).
- **Error envelope:** all errors return a consistent shape `{ statusCode, error, message, details? }`. Implement a global exception filter.
- **RBAC:** apply `@Roles()` / `@Permissions()` guards on every non-public endpoint. Frontend hides controls the user lacks permission for, but security is enforced server-side regardless.
- **Money:** store monetary values as integer minor units or `numeric(14,2)` columns — never floats. Round at defined points only.
- **Dates/times:** store timestamps in UTC; resolve attendance against the org timezone from `settings`. Use date-only columns for `work_date`, `effective_from`, etc.
- **Immutability:** ledger and history tables (`leave_ledger`, `employment_status_history`, `audit_logs`, `approval_actions`) are append-only. Never update or delete rows in them.
- **Derived values that must stay historically fixed** (salary line amounts, leave days counted) are computed once and stored, not recomputed on read.
- **Frontend:** use shadcn/ui components, never raw HTML form controls. Every list/table has loading, empty, and error states. Use the §10 tokens for all color and type — no ad-hoc hex values in components.
- **Copy:** plain active voice. Buttons name the action ("Apply for leave", "Approve", "Submit claim"); success toasts echo the verb. Error messages state what went wrong and how to fix it.
- **Commit** after each working slice. Write the tests listed per phase before marking the phase done.

---

## 5. RBAC — roles & permissions

Seed these five roles with granular permissions (e.g. `employee.create`, `leave.approve`, `attendance.viewAll`, `salary.view`, `import.commit`, `expense.reimburse`, `workflow.configure`). Bundle permissions into roles so custom roles can be added later without code changes.

| Role | Scope |
|------|-------|
| **Employee** | Own profile (read), own schedule, clock in/out, apply for leave/requisition/travel, view own balances/requests. No access to salary of others. |
| **Line Manager** | Employee scope, plus approve/reject requests from direct reports, view team attendance & leave calendar. |
| **HR Admin** | Manage employees, departments, designations, shifts/rosters, holidays, leave types/balances, salary structures, attendance imports; org-wide reports; acts as an approval stage. |
| **Finance** | Approve/settle travel expenses and reimbursements; view salary/compensation; finance exports. |
| **Super Admin** | Full access, role assignment, workflow configuration, system settings. |

Salary and compensation data is sensitive PII: restrict read/write to HR Admin, Finance, and Super Admin. Employees may view only their own current salary structure if `settings.allow_self_salary_view` is true (default false).

---

## 6. Data model

Create the following entities. `*` marks an indexed foreign key.

### 6.1 Identity & Org
- **users** — `id, email (unique), password_hash, status, last_login_at`
- **roles** — `id, name, description`
- **permissions** — `id, key, description`
- **role_permissions** — join (role_id*, permission_id*)
- **user_roles** — join (user_id*, role_id*)
- **departments** — `id, name, code, parent_id (self-FK), head_employee_id*`
- **designations** — `id, title, level, department_id* (nullable — designations are scoped under a department; null = org-wide)`
- **employees** — `id, user_id*, employee_code (unique), device_user_id (nullable, for attendance-device matching), first_name, last_name, dob, gender, personal_email, phone, photo_url, address, emergency_contact, join_date, employment_type (permanent/contract/intern/probation), employment_status (probation/confirmed/notice_period/terminated/resigned), status (active/on_leave/inactive), department_id*, designation_id*, line_manager_id* (self-FK)`
  - `employees` holds the **current** department/designation/manager/employment_status as a denormalized copy of the latest history row, updated in the same transaction as the history write.
- **job_changes** — `id, employee_id*, type (promotion/transfer/demotion/reassignment), effective_date, from_department_id, to_department_id, from_designation_id, to_designation_id, from_manager_id, to_manager_id, reason, note, created_by*`
- **probation_records** — `id, employee_id*, start_date, probation_months, expected_confirmation_date, status (in_probation/confirmed/extended/failed), confirmed_on, extended_to, evaluator_id*, note`
- **employment_status_history** — `id, employee_id*, from_status, to_status, effective_date, reason, ref_type (probation/job_change/manual), ref_id, created_by*` (append-only)
- **documents** — `id, employee_id*, type (NID/contract/certificate/other), file_url, expiry_date`

### 6.2 Compensation
- **salary_components** — `id, name, code, type (earning/deduction), calc_type (fixed/percent_of_basic/percent_of_gross/remainder), default_value, is_pf_applicable, is_taxable, display_order, is_active`
- **salary_grades** *(optional templates)* — `id, name, basic_definition (percent_of_gross/fixed), rules (jsonb: component → {calc_type, value})`
- **employee_salary_structures** — `id, employee_id*, effective_from, effective_to (null = current), input_basis (basic/gross), input_amount, basic_amount, gross_amount, ctc_amount, currency, reason (initial/increment/promotion/revision), status (draft/active/superseded), approved_by*, created_by*, created_at`
- **salary_structure_lines** — `id, salary_structure_id*, component_id*, calc_type, input_value, computed_amount`
- **pf_accounts** — `id, employee_id*, pf_number, enrolled_on, employee_contrib_percent, employer_contrib_percent, pf_base (basic/gross/custom), status (active/stopped)`
- **employee_benefits** — `id, employee_id*, type (gratuity/insurance/bonus/loan/transport/other), description, value_type (amount/percent/text), value, effective_from, effective_to, note`

### 6.3 Attendance & Scheduling
- **shifts** — `id, name, type (fixed/roster), start_time, end_time, grace_minutes, half_day_threshold_minutes, working_hours`
- **schedules** — `id, employee_id*, shift_id*, work_date, is_weekend, is_holiday`
- **rosters** — `id, name, department_id*, cycle_days`
- **roster_assignments** — `id, roster_id*, employee_id*, shift_id*, work_date`
- **holidays** — `id, name, date, type (government/optional/company), is_recurring`
- **attendance_records** — `id, employee_id*, work_date, check_in_at, check_out_at, source (web/biometric/device_import/manual), status (present/late/absent/half_day/on_leave/holiday/weekend), late_minutes, early_leave_minutes, worked_minutes, note, import_batch_id*, regularized_by*` — unique on `(employee_id, work_date)`.
- **attendance_regularizations** — `id, attendance_record_id*, reason, requested_by*, approval_id*`
- **import_batches** — `id, type (attendance), file_name, file_url, uploaded_by*, status (uploaded/validated/partially_imported/imported/failed), total_rows, success_rows, error_rows, started_at, finished_at`
- **import_rows** — `id, import_batch_id*, row_number, raw (jsonb), matched_employee_id*, parsed (jsonb), status (ok/warning/error), message`

### 6.4 Approvals
- **workflows** — `id, name, entity_type (leave/requisition/travel_request/travel_settlement/expense_claim/regularization), is_active`
- **workflow_steps** — `id, workflow_id*, step_order, approver_type (line_manager/manager_chain_level/role/specific_user/department_head), approver_ref, min_metric_value (nullable), max_metric_value (nullable), is_mandatory, sla_hours` — `min/max_metric_value` gate whether the step applies for a given approval (threshold-based conditional routing); a step whose window doesn't include the approval's `metric_value` is skipped automatically.
- **approvals** — `id, workflow_id*, entity_type, entity_id, current_step, status (pending/approved/rejected/cancelled), requested_by*, metric_value (nullable, e.g. leave days / claim amount / trip cost), approved_amount (nullable — the finance/audit override, if any), created_at`
- **approval_actions** — `id, approval_id*, step_order, actor_id*, action (approve/reject/return/comment), approved_amount (nullable — per-step override), comment, acted_at` (append-only)

### 6.5 Leave
- **leave_types** — `id, name, code, is_paid, requires_document, accrual_method (none/monthly/yearly), default_days_per_year, max_carry_forward, allow_negative_balance, color`
- **leave_policies** — `id, leave_type_id*, applies_to (employment_type/department), days_per_year, accrual_rate`
- **leave_balances** — `id, employee_id*, leave_type_id*, year, entitled, accrued, used, pending, carried_forward, available`
- **leave_applications** — `id, employee_id*, leave_type_id*, start_date, end_date, days_count, is_half_day, reason, document_url, status (draft/pending/approved/rejected/cancelled), approval_id*`
- **leave_ledger** — `id, employee_id*, leave_type_id*, change, balance_after, source (accrual/application/adjustment/carry_forward), ref_id, created_at` (append-only)

### 6.6 Requisition
- **requisitions** — `id, requester_id*, type (asset/purchase/recruitment), title, description, priority, needed_by, estimated_cost, status, approval_id*`
- **requisition_items** — `id, requisition_id*, name, quantity, unit_cost, note`

### 6.7 Travel & Expense

Travel and Expense are **two distinct flows**, not one:
- **Travel** collects the whole cost of a trip (transport + lodging + meals + misc) with a category per line item.
- **Expense** is out-of-pocket reimbursement ("I paid for something, pay me back") — items have no category, just a description.

- **travel_requests** — `id, employee_id*, purpose, from_date, to_date, estimated_cost (sum of items), advance_requested, approved_advance_amount (nullable — Finance's actual approved advance), status (draft/pending/approved/rejected/cancelled), settlement_status (none/pending/approved/rejected/locked), actual_cost (nullable — settlement total), net_adjustment (nullable — actual − approved advance), settlement_locked_at (nullable), settlement_locked_by (nullable), approval_id*`
- **travel_request_items** — `id, travel_request_id*, destination, category (TravelCostCategory: travel/lodging/meals/misc), transport_mode (nullable; meaningful only when category=travel), travel_date_from, travel_date_to, estimated_cost, actual_cost (nullable — filled at settlement), is_planned (default true; false for costs added only during settlement), note`
- **expense_claims** — `id, employee_id*, travel_request_id* (nullable), title, total_amount, approved_amount (nullable — approver's override), currency, status (draft/pending/approved/rejected/cancelled/reimbursed), approval_id*, reimbursed_at, reimbursement_ref`
- **expense_items** — `id, expense_claim_id*, description, amount, spent_on` — no category, no per-item receipt column (see `attachments` in §6.8)

**Settlement modeling.** A trip has two approvals over its life: pre-trip advance (`ApprovalEntityType.TravelRequest`) and post-trip settlement (`ApprovalEntityType.TravelSettlement`). Both share the same `entity_id` (the `travel_request.id`); different `entity_type` prevents collision. No separate `travel_settlement` table — the settlement fields live on `travel_requests`.

**Edit restarts approval.** Editing a pre-trip request, submitting a settlement, or editing an expense claim all cancel the previous approval and start a fresh one at step 1, via `apps/api/src/common/utils/restart-approval.util.ts`. `settlement_locked_at` marks that money was paid out — a locked settlement can still be amended, but doing so reopens it and restarts approval.

### 6.8 System
- **notifications** — `id, user_id*, type, title, body, link, is_read, created_at`
- **audit_logs** — `id, actor_id*, action, entity_type, entity_id, diff (jsonb), ip, created_at` (append-only)
- **attachments** — `id, owner_type (AttachmentOwnerType: travel_request_item/expense_item), owner_id, file_url, file_name, mime_type, file_size_bytes, uploaded_by*, created_at`. Polymorphic (`owner_type`/`owner_id`, no FK — same pattern as `audit_logs`), used by both Travel items and Expense items so there's only one upload/list/download pipeline (`AttachmentsModule`). MIME allowlist: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`; 5 MB max. `POST /attachments/stage` uploads without a DB row (parent may not exist yet); the row is persisted by the owning item's create/update transaction.
- **request_change_logs** — `id, entity_type (ChangeEntityType: travel_request/expense_claim), entity_id, changed_by*, change_summary (text), diff (jsonb), created_at` (append-only). Written by the travel/expense edit paths; surfaced by `GET /travel/:id/changes` and `GET /expenses/:id/changes`.
- **settings** — `id, key, value (jsonb)` — seed: `org_name, timezone, working_week, currency, fiscal_year_start, basic_to_gross_min_ratio (default 0.50), allow_self_salary_view (default false)`

---

## 7. Approval engine spec

Build one reusable engine. Do not duplicate approval logic in feature modules.

- Expose `ApprovalService.start({ entityType, entityId, requesterId })`. It finds the active `workflow` for `entityType`, creates an `approval` at `current_step = 1`, and resolves the step-1 approver (e.g. requester's `line_manager_id`, a role, a department head, or a specific user, per `workflow_steps.approver_type`).
- Expose `act({ approvalId, actorId, action, comment, approvedAmount? })` where action ∈ `approve | reject | return | comment`. `approve` advances to the next mandatory step or finalizes; `reject` ends as rejected; `return` sends back to the requester for edits. Record every action in `approval_actions`.
- **Approver amount override:** any `approve` may include an optional `approvedAmount` (finance/audit discretion — approve $400 of a $500 advance). It's persisted on both the `approval_action` and (as the latest-wins current value) `approval.approved_amount`. Included in `ApprovalFinalizedEvent` as `approvedAmount`. Feature listeners apply their own fallback (travel → `advance_requested`, expense → `total_amount`); the engine stays domain-agnostic.
- **Metric-based conditional routing:** `start()` accepts an optional `metricValue` (leave days / claim amount / trip cost). During step resolution, any `workflow_step` whose `min_metric_value`/`max_metric_value` window excludes the approval's `metric_value` is skipped — no approver is resolved and the engine moves to the next step. This is how threshold escalation (e.g. only route to VP when amount > 1000) is expressed as config rather than code.
- On finalization, emit a domain event (`approval.approved` / `approval.rejected`) via NestJS `EventEmitter2`. Feature modules listen and apply their side effects (e.g. leave deducts balance, expense becomes reimbursable, travel sets `approved_advance_amount` or `settlement_status`). The engine never imports feature modules.
- **Edit restarts approval:** editing a pre-trip travel request, submitting a settlement, or editing an expense claim all go through `restartApproval(...)` (`apps/api/src/common/utils/restart-approval.util.ts`) — cancel the previous approval (if pending) and start a fresh one at step 1. Every change is also written to `request_change_logs`.
- Provide a unified **"My Approvals"** query returning all pending approvals routed to a given user across all entity types.
- Adding a new approvable type later must require only a new `entityType` value + workflow config + an event listener — no changes to the engine.

---

## 8. Salary calculator spec

Implement a single `SalaryCalculatorService`. HR provides **either** a Basic **or** a Gross amount (`input_basis`); derive everything else and store the resolved lines.

**Component calc types:** `fixed` (flat amount), `percent_of_basic` (value% × basic), `percent_of_gross` (value% × gross), `remainder` (absorbs the leftover; typically Basic).

**If `input_basis = basic`:**
1. `basic_amount = input_amount`.
2. Compute each earning component: `fixed` → its amount; `percent_of_basic` → value% × basic.
3. `gross_amount = basic_amount + Σ(allowance earnings)`.

**If `input_basis = gross`:**
1. `gross_amount = input_amount`.
2. Compute `percent_of_gross` and `fixed` earnings first.
3. The `remainder` component (usually Basic) = `gross_amount − Σ(other earnings)`.
4. Validate `basic_amount ≥ basic_to_gross_min_ratio × gross_amount` (ratio from `settings`, default 0.50). If it fails, reject with a clear validation error.

**Deductions & PF:**
- Deduction components reduce net pay: `net = gross − Σ deductions`.
- PF: compute `pf_base` per `pf_accounts.pf_base` (default Basic). Employee PF = `employee_contrib_percent × pf_base` (a deduction line). Employer PF = `employer_contrib_percent × pf_base` (tracked, not deducted from employee).

**Persistence:** write each resolved component to `salary_structure_lines` with its `computed_amount` at save time. Never recompute historical revisions on read. A new revision (increment/promotion/revision) sets the prior structure's `effective_to` and `status = superseded` and inserts a new `active` row in the same transaction.

Unit-test: basic-input path, gross-input path, the remainder/ratio validation (pass and fail), PF computation, and a structure with mixed earning + deduction components.

---

## 9. Attendance status & import spec

**Daily status resolver:** for each employee/day, resolve `status` by combining schedule (shift or weekend), holiday calendar, approved leave, and punches:
- weekend → `weekend`; holiday → `holiday`; approved leave covering the day → `on_leave`; no punch on a working day → `absent`.
- Punched: compare `check_in_at` to shift start + `grace_minutes` → `late` with `late_minutes`; compare `check_out_at` to shift end → `early_leave_minutes`; if worked time below `half_day_threshold_minutes` → `half_day`; otherwise `present`. Compute `worked_minutes`.
- Run the resolver after live clock-out and after an import commit.

**Device / Excel import pipeline** (never bulk-insert blindly):
1. **Upload** an xlsx/csv exported from the attendance device → create an `import_batch` (`status = uploaded`). Parse with SheetJS (`xlsx`) on the backend.
2. **Map & parse**: support a saved column-mapping per device format (employee/device id, date, punch time(s)). Collapse multiple punches in a day to first-in / last-out. Write each parsed row to `import_rows`.
3. **Validate** (`status = validated`): match each row to an employee by `employee_code`, falling back to `device_user_id`. Flag unmatched ids, duplicate days, and out-of-range times as `warning`/`error` with a message. Do not write to `attendance_records` yet.
4. **Commit**: upsert confirmed rows into `attendance_records` (`source = device_import`, `import_batch_id` set), unique on `(employee_id, work_date)` so re-importing a day updates rather than duplicates. Then run the status resolver over the affected days. Set the batch to `imported` or `partially_imported`.
- Support **rollback** of a batch: delete or revert `attendance_records` linked to that `import_batch_id`.

Live clock in/out and device imports share the same `attendance_records` table, distinguished by `source`.

---

## 10. Design system to implement

Modern, clean, calming. Cool low-saturation palette, generous whitespace, one quiet accent. Implement as CSS variables in `globals.css` mapped to shadcn theme tokens. shadcn's setup uses OKLCH — convert these hex values when wiring the theme.

**Palette — light:**
| Token | Hex | Use |
|-------|-----|-----|
| background | `#F6F8F9` | app canvas (cool off-white) |
| surface / card | `#FFFFFF` | cards, panels, tables |
| border / muted | `#E4E9ED` | dividers, input borders |
| foreground | `#1E2A32` | primary text (deep slate) |
| muted-foreground | `#5C6B76` | secondary text, labels |
| primary | `#2C7A78` | buttons, active nav, links (calm teal) |
| primary-hover | `#246360` | hover/pressed |
| primary-soft | `#E5F0EF` | tints, selected rows |
| success | `#4C9A77` | approved, present (sage) |
| warning | `#D6A14A` | pending, late (muted amber) |
| danger | `#C26D6D` | rejected, absent (softened rose) |
| info | `#6B8CCF` | informational chips (soft periwinkle) |

**Palette — dark:** canvas `#121A1F`, surface `#18242B`, primary `#3FA39F`, foreground `#E6EDF0`. Dark mode reads like dusk, not black. Implement light + dark.

**Typography:**
- Display/headings: **Plus Jakarta Sans**. Body/UI: **Inter**. Data/times/amounts: Inter with `font-variant-numeric: tabular-nums`. IDs/codes: a mono (JetBrains Mono) only.
- Type scale: 12 / 14 (base) / 16 / 20 / 24 / 30 / 36. Headings semibold, body normal, body line-height 1.5.

**Layout & feel:**
- App shell: collapsible left sidebar + slim top bar (search, notifications bell, avatar). Keep the shell conventional and predictable.
- 8px spacing grid. Cards `rounded-2xl` with a single soft `shadow-sm` — never heavy borders and shadows together. Comfortable density with an optional compact toggle for data-heavy tables.
- Make the **leave/attendance calendar** the most polished view: color-coded by leave type using each type's `color`, smooth hover detail.
- Quality floor: responsive to mobile, visible keyboard focus rings, honor `prefers-reduced-motion`, every empty state tells the user the next action.
- Motion: subtle only — 150–200ms fades on route/modal, gentle row hover. No bounce, no confetti.

---

## 11. Build phases

Each phase below lists **Backend**, **Frontend**, and **Tests** checklist items. Update the marker on each item as you work, and commit the updated spec with the code so this file stays an accurate, live picture of progress.

**Status markers:**
- `[ ]` not started
- `[~]` in progress
- `[x]` done
- `[!]` blocked (note the blocker inline)

**Parallelization rule:** a phase may start once its dependencies are `[x]`. Within a phase, after the shared types/DTO contract is added, the Backend and Frontend tracks run concurrently. Independent phases run concurrently. Do not begin a phase whose dependencies are unmet.

**Dependency map (what gates what):**
- **Phase 0 Foundation** → gates everything.
- **Phase 1 Auth & RBAC** → gates everything after it.
- **Phase 2 Employees** → gates 3, 5, 6, 7, 8 (they reference employees).
- **Phase 4 Approval Engine** → gates the *approval* parts of 5, 6 (regularization), 7, 8.
- **Independent after their gate is met (build in parallel):**
  - After Phase 2: **Phase 3 Compensation**, **Phase 4 Approval Engine**, and the **non-approval core of Phase 6 Attendance** (shifts, schedules, clock in/out, import) can all run at the same time.
  - After Phase 4: **Phase 5 Leave**, **Phase 7 Requisition**, **Phase 8 Travel & Expense**, and **Phase 6's regularization flow** can all run at the same time.
- **Phase 9 Dashboards/Reports/Notifications** depends on the feature phases it summarizes; build each dashboard card as its source phase lands.
- **Phase 10 Hardening** runs last but its sub-items (audit logging, a11y, responsive) can be applied incrementally as phases complete.

> A practical parallel path: finish 0 → 1 → 2, then run **3 + 4 + 6(core)** together; once 4 is `[x]`, run **5 + 7 + 8** together; fold in 9 and 10 continuously.

### Phase 0 — Foundation
*Dependencies: none.*
Backend:
- [x] Init pnpm + turborepo monorepo: `apps/api` (NestJS), `apps/web` (Next.js App Router TS), `packages/types`, `packages/config`.
- [x] Connect to a local PostgreSQL instance via env vars; provide an `.env.example` and document the expected local DB (name, user) in `CLAUDE.md`. No Docker.
- [x] Wire TypeORM `DataSource` (`synchronize: false`); one trivial entity + first migration; run it.
- [x] zod-validated env config; global exception filter (error envelope); `/health` endpoint.

Frontend:
- [x] Tailwind + shadcn/ui in `apps/web`; implement §10 tokens (light + dark) and fonts.
- [x] App shell: collapsible sidebar + top bar with placeholder nav.

Tests:
- [x] Lint + typecheck pass across the monorepo.

**Acceptance:** both apps run; web shows the themed shell in light and dark mode; `/health` returns ok; a migration has run against Postgres; lint and typecheck pass.

### Phase 1 — Auth & RBAC
*Dependencies: Phase 0.*
Backend:
- [x] Entities `users, roles, permissions, role_permissions, user_roles`; migration.
- [x] Seed five roles (§5), base permissions, one super admin (start the seed script).
- [x] Argon2 hashing; JWT access + rotating refresh (refresh in HTTP-only cookie); login/refresh/logout.
- [x] `@Roles()`/`@Permissions()` guards + `CurrentUser` decorator.

Frontend:
- [x] Login page; auth context; protected routes.
- [x] Role-aware sidebar (hides items the role lacks); token-refresh interceptor.

Tests:
- [x] Unit: AuthService (valid login, wrong password, user not found) — 3 tests pass.

**Acceptance:** can log in as super admin; protected endpoints reject unauthorized access with the error envelope; refresh rotates tokens; sidebar hides items the role lacks.

### Phase 2 — Org & Employee Management
*Dependencies: Phase 1.*
Backend:
- [x] Entities `departments, designations, employees, job_changes, probation_records, employment_status_history, documents`; migration.
- [x] Employee/department/designation CRUD with validation, pagination, search, filter.
- [x] Create-employee provisions a `user` + invite (stub email).
- [x] Promotion/transfer action (writes `job_changes`, updates current employee fields in one transaction).
- [x] Probation flow (confirm/extend/fail → `employment_status_history`, flips `employment_status`); scheduled "confirmations due" check.

Frontend:
- [x] Employee directory (table + filters, pagination).
- [x] Employee profile tabs: personal / job & history / probation.
- [x] Department (`/departments`) & designation (`/designations`) management screens, each in the sidebar's People group. Designations are scoped under a department (nullable FK): the designations screen groups titles by department with a department filter, and the employee create/job-change forms filter the designation dropdown to the chosen department (plus org-wide/unassigned titles).
- [x] "Confirmations due" HR widget on dashboard.

Tests:
- [x] Unit: job change writes history, probation confirm/extend/fail, not-found guard — 5 tests pass.

**Acceptance:** HR adds an employee on probation, later confirms them, records a promotion and a department transfer; the profile shows a dated history and the employee can log in.

### Phase 3 — Compensation
*Dependencies: Phase 2. Runs in parallel with Phases 4 and 6(core).*
Backend:
- [x] Entities `salary_components, salary_grades, employee_salary_structures, salary_structure_lines, pf_accounts, employee_benefits`; migration.
- [x] `SalaryCalculatorService` per §8 (basic-input, gross-input, remainder/ratio guard, PF).
- [x] APIs: components/grades admin; revision-controlled employee salary structures; salary history; PF; benefits. Restrict to HR/Finance/Super Admin.

Frontend:
- [x] Salary-component admin screen.
- [x] Salary-structure builder (choose Basic or Gross; live breakdown of every slab + net + PF).
- [x] Salary history timeline; PF & benefits panel on the profile.

Tests:
- [x] Unit: `SalaryCalculatorService` (basic-input, gross-input, PF, ratio pass+fail, mixed earning/deduction).

**Acceptance:** entering a Gross for one employee and a Basic for another both yield correct breakdowns + PF; the ratio guard rejects an invalid gross split; a revision supersedes the prior one without losing history; non-privileged roles cannot read salary.

### Phase 4 — Approval Engine
*Dependencies: Phase 1 (uses users/roles). Runs in parallel with Phases 3 and 6(core).*
Backend:
- [x] Entities `workflows, workflow_steps, approvals, approval_actions`; migration.
- [x] `ApprovalService` (§7): start, act (approve/reject/return/comment), step resolution, `EventEmitter2` events.
- [x] Seed default workflows per entity type; "My Approvals" query.

Frontend:
- [x] Unified "My Approvals" inbox.
- [x] Reusable approval-timeline component.

Tests:
- [x] Unit: step advancement, finalization events.

**Acceptance:** a test approval routes through multiple steps; approve/reject/return behave correctly; finalization emits an event; "My Approvals" shows only approvals routed to the current user.

### Phase 5 — Leave Management
*Dependencies: Phases 2, 4. Runs in parallel with Phases 7 and 8.*
Backend:
- [x] Entities `leave_types, leave_policies, leave_balances, leave_applications, leave_ledger`; migration.
- [x] Accrual (monthly/yearly); balance computation; day-counting that skips weekends + holidays; half-day support.
- [x] Submit leave → start approval; on `approval.approved` write `leave_ledger` + adjust balance; on reject release pending.

Frontend:
- [x] Leave-type & policy admin.
- [x] "Apply for leave" form with live balance + day preview.
- [x] My-leave history; balance cards.
- [x] Team leave calendar (signature view, color-coded by leave type).

Tests:
- [x] Unit: accrual, day counting (weekend/holiday exclusion), ledger math.

**Acceptance:** an employee applies, a manager approves, the balance updates with a correct ledger trail; day counting excludes weekends/holidays; rejecting releases pending balance.

### Phase 6 — Attendance & Scheduling
*Dependencies: Phase 2 for the core; the regularization flow also needs Phase 4. Core runs in parallel with Phases 3 and 4.*
Backend (core):
- [x] Entities `shifts, schedules, rosters, roster_assignments, holidays, attendance_records`; migration.
- [x] §9 status resolver; clock in/out; HR manual entry.
- [x] Entities `import_batches, import_rows`; device/Excel import pipeline (upload → map → validate → commit → rollback) using SheetJS.

Backend (needs Phase 4):
- [x] `attendance_regularizations` → approval engine.

Frontend:
- [x] Clock-in widget; my-attendance month view; team attendance grid.
- [x] Shift/roster builder; holiday admin.
- [x] Import screen (upload → column mapping → preview with error highlighting → confirm).

Tests:
- [x] Unit: status resolver (11 tests); import matching/parsing (8 tests) — 19 tests pass.

**Acceptance:** a late fixed-shift clock-in shows `late` with minutes; a roster team has per-day shifts; an approved leave auto-marks the day; HR uploads a device export, sees unmatched/duplicate rows flagged, commits valid rows, and a re-import updates rather than duplicates.

### Phase 7 — Requisition
*Dependencies: Phases 2, 4. Runs in parallel with Phases 5 and 8.*
Backend:
- [x] Entities `requisitions, requisition_items`; migration; submit → approval engine.

Frontend:
- [x] New requisition form (line items); my requisitions; approval view; admin list.

Tests:
- [x] Integration: submit → approve flow to a final state.

**Acceptance:** an asset requisition with items routes through its approval chain to a final state.

### Phase 8 — Travel & Expense
*Dependencies: Phases 2, 4. Runs in parallel with Phases 5 and 7.*
Backend:
- [x] Entities `travel_requests, travel_request_items, expense_claims, expense_items`; migration.
- [x] Travel request → approval (pre-trip); expense claim (optionally linked to a trip) → approval → Finance marks reimbursed.
- [x] Post-trip settlement flow: `PATCH /travel/:id/settlement` (compute `net_adjustment`, restart approval as `TravelSettlement`), `POST /travel/:id/settlement/lock` (Finance-only, `Permission.TravelSettle`).
- [x] Shared `AttachmentsModule` (polymorphic `attachments` table; `POST /attachments/stage`, `GET /attachments`, `GET /attachments/:id/file`, `DELETE /attachments/:id`) — image/PDF, 5 MB, MIME-validated. Replaces the earlier single-`receipt_url` field on expense items.
- [x] Shared `ChangeLogModule` (`request_change_logs`); edit paths on travel/expense write per-item diffs.
- [x] `PATCH /travel/:id` and `PATCH /expenses/:id` edit endpoints — diff items, restart approval via `restartApproval(...)`, record change-log entry.
- [x] Approver amount override on the engine: `ActApprovalDto.approvedAmount`, `Approval.approved_amount`, `ApprovalActionRecord.approved_amount`, `ApprovalFinalizedEvent.approvedAmount`. Applied by travel (`approved_advance_amount`) and expense (`approved_amount`) event listeners with correct fallback.

Frontend:
- [x] Travel request form with per-item **category** (Travel/Lodging/Meals/Misc), **date range** (from/to), and **multi-file attachments** (`AttachmentUploader`); segmented Full/Partial advance control.
- [x] Expense claim builder — description + amount + spent_on + multi-file receipts. No category (out-of-pocket reimbursement doesn't need one).
- [x] Trip detail page: items table (with actual-vs-estimated when settling), Settlement card (submit adjustment, Finance-only Lock, its own `ApprovalTimeline`), `ChangeHistoryTimeline` (keyed on `updatedAt` to refetch after in-page mutations).
- [x] Edit pages for both trip and expense claim (reachable while status is still editable; saving restarts approval).
- [x] "My Approvals" shows "Requested $X" and an optional "Approved amount" input for `travel_request`/`travel_settlement`/`expense_claim` types.
- [x] Finance reimbursement screen.

Tests:
- [x] Integration: travel approval, expense approval, reimbursement, settlement submit/lock/reopen, edit-restarts-approval for both flows, approver amount override applied with correct per-feature fallback, attachment MIME/size validation and ownership-based access.

**Acceptance:** a trip is pre-approved (with an optional approver amount override); the settlement flow reconciles actual vs. estimated with its own Finance approval and lockable state; editing any pending/approved trip or claim restarts approval and appears in the change history; both flows support multiple optional image/PDF attachments per line item, viewable in-app.

### Phase 9 — Dashboards, Reports & Notifications
*Dependencies: the feature phases each card/report summarizes — build incrementally as those land.*
Backend:
- [x] `notifications` table + service; emit on submit/approve/reject; email stubs.
- [x] Export endpoints (CSV/Excel): attendance, leave balances, salary summary, expenses.

Frontend:
- [x] Role dashboards: Employee (my day/balances/pending), Manager (team status), HR (org metrics + confirmations due), Finance (pending reimbursements).
- [x] Notifications bell + list; export buttons.

Tests:
- [x] Integration: events create notifications; each export returns correct data.

**Acceptance:** each role lands on a relevant dashboard; key events create notifications; each export downloads with correct data.

### Phase 10 — Hardening & Polish
*Dependencies: applied incrementally across all phases; finalized last.*
Backend:
- [x] `audit_logs` on all mutations; rate limiting (auth + import); input sanitization; error envelope everywhere.
- [x] `settings` CRUD (timezone, working week, currency, fiscal year, ratios); data-retention rule for terminated employees.

Frontend:
- [x] Settings screen; accessibility pass; dark-mode verification; empty/loading/error states; mobile responsiveness pass.

Tests:
- [x] E2E (Playwright): login; apply for leave + approve as manager; clock in/out; upload + commit an attendance import.
- [x] CI green: typecheck, lint, test, build.

**Acceptance:** mutations are audited; settings drive behavior (timezone affects attendance, ratio affects salary validation); a11y and responsive checks pass; seed produces a fully populated demo; CI is green.

### Phase 11 — Asset Management
*Dependencies: Phase 2 (Employees), Phase 4 (Approvals), Phase 9 (Notifications), Phase 10 (Hardening/Settings). Backend + frontend proceed in parallel once shared enums land in packages/types. Not in the original v1 scope — added later once the org needed real asset tracking beyond the "asset requisition" placeholder.*

Backend:
- [x] Extend shared enums in packages/types: AssetTrackingMode, AssetHolderType, AssetUnitStatus, AssetMovementType, AssetPurchaseStatus, AssetMaintenanceOutcome, DepreciationMethod; ApprovalEntityType += AssetAssignment; AttachmentOwnerType += AssetUnit, AssetPurchase; ChangeEntityType += AssetUnit; Permission += asset.*.
- [x] Entities under apps/api/src/database/entities/assets/: asset_categories, asset_locations (self-FK), asset_conditions, asset_units (with 3-nullable-FK holder + CHECK), asset_stock (unique on category+location), asset_movements (append-only), asset_purchases, asset_purchase_items, asset_maintenance_records; migration AddAssetsModule.
- [x] AssetsModule with CategoriesService, LocationsService, ConditionsService, UnitsService, StockService, PurchasesService, MaintenanceService, AssetsEventsListener, AssetsNotificationsListener, AssetsImportService; wired into AppModule.
- [x] PurchasesService.receive: transactional creation of N asset_units (auto-tag from settings) OR asset_stock bump per line, plus asset_movements rows.
- [x] UnitsService.requestAssign saves marker first, starts an AssetAssignment approval with metricValue = purchase_cost, then commits inline if auto-approved (fixes the sync-emit-before-marker race). @OnEvent('approval.approved') commits holder change when a real approver is in the loop.
- [x] StockService.listIssued + `GET /assets/stock/issued` — consumable-issuance ledger (who received what, how many, from where, by whom), dispatching the polymorphic `to_holder_id` against employees / departments / asset_locations via a raw join.
- [x] Extended AttachmentsService.resolveOwnerEmployeeId with AssetUnit + AssetPurchase arms.
- [x] Notifications: AssetAssignment approval (via generic engine listener), low-stock crossings, warranty-expiring-30d (nightly).
- [x] Seed extension: sample categories (Laptop/Chair/Desk/Pen/Notebook), locations (HQ→Floor 1→Room A/B), conditions (New/Good/Fair/Damaged), one AssetAssignment workflow, settings keys (asset_tag_prefix=HRM-, asset_tag_next_number=1, low-stock default=10, purchase-without-requisition threshold=1000). Role permissions granted to Employee/LineManager/HRAdmin/Finance. Also gives admin@hrm.local (super admin) an employee profile (EMP-SA-001) so requester-scoped actions don't fail with "Employee profile not found".
- [x] CSV/XLSX bulk import for existing units (idempotent by asset_tag).

Frontend:
- [x] apps/web/src/app/(shell)/assets/page.tsx — Units + Consumables tabs, filter bar (category/location/status/search), per-row View / Assign / Edit actions (Assign & Edit deep-link into the detail page via `?action=…`, which auto-opens the matching panel).
- [x] .../[id]/page.tsx — detail + assign/return/transfer/retire/maintenance/**edit** panels (edit patches name/serial/condition/notes) + History/Maintenance tabs; reads `?action=` to open a panel on load.
- [x] .../purchases/{page.tsx, new/page.tsx, [id]/page.tsx} — list, create with line items, receive UX.
- [x] Dedicated config routes (replacing the earlier single tabbed admin page): `.../categories/page.tsx`, `.../locations/page.tsx`, `.../conditions/page.tsx` — each a full CRUD list with inline create + row-level Edit / Delete / Active-toggle; `.../import/page.tsx` — CSV/XLSX bulk import. `.../admin/page.tsx` now redirects to `/assets` (bookmark safety).
- [x] .../distribution/page.tsx — where-is-what visibility: **By location** (serialized units grouped by location + a "Held" section for units checked out to employees/departments), **Consumable stock** (qty + min per category/location with a low-stock badge), **Issued to** (the consumable-issuance ledger).
- [x] .../my/page.tsx — employee-facing "my assets".
- [x] Sidebar Assets group — Inventory / Distribution / Purchases / Categories / Locations / Conditions / Bulk Import / My Assets, each permission-gated. Sidebar active-detection is most-specific-href-wins so `/assets/categories` highlights Categories, not Inventory. Every asset subpage has a Back button.

Tests:
- [~] Formal Jest suites deferred — end-to-end behavior verified live via preview: purchase→receive creates 2 serialized units with auto-tags HRM-000001/HRM-000002 + bumps pen stock, assign starts an approval and commits when it finalizes, `/assets/my` lists exactly what the user holds, issue-consumable + retire + low-stock notification all fire. Playwright coverage of the full flow is the next follow-up.

**Acceptance:** admins configure categories/locations/conditions via their dedicated sidebar routes (each with full row-level edit/delete/toggle); a purchase receive-action creates the right units (serialized) or bumps stock (consumable) in one transaction with movement rows; assignments to employee/department/location go through the AssetAssignment workflow when configured and land in the unit's movement history; the Distribution page shows where every unit is, current consumable stock levels, and the issued-to ledger; /assets/my lists a logged-in user's current holdings; low-stock notification fires below threshold; CSV import ingests pre-owned units idempotently. All verified.

---

## 12. Testing requirements

- **Unit:** leave accrual & day counting; attendance status resolver; attendance import matching/parsing; `SalaryCalculatorService` (basic-input, gross-input, PF, remainder/ratio pass+fail, mixed earning/deduction); approval step advancement; leave balance ledger math.
- **Integration (API):** auth + RBAC guards; full submit → approve → side-effect flows for leave, requisition, travel, expense, regularization; import commit + rollback.
- **E2E (Playwright):** login; apply for leave and approve as manager; clock in/out; upload and commit an attendance import.
- CI (GitHub Actions): typecheck, lint, test, build on every PR. All must pass.

---

## 13. Security requirements

- Argon2 password hashing; short-lived access tokens + rotating refresh tokens in HTTP-only cookies.
- RBAC enforced server-side on every endpoint. Salary/PII access restricted per §5.
- Never put personal or sensitive data (NID, salary, tokens) in URLs, query strings, or logs.
- Validate file uploads (type, size); store outside the webroot or in object storage with signed URLs.
- Audit every mutation. Define and implement a data-retention rule for terminated employees in settings.
- Rate-limit auth and import endpoints.