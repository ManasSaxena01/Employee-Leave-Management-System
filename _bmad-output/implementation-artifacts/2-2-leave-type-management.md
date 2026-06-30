---
story_id: "2.2"
story_key: "2-2-leave-type-management"
epic: 2
story: 2
title: "Leave Type Management"
status: "review"
created: "2026-06-30"
epic_title: "Admin System Configuration — Departments, Leave Types & Holidays"
baseline_commit: "NO_VCS"
---

# Story 2.2: Leave Type Management

## Status: review

## Story

**As an admin,**
I want to add, rename, and deactivate leave types with configurable annual quotas and document-required flags,
**So that** the system reflects exactly which categories of leave employees can request and what documentation each requires.

---

## Acceptance Criteria

**AC1 — Seeded predefined types are readable:**
Given the seeded database from Story 1.4,
When `GET /api/leave-types` is called,
Then the five predefined types are returned: Sick (document_required: true), Annual (document_required: false), Casual, Maternity/Paternity, Unpaid.

**AC2 — Create leave type (provisions balances per AD-15):**
Given an admin is authenticated,
When `POST /api/leave-types` is called with `{ name, defaultQuota, documentRequired }`,
Then a 201 response returns the new leave type; a `leave_balances` row at the new `defaultQuota` is created for every existing **active** employee (AD-15); a duplicate name returns 409 `{ success: false, error: "Leave type name already exists" }`.

**AC3 — Rename / change quota / change document-required:**
Given an existing leave type,
When `PATCH /api/leave-types/:id` is called to update `name`, `defaultQuota`, or `documentRequired`,
Then a 200 response reflects the update; changing `documentRequired` does not retroactively affect existing leave requests.

**AC4 — Deactivate leave type:**
Given an existing leave type,
When `PATCH /api/leave-types/:id` is called with `active: false`,
Then the leave type is deactivated; it no longer appears in the employee leave-request form (i.e. is excluded from the non-admin `GET /api/leave-types` response); existing approved requests of this type are unaffected.

**AC5 — Admin UI:**
Given the admin UI,
When the Leave Types page (`/leave-types`) is visited,
Then a CRUD table lists all leave types with columns: name, default quota (days), document required (checkbox), status; inline Edit and Deactivate actions are available; an Add Leave Type form collects name, quota, and document-required flag.

---

## ⚠️ CRITICAL — Read Before Coding

This is the **second CRUD admin feature** in this project. Story 2.1 (Department Management, status: done) established the exact pattern this story copies: `services/{resource}.ts` (plain function exports, no service-object wrapper) → `controllers/{resource}.ts` (thin, AD-10 envelope, `next(err)` on throw) → `routes/{resource}.ts` (mounted in `routes/index.ts`) → `frontend/src/features/{resource}/index.tsx` (replace the stub). Read `backend/src/services/department.ts`, `backend/src/controllers/departments.ts`, `backend/src/routes/departments.ts`, and `frontend/src/features/departments/index.tsx` in full before starting — they are your template.

### Already in place — do NOT recreate
- `frontend/src/features/leaveTypes/index.tsx` exists as a stub (`<div>Leave Types</div>`) — replace its contents, don't create a new file.
- `frontend/src/lib/types.ts` already exports `LeaveType { id, name, defaultQuota, documentRequired, active, createdAt, updatedAt }` — reuse it, don't redefine.
- `frontend/src/App.tsx` already routes `/leave-types` through `RequireRole roles={['ADMIN']}` → `LeaveTypesPage` — no router changes needed.
- `backend/src/prisma/schema.prisma` already has the `LeaveType` model and the `LeaveBalance` model with `@@unique([userId, leaveTypeId])` — no migration needed.
- `backend/src/prisma/seed.ts` already seeds the five predefined leave types (Annual, Sick, Casual, Maternity/Paternity, Unpaid) with `defaultQuota`/`documentRequired` set per FR-LT-1 — do not modify the seed.
- `backend/src/middleware/auth.ts` (`authenticate`) and `backend/src/middleware/rbac.ts` (`requireRole`) are done and tested — reuse them, don't modify.
- `backend/src/middleware/error.ts` (`errorHandler`) formats every thrown error into the AD-10 envelope — throw `Object.assign(new Error(msg), { status: 4xx })` from services and let it bubble via `next(err)`.
- `backend/src/services/leaveBalance.ts` currently exists but is an **empty stub**: `export const leaveBalanceService = {}`. This story is the first to need it (AD-15 provisioning on leave-type creation). See Guardrail 2 below for exactly what to add — do not build deduct/restore/reset logic here, that is Epic 3/4 territory.

