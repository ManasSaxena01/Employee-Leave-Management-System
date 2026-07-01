---
story_id: "3.1"
story_key: "3-1-employee-account-management"
epic: 3
story: 1
title: "Employee Account Management"
status: "review"
created: "2026-07-01"
epic_title: "Employee Management & Leave Balances"
baseline_commit: "79490a2"
---

# Story 3.1: Employee Account Management

## Status: review

## Story

**As an admin,**
I want to create, update, deactivate, and assign roles, departments, and reporting managers to employee accounts,
**So that** the full workforce is represented in the system with correct access levels.

---

## Acceptance Criteria

**AC1 — Create employee:**
Given an admin is authenticated,
When `POST /api/employees` is called with `{ email, name, password, role, departmentId?, managerId? }`,
Then a 201 response returns the new employee record (password excluded from response); password is bcrypt-hashed before storage; a `leave_balances` row at `default_quota` is created for every active leave type (AD-15); duplicate email returns 409.

**AC2 — Update employee fields:**
Given an existing employee,
When `PATCH /api/employees/:id` is called with any of: `name`, `role`, `departmentId`, `managerId`,
Then a 200 response reflects the changes; each field is updated independently; fields not present in the body are not modified.

**AC3 — Deactivate/reactivate employee:**
Given an existing employee,
When `PATCH /api/employees/:id` is called with `{ active: false }` (or `true`),
Then the `active` flag is updated; deactivated employees cannot log in (the existing `services/auth.ts login()` already checks `!user.active` → 401 — do NOT modify auth service).

**AC4 — Get employee profile:**
Given `GET /api/employees/:id`,
When called by an admin,
Then returns the employee's profile: id, email, name, role, active, departmentId, managerId, contactEmail, phone, photoPath, createdAt, updatedAt.

**AC5 — Basic employee list:**
Given `GET /api/employees`,
When called by an admin with optional `?page=&limit=`,
Then returns `{ success: true, data: UserResult[], meta: { page, limit, total } }` with default `limit=20` (AD-3). Story 3.2 adds search/filter params to this same endpoint — implement it so params can be appended later.

**AC6 — Available managers list:**
Given `GET /api/employees/available-managers`,
When called by an authenticated user,
Then returns active users with role `MANAGER` or `ADMIN`: `[{ id, name, email }]` ordered by name. (Used by both Add and Edit modals for the manager dropdown.)

**AC7 — Add Employee modal (admin UI):**
Given the admin UI Employee Management page (`/employees`),
When Add Employee is clicked,
Then a modal opens with fields: name, email, password (temporary), role (select: EMPLOYEE/MANAGER/ADMIN), department (select from `GET /departments`), manager (select from `GET /employees/available-managers`); submitting `POST /api/employees` and refreshes the list.

**AC8 — Edit Employee modal (admin UI):**
Given the admin UI employee table,
When an employee row's Edit action is clicked,
Then a modal pre-fills name, role, department, and manager; saving calls `PATCH /api/employees/:id` with only changed fields (diff-based like departments page).

**AC9 — Deactivate/reactivate in UI:**
Given the admin UI employee table,
When the Deactivate/Activate button is clicked,
Then calls `PATCH /api/employees/:id` with `{ active: !current }` and refreshes; no modal needed.

---

## ⚠️ CRITICAL — Read Before Coding

This is the **fourth CRUD admin feature** in the project. Stories 2.1, 2.2, and 2.3 established the pattern:
`services/{resource}.ts` → `controllers/{resource}.ts` → `routes/{resource}.ts` → mounted in `routes/index.ts` → `frontend/src/features/{resource}/index.tsx` replaces stub.

**Read `backend/src/services/department.ts`, `backend/src/controllers/departments.ts`, `backend/src/routes/departments.ts`, and `frontend/src/features/departments/index.tsx` in full before starting — they are your template.**

### Already in place — do NOT recreate

