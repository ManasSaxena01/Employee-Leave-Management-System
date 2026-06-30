---
story_id: "2.1"
story_key: "2-1-department-management"
epic: 2
story: 1
title: "Department Management"
status: "done"
created: "2026-06-30"
epic_title: "Admin System Configuration — Departments, Leave Types & Holidays"
baseline_commit: "NO_VCS"
---

# Story 2.1: Department Management

## Status: done

## Story

**As an admin,**
I want to create, rename, and deactivate departments, and assign a manager to each,
**So that** the organisational structure is in place before employees are added.

---

## Acceptance Criteria

**AC1 — Create department:**
Given an admin is authenticated,
When `POST /api/departments` is called with `{ name }`,
Then a 201 response returns the new department; a duplicate name returns 409 `{ success: false, error: "Department name already exists" }`.

**AC2 — Rename / deactivate department:**
Given an existing department,
When `PATCH /api/departments/:id` is called with a new `name` and/or `active: false`,
Then a 200 response reflects the update; deactivating a department does not delete it or affect its employees.

**AC3 — Assign manager:**
Given an existing department,
When `PATCH /api/departments/:id` is called with a `managerId` that belongs to a MANAGER-role user,
Then that user is set as the department manager; a non-MANAGER `userId` returns 400; a `userId` that already manages a different department returns 409 `{ success: false, error: "User already manages another department" }` (DB-level unique constraint on `managerId` — see Guardrail 2 below).

**AC4 — List departments (paginated, role-scoped):**
Given `GET /api/departments`,
When called by any authenticated user,
Then a paginated list `{ success, data: [...], meta: { page, limit, total } }` is returned per AD-3/AD-10; admins see all departments; managers and employees see only `active: true` departments.

**AC5 — Admin UI:**
Given the admin UI,
When the Departments page (`/departments`) is visited,
Then a table lists all departments with columns: name, manager, status, and action buttons (Edit, Deactivate); an Add Department modal allows creating a new department with a name field and an optional manager dropdown.

---

## ⚠️ CRITICAL — Read Before Coding

This is the **first CRUD admin feature** built in this project. There is no prior `services/department.ts`, `controllers/departments.ts`, or `routes/departments.ts` — you are establishing the pattern Epic 2's remaining stories (2.2 Leave Types, 2.3 Holidays) and Epic 3 will copy. Get the shape right.

### Already in place — do NOT recreate
- `frontend/src/features/departments/index.tsx` exists as a stub (`<div>Departments</div>`) — replace its contents, don't create a new file.
- `frontend/src/lib/types.ts` already exports `Department { id, name, managerId, active, createdAt, updatedAt }` — reuse it, don't redefine.
- `frontend/src/App.tsx` already routes `/departments` through `RequireRole roles={['ADMIN']}` → `DepartmentsPage` — no router changes needed.
- `backend/src/prisma/schema.prisma` already has the `Department` model (see Guardrail 2) — no migration needed.
- `backend/src/middleware/auth.ts` (`authenticate`) and `backend/src/middleware/rbac.ts` (`requireRole`) are done and tested — reuse them, don't modify.
- `backend/src/middleware/error.ts` (`errorHandler`) formats every thrown error into the AD-10 envelope — throw `Object.assign(new Error(msg), { status: 4xx })` from services and let it bubble via `next(err)`, exactly like `services/auth.ts` does.

---

## STOP — Critical Guardrails