---

## STOP — Critical Guardrails

| # | Risk | Wrong | Correct |
|---|------|-------|---------|
| 1 | **Check-then-act race on duplicate name** — Story 2.1's code review found that a `findUnique` pre-check alone is not atomic; two concurrent `POST` requests with the same name can both pass the pre-check and one will hit an unhandled Prisma `P2002`. | Relying solely on a `findUnique` check before `create()` | Pre-check with `findUnique` for a fast, friendly 409 in the common case, **and** wrap the `prisma.leaveType.create()` call in a try/catch that translates a `P2002` (Prisma's `PrismaClientKnownRequestError` with `code === 'P2002'`) into the same `Object.assign(new Error('Leave type name already exists'), { status: 409 })`. Apply the same dual-layer pattern to the rename path in `updateLeaveType`. |
| 2 | **AD-15 balance provisioning skipped or done with raw Prisma in the wrong layer** — AD-2 mandates all balance writes go through `services/leaveBalance`; AD-15 mandates a new leave type provisions a `leave_balances` row for every existing active employee. | `services/leaveType.ts` calling `prisma.leaveBalance.create(...)` directly, or skipping provisioning entirely | Add **one** function to `backend/src/services/leaveBalance.ts`, replacing the `{}` stub: `export async function provisionBalancesForNewLeaveType(leaveTypeId: string, defaultQuota: number): Promise<void>`. It queries `prisma.user.findMany({ where: { active: true }, select: { id: true } })`, then `prisma.leaveBalance.createMany({ data: users.map(u => ({ userId: u.id, leaveTypeId, balance: defaultQuota })), skipDuplicates: true })`. `services/leaveType.ts#createLeaveType` calls this **after** the leave type row is created. Do not add `deduct`/`restore`/`reset` functions here — those are Story 3.3 / Epic 4 scope. |
| 3 | Prisma calls in controller | `controllers/leaveTypes.ts` calling `prisma.leaveType.find...` directly | All Prisma access lives in `services/leaveType.ts` (and the one addition to `services/leaveBalance.ts`); controllers only parse req → call service → respond (AD-11 layering) |
| 4 | **Non-admin sees inactive types in the leave-request dropdown** — AC4 requires deactivated types to disappear from the employee-facing list. | `GET /leave-types` always returning every row regardless of role | Mirror `services/department.ts#listDepartments`: `const where = role === 'ADMIN' ? {} : { active: true }`. Admin sees everything (including inactive, for the management table); everyone else sees only `active: true`. |
| 5 | Invalid `defaultQuota` accepted | Trusting `defaultQuota` blindly, allowing negative or non-integer values to reach Prisma | In the controller, validate `defaultQuota` is a positive integer (`Number.isInteger(defaultQuota) && defaultQuota > 0`); reject with 400 `{ success: false, error: 'defaultQuota must be a positive integer' }` otherwise. Same validation applies on `PATCH` when `defaultQuota` is present in the body. |
| 6 | `documentRequired` type mismatch | Accepting `documentRequired` as a truthy string (`"true"`) instead of a real boolean | Validate `typeof documentRequired === 'boolean'` in the controller (both create and update paths), matching the `active`/`managerId` validation style already in `controllers/departments.ts#updateDepartmentController`. |
| 7 | Unbounded list response | `GET /leave-types` returning a bare array | Must return the full AD-3/AD-10 envelope: `{ success: true, data: LeaveType[], meta: { page, limit, total } }`, default `limit=20` (small dataset today, but this keeps the pagination contract uniform across every list endpoint per AD-3). |
| 8 | Route not mounted | New `leaveTypesRouter` created but never wired | Add `router.use('/leave-types', leaveTypesRouter)` to the **existing** `backend/src/routes/index.ts` (alongside the existing `/auth` and `/departments` mounts) |
| 9 | Deactivation cascades or deletes | Implementing "Deactivate" as a `DELETE` or as something that touches `leave_balances`/`leave_requests` rows | `PATCH /leave-types/:id { active: false }` only flips the `active` column. No cascading delete or update to any other table — existing balances and historical leave requests of this type are untouched, exactly like Department deactivation in Story 2.1. |