- **`frontend/src/features/employees/index.tsx`** exists as a stub (`export function EmployeesPage() { return <div>Employees</div> }`) — replace its contents, do not create a new file.
- **`frontend/src/App.tsx`** already routes `/employees` through `RequireRole roles={['ADMIN']}` → `EmployeesPage` — do NOT touch App.tsx.
- **`frontend/src/lib/types.ts`** already exports `User { id, email, name, role, active, departmentId, managerId, contactEmail, phone, photoPath, createdAt, updatedAt }` — reuse it, don't redefine. The `UserResult` from the backend service must match this shape exactly.
- **`backend/src/services/leaveBalance.ts`** exists with `provisionBalancesForNewLeaveType()` — ADD `provisionBalancesForNewUser()` to this file; do NOT create a new leaveBalance service file.
- **`backend/src/middleware/auth.ts`**, **`middleware/rbac.ts`**, **`middleware/error.ts`** — already done and tested; reuse, do NOT modify.
- **`backend/src/services/auth.ts`** — the `login()` function already checks `!user.active` → throws 401. Do NOT touch auth service for deactivation to work.
- **`backend/src/prisma/schema.prisma`** already has the full `User` model — no migration needed.
- **`backend/src/routes/index.ts`** — UPDATE only: add `employeesRouter` import and mount. Do not restructure the file.
- **`backend/src/services/department.ts`** has `listAvailableManagers()` that returns only `MANAGER` role users. The employees available-managers endpoint must return `MANAGER` **and** `ADMIN` role users (a manager in the employee hierarchy can be an admin).

---

## STOP — Critical Guardrails

| # | Risk | Wrong | Correct |
|---|------|-------|---------|
| 1 | **Password in response** | Returning `passwordHash` in UserResult or any API response | `UserResult` interface never includes `passwordHash`; select only the fields you need |
| 2 | **AD-15: Balance provisioning** | Creating user without provisioning balances, or doing it with a direct `prisma.leaveBalance.createMany()` in `services/user.ts` | Call `provisionBalancesForNewUser(userId)` from `services/leaveBalance.ts` after user creation (AD-2: all balance writes go through `services/leaveBalance`) |
| 3 | **Route ordering: `/available-managers` before `/:id`** | Defining `GET /:id` first so `/available-managers` is caught as an ID | Route file must declare `GET /available-managers` BEFORE `GET /:id` to avoid Express treating the literal string as the `:id` param |
| 4 | **Duplicate email guard** | Relying only on Prisma's unique constraint | Pre-check with `findUnique({ where: { email } })` for fast 409, AND wrap `prisma.user.create()` in try/catch that translates `P2002` → 409 (same dual-layer pattern as departments and holidays) |
| 5 | **departmentId validation** | Accepting any string without validating the department exists and is active | Before create/update, if `departmentId` is provided: `findUnique({ where: { id: departmentId } })` and assert it exists and `active: true`; throw 400 otherwise |
| 6 | **managerId validation** | Accepting any string without validation | If `managerId` provided: `findUnique({ where: { id: managerId } })` and assert user exists and `active: true`; throw 400 otherwise. Do NOT restrict manager role (any active user can be a reporting manager) |
| 7 | **Role validation** | Accepting arbitrary strings for role | Validate that role is one of `'ADMIN' | 'MANAGER' | 'EMPLOYEE'` in the controller; throw 400 for invalid values |
| 8 | **AD-3: Unbounded list** | `GET /employees` returning a bare array | Must return `{ success: true, data: UserResult[], meta: { page, limit, total } }` with default `limit=20` |
| 9 | **Route not mounted** | New `employeesRouter` created but never wired | Add `router.use('/employees', employeesRouter)` to `backend/src/routes/index.ts` |
| 10 | **Story 3.2 extension point** | Implementing list without preparing for filters | In `services/user.ts` `listUsers()`, accept optional `search?: string, departmentId?: string` params (unused in 3.1 but ready for 3.2 to extend without refactor) |
| 11 | **Frontend: departments dropdown for Add modal** | Fetching all departments with separate pagination logic | Use the existing `GET /departments` (already returns all departments for ADMIN role in `listDepartments`); the Admin sees all departments |
| 12 | **Frontend: resolving names in table** | Making N+1 API calls to get department/manager name per row | Load departments and managers once via `GET /departments` and `GET /employees/available-managers`; resolve names client-side |
| 13 | **PATCH — deactivating a user with active refresh tokens** | Not invalidating refresh tokens when `active: false` is set | After setting `active: false`, delete all refresh tokens for that user: `prisma.refreshToken.deleteMany({ where: { userId: id } })` — this forces the user out of any active sessions immediately |