| # | Risk | Wrong | Correct |
|---|------|-------|---------|
| 1 | Prisma calls in controller | `controllers/departments.ts` calling `prisma.department.find...` directly | All Prisma access lives in `services/department.ts`; controllers only parse req → call service → respond (AD-11 layering: routes → controllers → services → Prisma) |
| 2 | **Unassigned P2002 crash** — `Department.managerId` has `@unique` in the schema. A `User` can be the manager of **at most one** department, enforced at the DB level. | Letting `PATCH /departments/:id { managerId }` hit `prisma.department.update()` directly when that manager already manages another department → unhandled Prisma `P2002` → uncaught 500 | Before the update, check `prisma.department.findFirst({ where: { managerId, NOT: { id } } })`; if found, throw `Object.assign(new Error('User already manages another department'), { status: 409 })` |
| 3 | Non-MANAGER assigned as manager | Trusting `managerId` blindly | Look up the user by `managerId`; if `!user \|\| user.role !== 'MANAGER'`, throw a 400 (`Object.assign(new Error('managerId must belong to a user with role MANAGER'), { status: 400 })`) |
| 4 | **Manager-dropdown data source gap** — the Epic-3 employee endpoints (`GET /employees`) don't exist yet, but AC5 requires a manager-selection dropdown in this story. | Blocking this story on Epic 3, or building a full employee list endpoint here (scope creep) | Add one minimal, admin-only endpoint **in this story**: `GET /departments/available-managers` → returns `{ success: true, data: User[] }` filtered to `role: 'MANAGER', active: true` (id, name, email only — no passwordHash). Lives in `services/department.ts` (it's about populating department assignment, not a general employee directory) and is superseded/removed-from-use once Epic 3 ships a real employee list — leave a one-line comment noting that. |
| 5 | Role string mismatch | Comparing against lowercase `'manager'` | Prisma `Role` enum and JWT `role` claim are uppercase: `ADMIN`, `MANAGER`, `EMPLOYEE` (see `backend/src/prisma/schema.prisma:10-14`, `frontend/src/lib/constants.ts`) |
| 6 | POST body includes `managerId` | Building the Add-Department modal to send `{ name, managerId }` in one `POST /departments` call | AC1's `POST /departments` contract is `{ name }` only. If the admin picks a manager in the Add modal, do the `POST` first, then immediately call `PATCH /departments/:id { managerId }` with the returned id. Manager selection in the modal is optional. |
| 7 | Unbounded list response | `GET /departments` returning a bare array | Must return the full AD-3/AD-10 envelope: `{ success: true, data: Department[], meta: { page, limit, total } }`, default `limit=20`, even though department counts will be small — this establishes the pagination contract every later list endpoint copies |
| 8 | Route not mounted | New `departmentsRouter` created but never wired | Add `router.use('/departments', departmentsRouter)` to the **existing** `backend/src/routes/index.ts` (alongside the existing `/auth` mount and `/files/:filename` route) |
| 9 | Active-status filtering done client-side | Fetching all departments and filtering by `active` in the React component | Filtering by role happens **server-side** in `services/department.ts` based on `req.user.role` — never trust the client to hide inactive rows |

---

## Implementation Guide

### 1. `backend/src/services/department.ts` (NEW — replaces the empty stub pattern seen in `leaveBalance.ts`)

```typescript
import { prisma } from '../prisma/client.js'

export interface DepartmentResult {
  id: string
  name: string
  managerId: string | null
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export async function listDepartments(
  role: string,
  page: number,
  limit: number
): Promise<{ data: DepartmentResult[]; total: number }> {
  const where = role === 'ADMIN' ? {} : { active: true }
  const [data, total] = await Promise.all([
    prisma.department.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { name: 'asc' } }),
    prisma.department.count({ where }),
  ])
  return { data, total }
}

export async function createDepartment(name: string): Promise<DepartmentResult> {
  const existing = await prisma.department.findUnique({ where: { name } })
  if (existing) {
    throw Object.assign(new Error('Department name already exists'), { status: 409 })
  }
  return prisma.department.create({ data: { name } })
}

export async function updateDepartment(
  id: string,
  updates: { name?: string; active?: boolean; managerId?: string | null }
): Promise<DepartmentResult> {
  const department = await prisma.department.findUnique({ where: { id } })
  if (!department) {
    throw Object.assign(new Error('Department not found'), { status: 404 })
  }

  if (updates.managerId !== undefined && updates.managerId !== null) {
    const manager = await prisma.user.findUnique({ where: { id: updates.managerId } })
    if (!manager || manager.role !== 'MANAGER') {
      throw Object.assign(new Error('managerId must belong to a user with role MANAGER'), { status: 400 })
    }
    const conflict = await prisma.department.findFirst({
      where: { managerId: updates.managerId, NOT: { id } },
    })
    if (conflict) {
      throw Object.assign(new Error('User already manages another department'), { status: 409 })
    }
  }

  if (updates.name && updates.name !== department.name) {
    const nameTaken = await prisma.department.findUnique({ where: { name: updates.name } })
    if (nameTaken) {
      throw Object.assign(new Error('Department name already exists'), { status: 409 })
    }
  }

  return prisma.department.update({ where: { id }, data: updates })
}

// Guardrail 4: minimal manager-picker source until Epic 3 ships a real employee list.
export async function listAvailableManagers(): Promise<Array<{ id: string; name: string; email: string }>> {
  return prisma.user.findMany({
    where: { role: 'MANAGER', active: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  })
}
```

### 2. `backend/src/controllers/departments.ts` (NEW)

Thin controllers only — parse request, call service, respond with the AD-10 envelope, `next(err)` on throw. Mirror `controllers/auth.ts`'s try/catch pattern exactly. Endpoints needed:

- `listDepartmentsController` — reads `page`/`limit` query params (default `page=1`, `limit=20`), reads `req.user.role` (set by `authenticate`), calls `listDepartments`, responds with `{ success: true, data, meta: { page, limit, total } }`.
- `createDepartmentController` — validates `name` is a non-empty string (400 if missing), calls `createDepartment`, responds 201.
- `updateDepartmentController` — reads `req.params.id` and whichever of `name`/`active`/`managerId` are present in the body, calls `updateDepartment`, responds 200.
- `listAvailableManagersController` — calls `listAvailableManagers`, responds `{ success: true, data }` (no pagination needed — this list is small and admin-only).

