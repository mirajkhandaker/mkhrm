# HRM Project

@docs/HRM-BUILD-SPEC.md is the authoritative build spec. Follow it exactly.

- Build by the phase order and dependency map in its §11; parallelize where the map allows.
- This spec is a living tracker — update the [ ] / [~] / [x] / [!] markers as you work and commit the change with the code.
- Begin with Phase 0 and stop after each phase for review.

---

## Environment & Configuration

All ports and all DB credentials are read from `.env`. Copy `.env.example` and fill in your values — never hard-code any value in source.

### Database (backend)
| Variable | Example | Description |
|---|---|---|
| `DB_HOST` | `localhost` | Postgres host |
| `DB_PORT` | `5432` | Postgres port |
| `DB_NAME` | `shrm` | Database name |
| `DB_USER` | `postgres` | DB user |
| `DB_PASS` | `secret` | DB password |
| `DB_LOGGING` | `true` | Log raw SQL queries to console (`true`/`false`); set `false` to silence query logs |

- Engine: PostgreSQL (no Docker)
- `synchronize: false` in all environments. Use migrations only.
- The NestJS config module validates all env vars with Zod on startup; a missing var crashes fast with a clear message.

### Ports
| Variable | Default | App |
|---|---|---|
| `API_PORT` | `6000` | NestJS API (`apps/api`) |
| `PORT` | `6001` | Next.js web port (read by Next.js natively) |
| `WEB_PORT` | `6001` | Next.js web port (used by ecosystem.config.js for PM2) |

Both apps read their port from the env var at startup — no hard-coded ports in source code.

---

## Commands

### Install
```bash
pnpm install
```

`packages/config` is the shared-config source: `@hrm/config/tailwind/preset` (the §10 theme, consumed by `apps/web/tailwind.config.ts` via `presets`) and `@hrm/config/eslint/base` (plugin-free lint rules, consumed by the Next app in `apps/web/.eslintrc.js`; the API keeps its own `@typescript-eslint`-aware config).

### Run (dev)
```bash
pnpm run dev:api    # NestJS API only — port from API_PORT
pnpm run dev:web    # Next.js web only — port from WEB_PORT
pnpm run dev        # both apps concurrently (via turborepo)
```

#### PM2 (dev server)
An `ecosystem.config.js` at the repo root manages both apps under PM2:
```bash
pnpm run pm2:start      # pm2 start ecosystem.config.js
pnpm run pm2:stop       # pm2 stop ecosystem.config.js
pnpm run pm2:restart    # pm2 restart ecosystem.config.js
pnpm run pm2:logs       # pm2 logs
pnpm run pm2:delete     # pm2 delete ecosystem.config.js
```
PM2 reads ports and DB vars from `.env` via the `env` block in the ecosystem file — no extra config needed.

### Migrations
```bash
pnpm run migration:generate --name=MigrationName   # generate a new migration
pnpm run migration:run                              # run pending migrations
pnpm run migration:revert                           # revert last migration
```

### Seed
```bash
pnpm run seed
```