---

## Implementation Guide

### 1. `backend/src/services/leaveBalance.ts` (UPDATE — add function)

Add this function to the **existing** `leaveBalance.ts` file (do not create a new file):

```typescript
// AD-15: called by services/user.ts on employee creation.
// Provisions one leave_balances row per active leave type for the new user.
export async function provisionBalancesForNewUser(userId: string): Promise<void> {
  const activeLeaveTypes = await prisma.leaveType.findMany({
    where: { active: true },
    select: { id: true, defaultQuota: true },
  })
  if (activeLeaveTypes.length === 0) return
  await prisma.leaveBalance.createMany({
    data: activeLeaveTypes.map(lt => ({ userId, leaveTypeId: lt.id, balance: lt.defaultQuota })),
    skipDuplicates: true,
  })
}
```

### 2. `backend/src/services/user.ts` (NEW)

```typescript
import bcrypt from 'bcryptjs'
import { prisma } from '../prisma/client.js'
import { provisionBalancesForNewUser } from './leaveBalance.js'

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002'
}

const VALID_ROLES = ['ADMIN', 'MANAGER', 'EMPLOYEE'] as const
type UserRole = (typeof VALID_ROLES)[number]

// passwordHash is excluded — never include it in UserResult
export interface UserResult {
  id: string
  email: string
  name: string
  role: UserRole
  active: boolean
  departmentId: string | null
  managerId: string | null
  contactEmail: string | null
  phone: string | null
  photoPath: string | null
  createdAt: Date
  updatedAt: Date
}

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  active: true,
  departmentId: true,
  managerId: true,
  contactEmail: true,
  phone: true,
  photoPath: true,
  createdAt: true,
  updatedAt: true,
} as const

export async function listUsers(
  page: number,
  limit: number,
  // Story 3.2 will populate these; implement the shell now to avoid refactoring
  _filters?: { search?: string; departmentId?: string }
): Promise<{ data: UserResult[]; total: number }> {
  const [data, total] = await Promise.all([
    prisma.user.findMany({
      select: USER_SELECT,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: 'asc' },
    }),
    prisma.user.count(),
  ])
  return { data: data as UserResult[], total }
}

export async function getUser(id: string): Promise<UserResult> {
  const user = await prisma.user.findUnique({ where: { id }, select: USER_SELECT })
  if (!user) {
    throw Object.assign(new Error('Employee not found'), { status: 404 })
  }
  return user as UserResult
}

export async function createUser(input: {
  email: string
  name: string
  password: string
  role: UserRole
  departmentId?: string
  managerId?: string
}): Promise<UserResult> {
  if (input.departmentId) {
    const dept = await prisma.department.findUnique({ where: { id: input.departmentId } })
    if (!dept || !dept.active) {
      throw Object.assign(new Error('departmentId must refer to an active department'), { status: 400 })
    }
  }
  if (input.managerId) {
    const mgr = await prisma.user.findUnique({ where: { id: input.managerId } })
    if (!mgr || !mgr.active) {
      throw Object.assign(new Error('managerId must refer to an active user'), { status: 400 })
    }
  }

  const existing = await prisma.user.findUnique({ where: { email: input.email } })
  if (existing) {
    throw Object.assign(new Error('Email address already in use'), { status: 409 })
  }

  const passwordHash = await bcrypt.hash(input.password, 10)

  let user: UserResult
  try {
    user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
        role: input.role,
        departmentId: input.departmentId ?? null,
        managerId: input.managerId ?? null,
      },
      select: USER_SELECT,
    }) as UserResult
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw Object.assign(new Error('Email address already in use'), { status: 409 })
    }
    throw err
  }

  // AD-15: provision leave balance rows for all active leave types
  await provisionBalancesForNewUser(user.id)

  return user
}

export async function updateUser(
  id: string,
  updates: {
    name?: string
    role?: UserRole
    departmentId?: string | null
    managerId?: string | null
    active?: boolean
  }
): Promise<UserResult> {
  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) {
    throw Object.assign(new Error('Employee not found'), { status: 404 })
  }

  if (updates.departmentId !== undefined && updates.departmentId !== null) {
    const dept = await prisma.department.findUnique({ where: { id: updates.departmentId } })
    if (!dept || !dept.active) {
      throw Object.assign(new Error('departmentId must refer to an active department'), { status: 400 })
    }
  }
  if (updates.managerId !== undefined && updates.managerId !== null) {
    const mgr = await prisma.user.findUnique({ where: { id: updates.managerId } })
    if (!mgr || !mgr.active) {
      throw Object.assign(new Error('managerId must refer to an active user'), { status: 400 })
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updates,
    select: USER_SELECT,
  }) as UserResult

  // Invalidate active sessions immediately when deactivating
  if (updates.active === false) {
    await prisma.refreshToken.deleteMany({ where: { userId: id } })
  }

  return updated
}

export async function listAvailableManagers(): Promise<Array<{ id: string; name: string; email: string }>> {
  return prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'MANAGER'] }, active: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  })
}
```