---

## Implementation Guide

### 1. `backend/src/services/leaveBalance.ts` (REPLACE the `{}` stub — additive only)

```typescript
import { prisma } from '../prisma/client.js'

// AD-15 + AD-2: provisioning a new leave type must create a leave_balances row
// for every existing active employee, and all balance writes go through this service.
export async function provisionBalancesForNewLeaveType(
  leaveTypeId: string,
  defaultQuota: number
): Promise<void> {
  const activeUsers = await prisma.user.findMany({
    where: { active: true },
    select: { id: true },
  })

  if (activeUsers.length === 0) return

  await prisma.leaveBalance.createMany({
    data: activeUsers.map((u) => ({ userId: u.id, leaveTypeId, balance: defaultQuota })),
    skipDuplicates: true,
  })
}
```

### 2. `backend/src/services/leaveType.ts` (NEW)

```typescript
import { Prisma } from '@prisma/client'
import { prisma } from '../prisma/client.js'
import { provisionBalancesForNewLeaveType } from './leaveBalance.js'

export interface LeaveTypeResult {
  id: string
  name: string
  defaultQuota: number
  documentRequired: boolean
  active: boolean
  createdAt: Date
  updatedAt: Date
}

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
}

export async function listLeaveTypes(
  role: string,
  page: number,
  limit: number
): Promise<{ data: LeaveTypeResult[]; total: number }> {
  const where = role === 'ADMIN' ? {} : { active: true }
  const [data, total] = await Promise.all([
    prisma.leaveType.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { name: 'asc' } }),
    prisma.leaveType.count({ where }),
  ])
  return { data, total }
}

export async function createLeaveType(input: {
  name: string
  defaultQuota: number
  documentRequired: boolean
}): Promise<LeaveTypeResult> {
  const existing = await prisma.leaveType.findUnique({ where: { name: input.name } })
  if (existing) {
    throw Object.assign(new Error('Leave type name already exists'), { status: 409 })
  }

  let leaveType: LeaveTypeResult
  try {
    leaveType = await prisma.leaveType.create({ data: input })
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw Object.assign(new Error('Leave type name already exists'), { status: 409 })
    }
    throw err
  }

  await provisionBalancesForNewLeaveType(leaveType.id, leaveType.defaultQuota)

  return leaveType
}

export async function updateLeaveType(
  id: string,
  updates: { name?: string; defaultQuota?: number; documentRequired?: boolean; active?: boolean }
): Promise<LeaveTypeResult> {
  const leaveType = await prisma.leaveType.findUnique({ where: { id } })
  if (!leaveType) {
    throw Object.assign(new Error('Leave type not found'), { status: 404 })
  }

  if (updates.name && updates.name !== leaveType.name) {
    const nameTaken = await prisma.leaveType.findUnique({ where: { name: updates.name } })
    if (nameTaken) {
      throw Object.assign(new Error('Leave type name already exists'), { status: 409 })
    }
  }

  try {
    return await prisma.leaveType.update({ where: { id }, data: updates })
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw Object.assign(new Error('Leave type name already exists'), { status: 409 })
    }
    throw err
  }
}
```