### Test
```bash
pnpm run test:api       # API unit tests
pnpm run test:api:e2e   # API integration tests
pnpm run test:web       # frontend unit tests
pnpm run test           # all via turborepo
pnpm run test:e2e       # Playwright E2E (login, leave apply+approve, clock in/out, attendance import)
```
`test:e2e` expects the API and web dev servers reachable at their configured ports (it will
start them via `pnpm --filter <app> run dev` if they aren't already running) and a seeded
dev database (`pnpm run seed`).

### Lint & Typecheck
```bash
pnpm run lint
pnpm run typecheck
```

---

## §4 — Engineering Conventions

Apply these in every phase without exception.

- **One entity per file** under `apps/api/src/database/entities/{domain}/` (e.g. `auth/`, `employees/`, `compensation/`, `system/`). Table names `snake_case` via `@Entity({ name: '...' })`. Modules import entities from `../../database/entities/{domain}/entity-name.entity`. Use the repository pattern in services — no query logic in controllers.
- **Migrations** are always auto-generated (`pnpm run migration:generate --name=Name`) — never hand-written. `synchronize: false` in all environments; entity decorators alone do not create tables.
- **Shared vocabulary** lives in `packages/types`: all status strings, enums, component types, and roles. Backend entities and frontend both import from there. Never duplicate an enum.
- **Validation:** every endpoint uses DTOs with `class-validator`. Global pipe: `whitelist: true, forbidNonWhitelisted: true`. Reject unknown fields.
- **Error envelope:** all errors return `{ statusCode, error, message, details? }`. Implemented via a global exception filter.
- **RBAC:** `@Roles()` / `@Permissions()` guards on every non-public endpoint. Frontend hides inaccessible controls, but security is enforced server-side regardless.
- **Money:** store as `numeric(14,2)` columns or integer minor units — never floats. Round only at defined calculation points.
- **Dates/times:** store timestamps in UTC. Resolve attendance against the org timezone from `settings`. Use date-only columns for `work_date`, `effective_from`, etc.
- **Immutability:** `leave_ledger`, `employment_status_history`, `audit_logs`, and `approval_actions` are append-only. Never `UPDATE` or `DELETE` rows in them.
- **Derived values that must stay historically fixed** (salary line amounts, leave days counted) are computed once and stored — never recomputed on read.
- **Frontend:** use shadcn/ui components, never raw HTML form controls. Every list/table must have loading, empty, and error states. Use §10 tokens for all color and typography — no ad-hoc hex values in components.
- **Copy:** plain active voice. Buttons name the action ("Apply for leave", "Approve", "Submit claim"); success toasts echo the verb; error messages state what went wrong and how to fix it.
- **Commit** after each working slice. Write the tests listed per phase before marking the phase done.

---

## Travel & Expense architecture

Two adjacent-but-distinct flows, not one shared one. Keep them separate in code and UI.

- **Travel** = collect the whole cost of a trip. `travel_request` + `travel_request_items` (one per cost line). Each item carries a `TravelCostCategory` (`travel`/`lodging`/`meals`/`misc`) and a **date range** (`travel_date_from`, `travel_date_to`) — a hotel or per-diem line can span days.
- **Expense** = "I paid for something myself, reimburse me." `expense_claims` + `expense_items`. Items are just `description` + `amount` + `spent_on` — **no category**. `TravelCostCategory` is Travel-only and must not be imported into expense code.

### Pre-trip vs. settlement (Travel)

- A trip has two approvals over its life: the pre-trip advance (`ApprovalEntityType.TravelRequest`) and a post-trip settlement (`ApprovalEntityType.TravelSettlement`). Both use the same `entity_id` (the `travel_request.id`) — different `entity_type` avoids collision.
- Settlement lives on `travel_request` itself (`settlement_status`, `actual_cost`, `net_adjustment`, `settlement_locked_at/by`) — no separate table.
- `approved_advance_amount` is what Finance actually approved (may differ from `advance_requested` if the approver overrode it).

### Approver amount override (engine-level)

- `Approval` and `ApprovalActionRecord` have a nullable `approved_amount` column; `ActApprovalDto` accepts an optional `approvedAmount`. On approve, the latest override wins.
- `ApprovalFinalizedEvent` carries `approvedAmount`; feature listeners apply their own fallback (`travelRequest.advanceRequested`, `claim.totalAmount`).
- The engine stays domain-agnostic — do **not** import feature modules into `approvals/`.

### Edit-restarts-approval (uniform rule)

Editing a pre-trip travel request, submitting a settlement, or editing an expense claim all go through `apps/api/src/common/utils/restart-approval.util.ts` — cancels the previous approval (if pending) and starts a fresh one at step 1. Status resets to Pending. `settlement_locked_at` marks that money was paid out, not that edits are forbidden — resubmitting a locked settlement reopens it and restarts approval.

### Shared modules

- `apps/api/src/modules/attachments/` — one table (`attachments`, polymorphic `owner_type`/`owner_id`, no FK). `POST /attachments/stage` uploads without a DB row (image/jpeg, image/png, image/webp, application/pdf; 5 MB max), returning metadata the parent form persists on submit. `GET /attachments/:id/file` streams with an owner-resolved access check. Both travel items and expense items use it — do not build a per-parent receipt pipeline.
- `apps/api/src/modules/change-log/` — one table (`request_change_logs`, `entity_type`/`entity_id`, `change_summary` + `diff` jsonb). Append-only. Exposed via `GET /travel/:id/changes` and `GET /expenses/:id/changes`. Rendered by `ChangeHistoryTimeline` in the frontend; parents must use `key={entity.updatedAt}` to force refetch after in-page mutations.

### Frontend

- `TravelRequestForm` (`apps/web/src/components/travel/travel-request-form.tsx`) is the shared form for both `/travel/new` and `/travel/[id]/edit`. Legs use a two-row layout: destination/category/transport, then from-date/to-date/cost. To-date auto-bumps when from-date moves past it.
- Expense create/edit pages have no Category select — description is the only free-text field.
- The "My Approvals" page shows a "Requested $X" hint plus an editable "Approved amount" input for `travel_request`, `travel_settlement`, and `expense_claim` types.

---

## Asset Management architecture (Phase 11)

Tracks physical assets beyond the "asset requisition" placeholder. Lives in `apps/api/src/modules/assets/` (entities under `apps/api/src/database/entities/assets/`). Reuses the shared approval / attachments / change-log / notifications infrastructure — the module never re-implements approval logic.

### Serialized vs. consumable (two tables, not one)

- **Serialized** categories (`AssetTrackingMode.Serialized` — laptops, chairs) → one `asset_units` row per physical item, each with a unique `asset_tag`, `serial_no`, `condition`, and `status`.
- **Consumable** categories (`AssetTrackingMode.Consumable` — pens, notebooks) → one `asset_stock` row per `(category, location)` holding a `quantity`. Never a per-item row. UNIQUE on `(category_id, location_id)`.
- A single `is_serialized` table was rejected — it would force ~10 nullable columns per row and block clean unique indexes.

### Polymorphic holder (nullable-FK trio + CHECK)

- A unit's current holder is an **employee**, **department** (the app's stand-in for "team"), or **location** — `current_holder_type` discriminator + `current_employee_id` / `current_department_id` / `current_location_id`, with a DB `@Check` enforcing exactly one non-null. Same shape on `asset_movements` from/to columns.
- Service/DTO layer speaks a single `Holder = { type, id }` value object — controllers never touch the three-column shape.