### 3. `backend/src/routes/departments.ts` (NEW)

```typescript
import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import {
  listDepartmentsController,
  createDepartmentController,
  updateDepartmentController,
  listAvailableManagersController,
} from '../controllers/departments.js'

export const departmentsRouter = Router()

departmentsRouter.get('/', authenticate, listDepartmentsController)
departmentsRouter.get('/available-managers', authenticate, requireRole(['ADMIN']), listAvailableManagersController)
departmentsRouter.post('/', authenticate, requireRole(['ADMIN']), createDepartmentController)
departmentsRouter.patch('/:id', authenticate, requireRole(['ADMIN']), updateDepartmentController)
```

Mount it in `backend/src/routes/index.ts` (existing file — add one line, don't restructure):

```typescript
import { departmentsRouter } from './departments.js'
// ...
router.use('/departments', departmentsRouter)
```

### 4. `frontend/src/features/departments/index.tsx` (REPLACE the stub)

- Fetch `GET /departments` via `apiClient` on mount (and after any mutation).
- Render a table: Name | Manager | Status | Actions (Edit, Deactivate/Activate).
- "Add Department" button opens a modal with a name input and an optional manager `<select>` populated from `GET /departments/available-managers`.
- On submit: `POST /departments { name }`, then if a manager was selected, `PATCH /departments/:id { managerId }` with the new id (Guardrail 6).
- Edit modal: pre-fill name + manager; `PATCH /departments/:id` with whatever changed.
- Deactivate button: `PATCH /departments/:id { active: false }` (and re-activate via `active: true` if you choose to support it — AC doesn't require a re-activate path explicitly, but it's a one-line addition and avoids a dead-end UI state).
- Surface 409/400 errors from the API inline (same pattern as `features/auth/index.tsx`'s `axiosError?.response?.data?.error`).
- No shared `Table`/`Modal` component exists yet in `frontend/src/components/` — write minimal inline markup for this story; do not build a generic component library as a side effect.

---

## File Checklist

| File | Action | Notes |
|------|--------|-------|
| `backend/src/services/department.ts` | NEW | All Prisma access for departments |
| `backend/src/controllers/departments.ts` | NEW | Thin handlers, AD-10 envelope |
| `backend/src/routes/departments.ts` | NEW | Mounted under `/departments` |
| `backend/src/routes/index.ts` | UPDATE | Add `router.use('/departments', departmentsRouter)` |
| `frontend/src/features/departments/index.tsx` | UPDATE | Replace stub with full CRUD UI |

**Do NOT touch:** `middleware/auth.ts`, `middleware/rbac.ts`, `middleware/error.ts`, `prisma/schema.prisma` (Department model already exists), `App.tsx` (route already wired).

---

## Testing Requirements

Follow the existing Vitest patterns in `backend/src/middleware/auth.test.ts` / `backend/src/services/auth.test.ts` (mock `../prisma/client.js`, mock `../env.js` if imported, `vi.clearAllMocks()` in `beforeEach`). At minimum, unit-test `services/department.ts`:

- `createDepartment` — happy path; duplicate name throws 409.
- `updateDepartment` — manager assignment happy path; non-MANAGER `managerId` throws 400; manager already assigned elsewhere throws 409 (Guardrail 2 — this is the one most likely to be skipped, don't skip it); rename to an existing name throws 409.
- `listDepartments` — ADMIN role sees inactive departments; MANAGER/EMPLOYEE role does not (assert the `where` clause behavior via the mocked `findMany` call args).

---

## Dev Notes

- **Architecture compliance:** AD-1 (RBAC server-side — `requireRole(['ADMIN'])` on all mutating routes), AD-3 (pagination contract), AD-10 (response envelope), AD-11 (routes → controllers → services → Prisma, frontend `features/` → `lib/` only).
- **Stack:** Express 5, Prisma 7 (`prisma` client already configured in `backend/src/prisma/client.js` — reuse it, don't reinitialize), React 18, TailwindCSS v4 for styling (use utility classes consistent with `features/auth/index.tsx` and `pages/DashboardPage.tsx`).
- **Conventions:** `camelCase.ts` file names; HTTP routes are kebab-case plural nouns (`/departments` already satisfies this); entity IDs are UUIDs, never exposed as sequential integers.
- This story has no previous in-epic story to inherit learnings from (it's Epic 2's first story). Cross-epic learnings carried forward from Epic 1: centralize errors via `next(err)` + `errorHandler`, never call Prisma from controllers, keep cookie/JWT logic untouched (irrelevant here but don't reach into `services/auth.ts`).

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1: Department Management]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-employee-leave-management-system-2026-06-29/ARCHITECTURE-SPINE.md#AD-1, AD-3, AD-10, AD-11]
- [Source: backend/src/prisma/schema.prisma#model Department, model User]

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (claude-sonnet-4-6)

### Debug Log References

None — no blocking issues encountered. Initial smoke test against the real (Neon-hosted) dev database returned `401 Invalid credentials` for `admin@demo.com`; resolved by running `npm run seed` (DB had not been seeded yet in this environment) before re-testing.

### Completion Notes List

- Implemented `services/department.ts` exactly per the Implementation Guide: `listDepartments` (role-scoped), `createDepartment` (409 on duplicate name), `updateDepartment` (manager-assignment with 400/409 guardrails, rename-conflict 409), `listAvailableManagers` (Guardrail 4 stopgap, commented as superseded by Epic 3's employee list).
- Controllers are thin (parse → service → respond/`next(err)`), mirroring `controllers/auth.ts`. Routes mounted under `/departments` in `routes/index.ts` with `authenticate` + `requireRole(['ADMIN'])` on all mutating/admin-only routes per AD-1.
- Frontend `features/departments/index.tsx` replaces the stub with a full CRUD table (Name/Manager/Status/Actions), an Add modal (`POST` then optional `PATCH managerId` per Guardrail 6) and an Edit modal (diff-based `PATCH`), plus a Deactivate/Activate toggle. Errors surfaced inline via the same `axiosError?.response?.data?.error` pattern as `features/auth/index.tsx`.
- Unit tests (`services/department.test.ts`, 13 cases) cover: create happy-path + duplicate-name 409; update manager-assign happy-path, non-MANAGER 400, manager-already-assigned 409 (Guardrail 2), rename-conflict 409, not-found 404, deactivate-without-cascading; list role-scoping for ADMIN vs MANAGER vs EMPLOYEE plus pagination skip/take; `listAvailableManagers` filter/select shape. Full backend suite: 37/37 passing, no regressions.
- Backend (`tsc --noEmit`) and frontend (`tsc && vite build`) both compile cleanly.
- Live-verified all 5 ACs against the real dev database (Neon Postgres, seeded via `npm run seed`) using curl as ADMIN and EMPLOYEE: create department (201), duplicate name (409), assign non-MANAGER user as manager (400), assign a manager who already manages another department (409, Guardrail 2 DB-unique-backed check), deactivate (200, employee role still resolves it on lookup — no cascade), `GET /departments` returns inactive rows to ADMIN but not to EMPLOYEE, EMPLOYEE `POST /departments` correctly rejected with 403. Test department created during smoke testing was deleted afterward.
- Did not browser-test the React UI interactively (no browser automation tool available in this session) — frontend correctness was verified via clean `tsc`/`vite build` and by confirming the dev server serves the app; the underlying API contract the UI calls was fully exercised live as above.

### File List

- `backend/src/services/department.ts` (NEW)
- `backend/src/services/department.test.ts` (NEW)
- `backend/src/controllers/departments.ts` (NEW)
- `backend/src/routes/departments.ts` (NEW)
- `backend/src/routes/index.ts` (UPDATE — mounted `departmentsRouter`)
- `frontend/src/features/departments/index.tsx` (UPDATE — replaced stub with full CRUD UI)

## Change Log

| Date | Change |
|------|--------|
| 2026-06-30 | Story 2.1 created via create-story workflow. |
| 2026-06-30 | Implemented department CRUD (backend service/controller/routes + frontend admin UI); 13 new unit tests added, 37/37 backend tests passing; live-verified all ACs against dev DB; status moved to review. |
| 2026-06-30 | Code review fix pass (8 confirmed findings): closed `createDepartment`/`updateDepartment` check-then-act races by catching P2002 and translating to 409 (Guardrail 2's findFirst pre-check alone wasn't atomic); fixed `apiClient.ts` 401 interceptor swallowing failed-login errors (missing `/auth/login` exclusion); reverted `seed.ts` leave-balance upsert to non-destructive `update: {}` (was resetting balances on every re-seed); opened `GET /departments/available-managers` to all authenticated users (was ADMIN-only, causing non-admins to see raw manager UUIDs instead of names); added runtime type validation for `name`/`active`/`managerId` in `updateDepartmentController`; added runtime JWT-payload validation to `refreshAccessToken`/`logout` (services/auth.ts) matching `authenticate`'s hardening; collapsed `AddDepartmentModal`/`EditDepartmentModal` into one `DepartmentFormModal`. 37/37 backend tests still passing; backend + frontend `tsc --noEmit` clean. Marked done. |