### 3. `backend/src/controllers/employees.ts` (NEW)

```typescript
import type { Request, Response, NextFunction } from 'express'
import { listUsers, getUser, createUser, updateUser, listAvailableManagers } from '../services/user.js'

const VALID_ROLES = ['ADMIN', 'MANAGER', 'EMPLOYEE'] as const
type UserRole = (typeof VALID_ROLES)[number]

function isValidRole(value: unknown): value is UserRole {
  return VALID_ROLES.includes(value as UserRole)
}

export async function listEmployeesController(req: Request, res: Response, next: NextFunction) {
  try {
    const pageParam = Number(req.query['page'])
    const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1
    const limitParam = Number(req.query['limit'])
    const limit = Number.isInteger(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 20

    const { data, total } = await listUsers(page, limit)
    res.status(200).json({ success: true, data, meta: { page, limit, total } })
  } catch (err) {
    next(err)
  }
}

export async function getEmployeeController(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string }
    const user = await getUser(id)
    res.status(200).json({ success: true, data: user })
  } catch (err) {
    next(err)
  }
}

export async function createEmployeeController(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, name, password, role, departmentId, managerId } = req.body as Record<string, unknown>

    if (!email || typeof email !== 'string' || email.trim() === '') {
      res.status(400).json({ success: false, error: 'email is required' })
      return
    }
    if (!name || typeof name !== 'string' || name.trim() === '') {
      res.status(400).json({ success: false, error: 'name is required' })
      return
    }
    if (!password || typeof password !== 'string' || password.trim() === '') {
      res.status(400).json({ success: false, error: 'password is required' })
      return
    }
    if (!isValidRole(role)) {
      res.status(400).json({ success: false, error: 'role must be one of: ADMIN, MANAGER, EMPLOYEE' })
      return
    }
    if (departmentId !== undefined && departmentId !== null && typeof departmentId !== 'string') {
      res.status(400).json({ success: false, error: 'departmentId must be a string or null' })
      return
    }
    if (managerId !== undefined && managerId !== null && typeof managerId !== 'string') {
      res.status(400).json({ success: false, error: 'managerId must be a string or null' })
      return
    }

    const user = await createUser({
      email: (email as string).trim().toLowerCase(),
      name: (name as string).trim(),
      password: password as string,
      role,
      departmentId: departmentId as string | undefined,
      managerId: managerId as string | undefined,
    })
    res.status(201).json({ success: true, data: user })
  } catch (err) {
    next(err)
  }
}

export async function updateEmployeeController(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string }
    const { name, role, departmentId, managerId, active } = req.body as Record<string, unknown>

    if (name !== undefined && (typeof name !== 'string' || (name as string).trim() === '')) {
      res.status(400).json({ success: false, error: 'name must be a non-empty string' })
      return
    }
    if (role !== undefined && !isValidRole(role)) {
      res.status(400).json({ success: false, error: 'role must be one of: ADMIN, MANAGER, EMPLOYEE' })
      return
    }
    if (departmentId !== undefined && departmentId !== null && typeof departmentId !== 'string') {
      res.status(400).json({ success: false, error: 'departmentId must be a string or null' })
      return
    }
    if (managerId !== undefined && managerId !== null && typeof managerId !== 'string') {
      res.status(400).json({ success: false, error: 'managerId must be a string or null' })
      return
    }
    if (active !== undefined && typeof active !== 'boolean') {
      res.status(400).json({ success: false, error: 'active must be a boolean' })
      return
    }

    const updates: Parameters<typeof updateUser>[1] = {}
    if (name !== undefined) updates.name = (name as string).trim()
    if (role !== undefined) updates.role = role as UserRole
    if (departmentId !== undefined) updates.departmentId = departmentId as string | null
    if (managerId !== undefined) updates.managerId = managerId as string | null
    if (active !== undefined) updates.active = active as boolean

    const user = await updateUser(id, updates)
    res.status(200).json({ success: true, data: user })
  } catch (err) {
    next(err)
  }
}

export async function listAvailableManagersController(_req: Request, res: Response, next: NextFunction) {
  try {
    const managers = await listAvailableManagers()
    res.status(200).json({ success: true, data: managers })
  } catch (err) {
    next(err)
  }
}
```