### Movements ledger (append-only)

- `asset_movements` records every physical change (`stock_in` / `assign` / `return` / `transfer` / `issue_consumable` / `maintenance_*` / `retire` / `write_off`). Never `UPDATE`/`DELETE` — same rule as `leave_ledger` and `audit_logs`. `unit_id` set for serialized events, `category_id` for consumable events.

### Purchase → receive (coexists with Requisitions)

- Asset-typed requisitions stay "I need this" pre-approval. `asset_purchases.linked_requisition_id` is nullable (walk-in purchases exist). **No second approval on `asset_purchases`** — `receive` is a permission-gated clerical act. A walk-in purchase whose total exceeds `asset_purchase_threshold_without_requisition` (settings, default 1000) is blocked at the service layer.
- `PurchasesService.receive` is transactional: for each line, either create N `asset_units` (serialized; tags auto-generated from settings `asset_tag_prefix` + `asset_tag_next_number`) or bump the `asset_stock` row, appending an `asset_movements.stock_in` per line and advancing the tag counter.

### Assignment approval (only AssetAssignment)

- Assigning a unit goes through `ApprovalEntityType.AssetAssignment` with `metricValue = purchase_cost`. `UnitsService.requestAssign` **saves the movement marker first**, then starts the approval, then commits inline if it auto-approved — this avoids the race where a synchronous `approval.approved` emit (no matching steps) fires before the marker row exists. When a real approver is in the loop, `@OnEvent('approval.approved')` commits the holder change.
- Retire / return / transfer are direct permission-gated actions (no approval), each appending a movement row.

### Distribution & issuance visibility

- `GET /assets/stock/issued` (`StockService.listIssued`) is the consumable-issuance ledger — who received what, how many, from where, by whom. It dispatches the polymorphic `to_holder_id` against employees / departments / asset_locations via a raw join (no FK to join on).

### Frontend routes (`apps/web/src/app/(shell)/assets/`)