### 3. `backend/src/controllers/leaveTypes.ts` (NEW)

Thin controllers only — parse request, validate primitive types/ranges, call service, respond with the AD-10 envelope, `next(err)` on throw. Mirror `controllers/departments.ts` exactly. Endpoints needed:

- `listLeaveTypesController` — reads `page`/`limit` query params (default `page=1`, `limit=20`), reads `req.user.role`, calls `listLeaveTypes`, responds with `{ success: true, data, meta: { page, limit, total } }`.
- `createLeaveTypeController` — validates `name` is a non-empty string, `defaultQuota` is a positive integer, `documentRequired` is a boolean (400 on any failure), calls `createLeaveType`, responds 201.
- `updateLeaveTypeController` — reads `req.params.id` and whichever of `name`/`defaultQuota`/`documentRequired`/`active` are present in the body, validating types for each present field (same 400 rules as create), calls `updateLeaveType`, responds 200.

### 4. `backend/src/routes/leaveTypes.ts` (NEW)

```typescript
import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import {
  listLeaveTypesController,
  createLeaveTypeController,
  updateLeaveTypeController,
} from '../controllers/leaveTypes.js'

export const leaveTypesRouter = Router()

leaveTypesRouter.get('/', authenticate, listLeaveTypesController)
leaveTypesRouter.post('/', authenticate, requireRole(['ADMIN']), createLeaveTypeController)
leaveTypesRouter.patch('/:id', authenticate, requireRole(['ADMIN']), updateLeaveTypeController)
```