### 4. `backend/src/routes/employees.ts` (NEW)

```typescript
import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import {
  listEmployeesController,
  getEmployeeController,
  createEmployeeController,
  updateEmployeeController,
  listAvailableManagersController,
} from '../controllers/employees.js'

export const employeesRouter = Router()

// CRITICAL: /available-managers MUST come before /:id or Express treats
// the literal string "available-managers" as the :id param.
employeesRouter.get('/available-managers', authenticate, listAvailableManagersController)

employeesRouter.get('/', authenticate, requireRole(['ADMIN']), listEmployeesController)
employeesRouter.get('/:id', authenticate, requireRole(['ADMIN']), getEmployeeController)
employeesRouter.post('/', authenticate, requireRole(['ADMIN']), createEmployeeController)
employeesRouter.patch('/:id', authenticate, requireRole(['ADMIN']), updateEmployeeController)
```

### 5. `backend/src/routes/index.ts` (UPDATE — add two lines only)

```typescript
import { employeesRouter } from './employees.js'
// ...
router.use('/employees', employeesRouter)
```

Add alongside the existing `/auth`, `/departments`, `/leave-types`, `/company-holidays` mounts. Do not restructure the file.

### 6. `frontend/src/features/employees/index.tsx` (UPDATE — replace the stub)

Follow `frontend/src/features/departments/index.tsx` structure exactly — same `errorMessage()` helper, same inline `Modal` component, same loading/error state shape.

Key differences from departments page:
- Load three lists on mount: employees (`GET /employees`), departments (`GET /departments`), available managers (`GET /employees/available-managers`).
- Employee table columns: **Name | Email | Role | Department | Status | Actions** (Edit + Deactivate/Activate).
- Department and manager names resolved client-side using loaded departments/managers arrays (same pattern as `managerName()` helper in DepartmentsPage).
- **Add Employee modal fields**: name (text), email (text), password (password type input), role (select: EMPLOYEE/MANAGER/ADMIN, default EMPLOYEE), department (select, optional), manager (select, optional).
- **Edit Employee modal fields**: name, role, department, manager. No password field on edit. Diff-based PATCH — only send changed fields.
- **Deactivate/Activate button**: inline, no modal; calls `PATCH /employees/:id` with `{ active: !employee.active }`.
- Use `User` from `'../../lib/types.js'` and `ApiListResponse`, `ApiResponse`, `ApiError` from same import.
- Do NOT extract any new shared components — inline `Modal` pattern only, same as departments.
- Story 3.2 will add search/filter/pagination controls to this page; do NOT add them in 3.1.

---

## File Checklist