- `page.tsx` — inventory browser, Units + Consumables tabs, filters, per-row View / Assign / Edit. Assign & Edit deep-link to the detail page via `?action=…`.
- `[id]/page.tsx` — unit detail; assign/return/transfer/retire/maintenance/edit panels; History + Maintenance tabs; reads `?action=` to open a panel on load.
- `distribution/page.tsx` — By location (units grouped, plus a Held section), Consumable stock (with low-stock badge), Issued to (the ledger).
- `purchases/{page,new,[id]}.tsx` — list, create with line items, receive.
- `categories/`, `locations/`, `conditions/` — **dedicated** config CRUD routes (inline create + row-level Edit / Delete / Active-toggle). `import/page.tsx` — CSV/XLSX bulk import (idempotent by `asset_tag`). `admin/page.tsx` redirects to `/assets` (legacy bookmark).
- `my/page.tsx` — employee-facing current holdings.
- Sidebar Assets group lists all of the above, permission-gated. Active-detection is most-specific-href-wins so sub-routes don't also light up Inventory. Every subpage has a Back button.

### Config & seed

- New enums in `packages/types`: `AssetTrackingMode`, `AssetHolderType`, `AssetUnitStatus`, `AssetMovementType`, `AssetPurchaseStatus`, `AssetMaintenanceOutcome`, `DepreciationMethod`. Extends `ApprovalEntityType` (+`AssetAssignment`), `AttachmentOwnerType` (+`AssetUnit`, `AssetPurchase`), `ChangeEntityType` (+`AssetUnit`), `Permission` (+`asset.*`). Never duplicate an enum.
- Settings keys: `asset_tag_prefix` (`HRM-`), `asset_tag_next_number` (`1`), `consumable_low_stock_threshold_default` (`10`), `asset_purchase_threshold_without_requisition` (`1000`).
- The seed gives the super admin `admin@hrm.local` an employee profile (`EMP-SA-001`) — requester-scoped actions (requisition, leave, travel, asset assign) resolve the actor via `employees.user_id` and fail with "Employee profile not found" for a login with no matching profile.

---

## §10 — Design Tokens

Implement as CSS variables in `apps/web/src/app/globals.css` mapped to shadcn theme tokens. shadcn uses OKLCH — convert hex values when wiring.

### Light palette

| Token | Hex | Use |
|---|---|---|
| `background` | `#F6F8F9` | App canvas (cool off-white) |
| `surface` / `card` | `#FFFFFF` | Cards, panels, tables |
| `border` / `muted` | `#E4E9ED` | Dividers, input borders |
| `foreground` | `#1E2A32` | Primary text (deep slate) |
| `muted-foreground` | `#5C6B76` | Secondary text, labels |
| `primary` | `#2C7A78` | Buttons, active nav, links (calm teal) |
| `primary-hover` | `#246360` | Hover / pressed state |
| `primary-soft` | `#E5F0EF` | Tints, selected rows |
| `success` | `#4C9A77` | Approved, present (sage) |
| `warning` | `#D6A14A` | Pending, late (muted amber) |
| `danger` | `#C26D6D` | Rejected, absent (softened rose) |
| `info` | `#6B8CCF` | Informational chips (soft periwinkle) |

### Dark palette

| Token | Hex |
|---|---|
| `background` | `#121A1F` |
| `surface` / `card` | `#18242B` |
| `primary` | `#3FA39F` |
| `foreground` | `#E6EDF0` |

Dark mode reads like dusk, not pure black. Implement both light and dark.

### Typography

| Role | Font | Notes |
|---|---|---|
| Display / headings | **Plus Jakarta Sans** | Semibold |
| Body / UI | **Inter** | Normal weight, line-height 1.5 |
| Data / times / amounts | Inter | `font-variant-numeric: tabular-nums` |
| IDs / codes | **JetBrains Mono** | Mono only |

Type scale: `12 / 14 (base) / 16 / 20 / 24 / 30 / 36` px.

### Layout & feel

- 8px spacing grid.
- Cards: `rounded-2xl` + single `shadow-sm` — never heavy borders AND heavy shadows together.
- App shell: collapsible left sidebar + slim top bar (search, notifications bell, avatar).
- Comfortable density; optional compact toggle for data-heavy tables.
- Motion: 150–200ms fades on route/modal transitions, gentle row hover. No bounce, no confetti. Honor `prefers-reduced-motion`.
- Quality floor: responsive to mobile, visible keyboard focus rings, every empty state tells the user their next action.
- **Leave/attendance calendar** is the signature polished view: color-coded by leave type `color` field, smooth hover detail.