Mount it in `backend/src/routes/index.ts` (existing file — add two lines, don't restructure):

```typescript
import { leaveTypesRouter } from './leaveTypes.js'
// ...
router.use('/leave-types', leaveTypesRouter)
```

### 5. `frontend/src/features/leaveTypes/index.tsx` (REPLACE the stub)

Follow `frontend/src/features/departments/index.tsx` structure precisely (it is the established reference implementation — same `errorMessage()` helper, same `Modal` component, same loading/error state shape):

- Fetch `GET /leave-types` via `apiClient` on mount (and after any mutation).
- Render a table: Name | Default Quota | Document Required | Status | Actions (Edit, Deactivate/Activate).
- "Add Leave Type" button opens a modal with: name input, default quota number input, document-required checkbox.
- On submit: `POST /leave-types { name, defaultQuota, documentRequired }`.
- Edit modal: pre-fill name, defaultQuota, documentRequired; `PATCH /leave-types/:id` with whatever changed (diff-based, like the Department edit modal).
- Deactivate button: `PATCH /leave-types/:id { active: false }` (and support re-activate via `active: true`, consistent with the Department page's toggle).
- Surface 409/400 errors from the API inline using the same `axiosError?.response?.data?.error` pattern.
- No new shared component — reuse the same inline `Modal` pattern as `features/departments/index.tsx`; do not extract a generic component library as a side effect of this story.

---

## File Checklist

| File | Action | Notes |
|------|--------|-------|
| `backend/src/services/leaveBalance.ts` | UPDATE | Replace `{}` stub with `provisionBalancesForNewLeaveType` only (AD-15, AD-2) |
| `backend/src/services/leaveType.ts` | NEW | All Prisma access for leave types |
| `backend/src/controllers/leaveTypes.ts` | NEW | Thin handlers, AD-10 envelope |
| `backend/src/routes/leaveTypes.ts` | NEW | Mounted under `/leave-types` |
| `backend/src/routes/index.ts` | UPDATE | Add `router.use('/leave-types', leaveTypesRouter)` |
| `frontend/src/features/leaveTypes/index.tsx` | UPDATE | Replace stub with full CRUD UI |

**Do NOT touch:** `middleware/auth.ts`, `middleware/rbac.ts`, `middleware/error.ts`, `prisma/schema.prisma` (LeaveType/LeaveBalance models already exist), `prisma/seed.ts`, `App.tsx` (route already wired), `services/department.ts`, `services/leaveRequest.ts`, `services/audit.ts`, `services/notification.ts` (still legitimately empty stubs for later epics).

---

## Testing Requirements

Follow the existing Vitest patterns in `backend/src/services/department.test.ts` (mock `../prisma/client.js`, mock `dotenv/config`, `vi.clearAllMocks()` in `beforeEach`). At minimum:

`backend/src/services/leaveType.test.ts` (NEW):
- `createLeaveType` — happy path (asserts `prisma.leaveType.create` called with correct data, then `provisionBalancesForNewLeaveType` invoked — you can verify this by mocking `./leaveBalance.js` and asserting the mock was called with the new leave type's id/defaultQuota); duplicate name via pre-check throws 409; duplicate name via simulated `P2002` on `create` also throws 409 (Guardrail 1 — don't skip this one, it's the exact gap found in Story 2.1's review).
- `updateLeaveType` — rename happy path; rename to an existing name throws 409; not-found throws 404; deactivate (`active: false`) happy path; `defaultQuota`/`documentRequired` update happy path.
- `listLeaveTypes` — ADMIN role sees inactive types; MANAGER/EMPLOYEE role does not (assert the `where` clause via mocked `findMany` call args).

`backend/src/services/leaveBalance.test.ts` (NEW):
- `provisionBalancesForNewLeaveType` — queries only `active: true` users; calls `createMany` with one row per active user at the given `defaultQuota` and `skipDuplicates: true`; no-ops (does not call `createMany`) when there are zero active users.

---

## Dev Notes

- **Architecture compliance:** AD-1 (RBAC server-side — `requireRole(['ADMIN'])` on all mutating routes), AD-2 (all balance writes go through `services/leaveBalance`), AD-3 (pagination contract), AD-10 (response envelope), AD-11 (routes → controllers → services → Prisma), AD-15 (eager balance provisioning on new leave type, never lazy).
- **Stack:** Express 5, Prisma 7 (`prisma` client already configured in `backend/src/prisma/client.ts` — reuse it, don't reinitialize), React 18, TailwindCSS v4 for styling (use utility classes consistent with `features/departments/index.tsx`).
- **Conventions:** `camelCase.ts` file names; HTTP routes are kebab-case plural nouns (`/leave-types` already satisfies this); entity IDs are UUIDs.
- **Previous story intelligence (2.1 Department Management, done):** The single biggest learning from 2.1's code-review pass was that a `findUnique`-only duplicate check is not atomic under concurrent requests — always pair it with a caught `P2002` on the actual `create`/`update` call (Guardrail 1 above bakes this in from the start, so it shouldn't need a follow-up review fix this time). Other carried-forward conventions: centralize errors via `next(err)` + `errorHandler`, never call Prisma from controllers, role-scoped list filtering happens server-side never client-side, runtime type-validate every optional field on `PATCH` bodies (the 2.1 review also added this for `updateDepartmentController` after it shipped without it — do it from the start here).
- This is the first story to touch `services/leaveBalance.ts`. Keep the change surgical: add only `provisionBalancesForNewLeaveType`. The rest of the balance lifecycle (deduct on approve, restore on reject/cancel, per-employee override, January reset) belongs to Stories 3.3 and 4.3 — do not pre-build it here.

### Project Structure Notes

- No conflicts with the unified project structure (`ARCHITECTURE-SPINE.md` Structural Seed) — `services/leaveType.ts`, `controllers/leaveTypes.ts`, `routes/leaveTypes.ts`, and `features/leaveTypes/` are all pre-named slots in the structural seed / existing stubs.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2: Leave Type Management]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-employee-leave-management-system-2026-06-29/ARCHITECTURE-SPINE.md#AD-1, AD-2, AD-3, AD-10, AD-11, AD-15]
- [Source: _bmad-output/planning-artifacts/prds/prd-employee-leave-management-system-2026-06-29/.decision-log.md#DL-001 Leave type management approach]
- [Source: backend/src/prisma/schema.prisma#model LeaveType, model LeaveBalance, model User]
- [Source: _bmad-output/implementation-artifacts/2-1-department-management.md (reference implementation pattern + code-review learnings)]

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (claude-sonnet-4-6)

### Debug Log References

None — implementation followed the Implementation Guide verbatim; no debugging blockers encountered.

### Completion Notes List

- Replaced the `leaveBalanceService = {}` stub with `provisionBalancesForNewLeaveType` (AD-15 + AD-2): queries active users, `createMany`s one `leave_balances` row per user at the new leave type's `defaultQuota` with `skipDuplicates: true`, no-ops on zero active users.
- Added `backend/src/services/leaveType.ts`: `listLeaveTypes` (role-scoped `where`, AD-3 pagination), `createLeaveType` (dual-layer duplicate-name guard — `findUnique` pre-check + caught `P2002` on `create`, per Guardrail 1 — then calls `provisionBalancesForNewLeaveType`), `updateLeaveType` (404 on missing, dual-layer duplicate guard on rename, dual-layer applies to `update()` too, `active: false` flips only the `active` column with no cascading writes).
- Added `backend/src/controllers/leaveTypes.ts`: thin AD-10/AD-11 handlers; validates `defaultQuota` is a positive integer and `documentRequired`/`active` are real booleans (400 otherwise) on both create and update paths; no direct Prisma access.
- Added `backend/src/routes/leaveTypes.ts` (GET open to any authenticated role for the role-scoped list; POST/PATCH gated `requireRole(['ADMIN'])`) and mounted it at `/leave-types` in `backend/src/routes/index.ts`.
- Replaced the `frontend/src/features/leaveTypes/index.tsx` stub with a full CRUD page mirroring `features/departments/index.tsx`'s structure (table + Add/Edit modal + diff-based PATCH + inline 409/400 error surfacing); table columns: Name, Default Quota, Document Required (checkbox), Status, Actions (Edit / Deactivate-Activate).
- Tests: `leaveBalance.test.ts` (3 tests) and `leaveType.test.ts` (13 tests, including both duplicate-name paths per Guardrail 1 and role-scoped `listLeaveTypes` filtering) — all new and existing backend tests pass (53/53). Backend and frontend `tsc --noEmit` both clean; frontend `vite build` succeeds.
- Could not exercise the UI in a live browser — this environment has neither `docker` nor a local `postgres` install, so the Postgres-backed API could not be started. Verification was limited to unit tests, type-checking, and a production build; manual browser verification of the `/leave-types` page is still recommended before merge.

### File List

- `backend/src/services/leaveBalance.ts` (UPDATE — replaced `{}` stub)
- `backend/src/services/leaveBalance.test.ts` (NEW)
- `backend/src/services/leaveType.ts` (NEW)
- `backend/src/services/leaveType.test.ts` (NEW)
- `backend/src/controllers/leaveTypes.ts` (NEW)
- `backend/src/routes/leaveTypes.ts` (NEW)
- `backend/src/routes/index.ts` (UPDATE — mounted `leaveTypesRouter`)
- `frontend/src/features/leaveTypes/index.tsx` (UPDATE — replaced stub with full CRUD UI)

## Change Log

| Date | Change |
|------|--------|
| 2026-06-30 | Story 2.2 created via create-story workflow. |
| 2026-06-30 | Implemented leave-type CRUD (service/controller/routes/UI) and balance provisioning per AD-15; all backend tests pass; status moved to review. |