| File | Action | Notes |
|------|--------|-------|
| `backend/src/services/leaveBalance.ts` | UPDATE | Add `provisionBalancesForNewUser(userId)` — do not modify existing function |
| `backend/src/services/user.ts` | NEW | CRUD logic; uses `USER_SELECT` to exclude `passwordHash`; calls `provisionBalancesForNewUser` on create; deletes refresh tokens on deactivation |
| `backend/src/controllers/employees.ts` | NEW | Thin handlers; validates all inputs; AD-10 envelope; `next(err)` on throw |
| `backend/src/routes/employees.ts` | NEW | `/available-managers` BEFORE `/:id`; GET / and GET /:id and POST / and PATCH /:id all admin-only; `/available-managers` any authenticated |
| `backend/src/routes/index.ts` | UPDATE | Add `router.use('/employees', employeesRouter)` |
| `frontend/src/features/employees/index.tsx` | UPDATE | Replace stub; loads employees + departments + managers; table with Edit/Deactivate actions; Add and Edit modals |

**Do NOT touch:** `backend/src/prisma/schema.prisma`, `backend/src/services/auth.ts`, `backend/src/middleware/auth.ts`, `backend/src/middleware/rbac.ts`, `backend/src/middleware/error.ts`, `frontend/src/lib/types.ts`, `frontend/src/App.tsx`, `backend/src/services/department.ts`.

---

## Testing Requirements

Follow existing Vitest patterns in `backend/src/services/department.test.ts` (mock `'../prisma/client.js'`, mock `'dotenv/config'`, `vi.clearAllMocks()` in `beforeEach`).

`backend/src/services/user.test.ts` (NEW):

- **`createUser`:**
  - Happy path: mocks `findUnique` (dept) → found+active, `findUnique` (mgr) → found+active, `findUnique` (email) → null, `create` → mock row, `provisionBalancesForNewUser` → void. Assert returned result has no `passwordHash`. Assert `provisionBalancesForNewUser` was called with the new user's id.
  - Duplicate email via pre-check: `findUnique` for email returns existing row → throws 409.
  - Duplicate email via P2002: `findUnique` email returns null but `create` throws `{ code: 'P2002' }` → 409 (dual-layer guard).
  - Invalid department: `findUnique` dept returns null → throws 400.
  - Inactive department: `findUnique` dept returns `{ active: false }` → throws 400.
  - Invalid manager: `findUnique` mgr returns null → throws 400.

- **`updateUser`:**
  - Happy path: all validations pass, `update` returns updated row.
  - Not found: initial `findUnique` returns null → throws 404.
  - Deactivation: `updates.active === false` → assert `prisma.refreshToken.deleteMany` called with `{ where: { userId: id } }`.
  - No token deletion when active not changed or set to true.

- **`listUsers`:**
  - Assert `findMany` is called with correct `skip`, `take`, `orderBy: { name: 'asc' }`.
  - Assert no `passwordHash` field in returned items.

- **`listAvailableManagers`:**
  - Assert `findMany` with `where: { role: { in: ['ADMIN', 'MANAGER'] }, active: true }`.

---

## Dev Notes

- **Architecture compliance:** AD-1 (RBAC on all mutating employee routes), AD-2 (balance writes via `services/leaveBalance`), AD-3 (pagination on list), AD-10 (response envelope), AD-11 (no cross-boundary imports), AD-15 (eager balance provisioning on user create).
- **Stack:** Express 5, Prisma 7, bcryptjs 3.x (already installed for auth), React 18, TailwindCSS v4.
- **Email normalisation:** Lowercase + trim the `email` field in the controller before passing to the service to prevent duplicate accounts with different cases (`Alice@demo.com` vs `alice@demo.com`).
- **Password hashing cost:** Use `bcrypt.hash(password, 10)` — same cost factor as the auth service and seed.
- **Session invalidation on deactivate:** `prisma.refreshToken.deleteMany({ where: { userId: id } })` in `updateUser` when `active === false`. This is in the service layer (after the `prisma.user.update` call) — no transaction needed since the order is safe (user is already deactivated when tokens are deleted).
- **Available managers scope difference:** `GET /employees/available-managers` returns ADMIN+MANAGER role users (any user can be a reporting manager regardless of role, and admins often manage teams). The existing `GET /departments/available-managers` returns only MANAGER users — that constraint is for department manager assignment, not employee reporting hierarchy.
- **Story 3.2 extension:** The `listUsers` function accepts an optional `_filters` parameter (unused in 3.1). When 3.2 implements search/filter, it will populate this object and add `where` clauses to the Prisma query. Do not add any filter logic now.
- **Previous story intelligence (2.3 Holiday Management, done):** Dual-layer duplicate guard, `next(err)` + `errorHandler`, AD-10 on every response, thin controllers with no Prisma access, `requireRole(['ADMIN'])` on mutating routes, `authenticate` only on read routes where appropriate.

### Project Structure Notes

- `services/user.ts` is the canonical name per the architecture capability map (`FR-EMP → services/user`).
- `controllers/employees.ts` and `routes/employees.ts` follow the kebab-case plural pattern for controller/route files.
- No structural conflicts: all paths are pre-named slots in the architecture structural seed.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.1: Employee Account Management]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-employee-leave-management-system-2026-06-29/ARCHITECTURE-SPINE.md#AD-1, AD-2, AD-3, AD-10, AD-15]
- [Source: backend/src/services/department.ts (template for services/user.ts)]
- [Source: backend/src/controllers/departments.ts (template for controllers/employees.ts)]
- [Source: backend/src/routes/departments.ts (template for routes/employees.ts)]
- [Source: frontend/src/features/departments/index.tsx (template for features/employees/index.tsx)]
- [Source: backend/src/services/leaveBalance.ts (must add provisionBalancesForNewUser here)]
- [Source: backend/src/services/auth.ts (login checks !user.active — no changes needed)]
- [Source: backend/src/prisma/schema.prisma#model User]

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (Claude Code)

### Debug Log References

None.

### Completion Notes List

- Added `provisionBalancesForNewUser(userId)` to `backend/src/services/leaveBalance.ts` per AD-15; provisions one leave_balances row per active leave type for a new employee.
- Created `backend/src/services/user.ts` with `listUsers`, `getUser`, `createUser`, `updateUser`, `listAvailableManagers`. Dual-layer duplicate email guard (pre-check + P2002 catch). Validates departmentId (must be active) and managerId (must be active). Deletes refresh tokens on deactivation. `USER_SELECT` constant excludes `passwordHash` from all query results. `listUsers` accepts optional `_filters` parameter shell for Story 3.2.
- Created `backend/src/controllers/employees.ts` — thin handlers with full input validation; all errors forwarded via `next(err)`.
- Created `backend/src/routes/employees.ts` — `/available-managers` declared before `/:id` to avoid Express treating the literal as an ID param. ADMIN-only on all mutating/listing routes; any authenticated user on `/available-managers`.
- Updated `backend/src/routes/index.ts` — added two lines: import + mount of `employeesRouter` at `/employees`.
- Replaced `frontend/src/features/employees/index.tsx` stub with full implementation. Loads employees, departments, and available-managers on mount. Resolves department name client-side. Add modal (name, email, password, role, optional department, optional manager). Edit modal (name, role, department, manager — no password; diff-based PATCH). Inline Deactivate/Activate. Same Modal, errorMessage patterns as departments page.
- Created `backend/src/services/user.test.ts` with 18 tests covering all story-specified scenarios: happy path, duplicate email (both layers), inactive/missing department, inactive/missing manager, 404 on not found, refresh token deletion on deactivate, no-op on activate, correct pagination params, no passwordHash in output, available-managers query.
- All 91 backend tests pass. TypeScript strict check passes for both backend and frontend.
- All 9 ACs satisfied: POST /employees (AC1), PATCH update fields (AC2), PATCH active toggle (AC3), GET /:id profile (AC4), GET / list with pagination (AC5), GET /available-managers (AC6), Add modal (AC7), Edit modal (AC8), Deactivate/Activate UI (AC9).

### File List

- `backend/src/services/leaveBalance.ts` — updated (added `provisionBalancesForNewUser`)
- `backend/src/services/user.ts` — new
- `backend/src/controllers/employees.ts` — new
- `backend/src/routes/employees.ts` — new
- `backend/src/routes/index.ts` — updated (import + mount employeesRouter)
- `frontend/src/features/employees/index.tsx` — updated (replaced stub)
- `backend/src/services/user.test.ts` — new

### Change Log

- 2026-07-01: Story 3.1 created — Employee Account Management.
- 2026-07-01: Story 3.1 implemented — all ACs satisfied, 18 new tests, 91 total passing.
