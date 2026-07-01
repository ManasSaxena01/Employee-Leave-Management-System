---
story_id: "2.3"
story_key: "2-3-company-holiday-management-and-working-day-calculation"
epic: 2
story: 3
title: "Company Holiday Management & Working-Day Calculation"
status: "review"
created: "2026-07-01"
epic_title: "Admin System Configuration — Departments, Leave Types & Holidays"
baseline_commit: "79490a2"
---

# Story 2.3: Company Holiday Management & Working-Day Calculation

## Status: review

## Story

**As an admin,**
I want to create, edit, and delete company holidays,
**So that** leave duration calculations correctly exclude public holidays, and all users can see upcoming holidays.

---

## Acceptance Criteria

**AC1 — Create holiday:**
Given an admin is authenticated,
When `POST /api/company-holidays` is called with `{ date: "YYYY-MM-DD", name }`,
Then a 201 response returns the new holiday; a duplicate date returns 409.

**AC2 — Edit holiday:**
Given an existing holiday,
When `PATCH /api/company-holidays/:id` is called with a new date or name,
Then a 200 response reflects the update.

**AC3 — Delete holiday:**
Given an existing holiday,
When `DELETE /api/company-holidays/:id` is called by an admin,
Then a 200 response confirms deletion; the holiday no longer appears in any list or working-day calculation.

**AC4 — List holidays (all authenticated users):**
Given any authenticated user,
When `GET /api/company-holidays` is called,
Then all holidays are returned in ascending date order (paginated per AD-3); no role restriction on reads.

**AC5 — Working-day utility:**
Given `backend/src/utils/workingDays.ts`,
When called with a start date, end date, and the current holidays list,
Then it returns the count of weekdays (Mon–Fri) in that inclusive range that do not fall on any company holiday.
**[ALREADY DONE — this file is fully implemented and tested. Do NOT recreate it.]**

**AC6 — Admin UI:**
Given the admin UI,
When the Company Holidays page (`/holidays`) is visited,
Then a table lists all holidays with date and name columns; Add, Edit, and Delete actions are available; the date picker enforces `YYYY-MM-DD` format.

---

## ⚠️ CRITICAL — Read Before Coding

This is the **third CRUD admin feature** in this project. Stories 2.1 (Department Management) and 2.2 (Leave Type Management) established the exact pattern this story copies:
`services/{resource}.ts` (plain function exports) → `controllers/{resource}.ts` (thin, AD-10 envelope, `next(err)`) → `routes/{resource}.ts` (mounted in `routes/index.ts`) → `frontend/src/features/{resource}/index.tsx` (replace the stub).

Read `backend/src/services/department.ts`, `backend/src/controllers/departments.ts`, `backend/src/routes/departments.ts`, and `frontend/src/features/departments/index.tsx` in full before starting — they are your template.

### Already in place — do NOT recreate

- **`backend/src/utils/workingDays.ts`** — FULLY IMPLEMENTED AND TESTED. Exports `calculateWorkingDays(startDate: Date, endDate: Date, holidays: Date[]): number`. Import it, don't recreate it.
- **`backend/src/utils/workingDays.test.ts`** — 5 tests already passing. Do not modify.
- **`frontend/src/features/holidays/index.tsx`** exists as a stub (`<div>Holidays</div>`) — replace its contents, don't create a new file.
- **`frontend/src/lib/types.ts`** already exports `CompanyHoliday { id, date, name, createdAt, updatedAt }` — reuse it, don't redefine.
- **`frontend/src/App.tsx`** already routes `/holidays` through `RequireRole roles={['ADMIN']}` → `HolidaysPage` — no router changes needed.
- **`backend/src/prisma/schema.prisma`** already has the `CompanyHoliday` model with `date DateTime @unique @db.Date` and `@@map("company_holidays")` — no migration needed.
- `backend/src/middleware/auth.ts` (`authenticate`) and `backend/src/middleware/rbac.ts` (`requireRole`) are done and tested — reuse them, don't modify.
- `backend/src/middleware/error.ts` (`errorHandler`) formats every thrown error into the AD-10 envelope — throw `Object.assign(new Error(msg), { status: 4xx })` from services.

---

## STOP — Critical Guardrails

| # | Risk | Wrong | Correct |
|---|------|-------|---------|
| 1 | **`workingDays.ts` already exists — don't recreate it** | Creating a new `calculateWorkingDays` function anywhere | Import `{ calculateWorkingDays }` from `'../utils/workingDays.js'` (Story 4.1 will use it from `services/leaveRequest.ts`) |
| 2 | **Timezone shift on date parsing** — JavaScript's `new Date("2026-01-01")` is UTC midnight, but `new Date("2026-01-01T00:00:00")` (no Z) may be local time in some Node environments | `new Date(input.date)` without timezone anchor, or `new Date(input.date + 'T00:00:00')` | Parse as explicit UTC: `new Date(input.date + 'T00:00:00.000Z')`. The Prisma `DateTime @db.Date` field returns dates as JS `Date` objects at UTC midnight — write them the same way to avoid off-by-one day bugs. |
| 3 | **Date serialized as ISO datetime in API response** — Prisma returns `DateTime @db.Date` as a JS `Date` object; `res.json()` calls `.toISOString()` giving `"2026-01-01T00:00:00.000Z"`, not `"2026-01-01"` | Passing the raw Prisma `Date` object through to the response | In the service's `HolidayResult` interface, type `date` as `string`, and convert it explicitly: `date: holiday.date.toISOString().slice(0, 10)`. The architecture convention (Consistency table) mandates `YYYY-MM-DD` for calendar date fields in API payloads. |
| 4 | **Duplicate date race condition** — same gap found in 2.1's review | Relying solely on a `findUnique` pre-check before `create()` | Pre-check with `findFirst({ where: { date } })` for fast 409, **and** wrap `prisma.companyHoliday.create()` in a try/catch that translates `P2002` → 409. Apply the same dual-layer pattern to the `date`-change path in `updateHoliday`. |
| 5 | **GET endpoint role restriction** — AC4 explicitly says no role restriction on reads | Adding `requireRole(['ADMIN'])` to the GET route | `companyHolidaysRouter.get('/', authenticate, listCompanyHolidaysController)` — `authenticate` only, no `requireRole`. POST/PATCH/DELETE need `requireRole(['ADMIN'])`. |
| 6 | **App.tsx route restriction** — The frontend `/holidays` page is correctly ADMIN-only for management | Changing `RequireRole roles={['ADMIN']}` in App.tsx | Do NOT touch App.tsx. The management page is admin-only. The GET API endpoint being open to all roles is a separate, backend-only concern for use in other features (calendar in Epic 5, leave submission in Epic 4). |
| 7 | **Ordering** | Returning holidays in creation order or unordered | `orderBy: { date: 'asc' }` on all list queries (AC4 requirement). |
| 8 | **Not-found on PATCH/DELETE** | Silently succeeding or Prisma throwing P2025 unhandled | In `updateHoliday` and `deleteHoliday`, call `findUnique({ where: { id } })` first; throw `Object.assign(new Error('Company holiday not found'), { status: 404 })` if null. |
| 9 | **Unbounded list response** | `GET /company-holidays` returning a bare array | Must return the full AD-3/AD-10 envelope: `{ success: true, data: HolidayResult[], meta: { page, limit, total } }`, default `limit=20`. |
| 10 | **Route not mounted** | New `companyHolidaysRouter` created but never wired | Add `router.use('/company-holidays', companyHolidaysRouter)` to the **existing** `backend/src/routes/index.ts` (alongside `/auth`, `/departments`, `/leave-types`). |
| 11 | **DELETE response envelope** | Returning empty body or `data: undefined` | Return `{ success: true, data: null }` to keep all responses AD-10 compliant (every response has `success` and `data`). |
| 12 | **Date validation on input** | Accepting any string for `date` without format check | Validate `date` matches `/^\d{4}-\d{2}-\d{2}$/` in the controller before passing to the service. Also validate the resulting `Date` is not `NaN`. |

---

## Implementation Guide

### 1. `backend/src/services/holiday.ts` (NEW)

```typescript
import { prisma } from '../prisma/client.js'

// isUniqueConstraintError: same pattern as department.ts (no Prisma import needed)
function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002'
}

// Calendar dates are YYYY-MM-DD strings in API payloads (architecture Consistency table)
export interface HolidayResult {
  id: string
  date: string       // YYYY-MM-DD, NOT a full ISO datetime
  name: string
  createdAt: Date
  updatedAt: Date
}

function toResult(h: { id: string; date: Date; name: string; createdAt: Date; updatedAt: Date }): HolidayResult {
  return { ...h, date: h.date.toISOString().slice(0, 10) }
}

// Parse a YYYY-MM-DD string to UTC Date to avoid timezone shift
function parseDateUTC(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00.000Z')
}

export async function listHolidays(
  page: number,
  limit: number
): Promise<{ data: HolidayResult[]; total: number }> {
  const [rows, total] = await Promise.all([
    prisma.companyHoliday.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { date: 'asc' },
    }),
    prisma.companyHoliday.count(),
  ])
  return { data: rows.map(toResult), total }
}

export async function createHoliday(input: { date: string; name: string }): Promise<HolidayResult> {
  const parsedDate = parseDateUTC(input.date)

  const existing = await prisma.companyHoliday.findFirst({ where: { date: parsedDate } })
  if (existing) {
    throw Object.assign(new Error('A holiday already exists on this date'), { status: 409 })
  }

  try {
    const holiday = await prisma.companyHoliday.create({
      data: { date: parsedDate, name: input.name },
    })
    return toResult(holiday)
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw Object.assign(new Error('A holiday already exists on this date'), { status: 409 })
    }
    throw err
  }
}

export async function updateHoliday(
  id: string,
  updates: { date?: string; name?: string }
): Promise<HolidayResult> {
  const holiday = await prisma.companyHoliday.findUnique({ where: { id } })
  if (!holiday) {
    throw Object.assign(new Error('Company holiday not found'), { status: 404 })
  }

  const data: { date?: Date; name?: string } = {}

  if (updates.date !== undefined) {
    const parsedDate = parseDateUTC(updates.date)
    if (parsedDate.getTime() !== holiday.date.getTime()) {
      const conflict = await prisma.companyHoliday.findFirst({ where: { date: parsedDate } })
      if (conflict) {
        throw Object.assign(new Error('A holiday already exists on this date'), { status: 409 })
      }
    }
    data.date = parsedDate
  }
  if (updates.name !== undefined) data.name = updates.name

  try {
    const updated = await prisma.companyHoliday.update({ where: { id }, data })
    return toResult(updated)
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw Object.assign(new Error('A holiday already exists on this date'), { status: 409 })
    }
    throw err
  }
}

export async function deleteHoliday(id: string): Promise<void> {
  const holiday = await prisma.companyHoliday.findUnique({ where: { id } })
  if (!holiday) {
    throw Object.assign(new Error('Company holiday not found'), { status: 404 })
  }
  await prisma.companyHoliday.delete({ where: { id } })
}
```

### 2. `backend/src/controllers/companyHolidays.ts` (NEW)

Thin controllers — parse request, validate types/format, call service, respond with AD-10 envelope, `next(err)` on throw. Mirror `controllers/departments.ts` exactly.

```typescript
import type { Request, Response, NextFunction } from 'express'
import { listHolidays, createHoliday, updateHoliday, deleteHoliday } from '../services/holiday.js'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export async function listCompanyHolidaysController(req: Request, res: Response, next: NextFunction) {
  try {
    const pageParam = Number(req.query['page'])
    const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1
    const limitParam = Number(req.query['limit'])
    const limit = Number.isInteger(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 20

    const { data, total } = await listHolidays(page, limit)
    res.status(200).json({ success: true, data, meta: { page, limit, total } })
  } catch (err) {
    next(err)
  }
}

export async function createCompanyHolidayController(req: Request, res: Response, next: NextFunction) {
  try {
    const { date, name } = req.body as { date?: unknown; name?: unknown }

    if (typeof date !== 'string' || !DATE_REGEX.test(date) || isNaN(new Date(date + 'T00:00:00.000Z').getTime())) {
      res.status(400).json({ success: false, error: 'date must be a valid YYYY-MM-DD string' })
      return
    }
    if (!name || typeof name !== 'string' || name.trim() === '') {
      res.status(400).json({ success: false, error: 'name is required' })
      return
    }

    const holiday = await createHoliday({ date, name: name.trim() })
    res.status(201).json({ success: true, data: holiday })
  } catch (err) {
    next(err)
  }
}

export async function updateCompanyHolidayController(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string }
    const { date, name } = req.body as { date?: unknown; name?: unknown }

    if (date !== undefined) {
      if (typeof date !== 'string' || !DATE_REGEX.test(date) || isNaN(new Date(date + 'T00:00:00.000Z').getTime())) {
        res.status(400).json({ success: false, error: 'date must be a valid YYYY-MM-DD string' })
        return
      }
    }
    if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
      res.status(400).json({ success: false, error: 'name must be a non-empty string' })
      return
    }

    const updates: { date?: string; name?: string } = {}
    if (date !== undefined) updates.date = date as string
    if (name !== undefined) updates.name = (name as string).trim()

    const holiday = await updateHoliday(id, updates)
    res.status(200).json({ success: true, data: holiday })
  } catch (err) {
    next(err)
  }
}

export async function deleteCompanyHolidayController(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string }
    await deleteHoliday(id)
    res.status(200).json({ success: true, data: null })
  } catch (err) {
    next(err)
  }
}
```

### 3. `backend/src/routes/companyHolidays.ts` (NEW)

```typescript
import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import {
  listCompanyHolidaysController,
  createCompanyHolidayController,
  updateCompanyHolidayController,
  deleteCompanyHolidayController,
} from '../controllers/companyHolidays.js'

export const companyHolidaysRouter = Router()

// AC4: all authenticated users can read the holiday list (no requireRole)
companyHolidaysRouter.get('/', authenticate, listCompanyHolidaysController)
// AC1/AC2/AC3: only admins can manage holidays
companyHolidaysRouter.post('/', authenticate, requireRole(['ADMIN']), createCompanyHolidayController)
companyHolidaysRouter.patch('/:id', authenticate, requireRole(['ADMIN']), updateCompanyHolidayController)
companyHolidaysRouter.delete('/:id', authenticate, requireRole(['ADMIN']), deleteCompanyHolidayController)
```

### 4. `backend/src/routes/index.ts` (UPDATE — add two lines only)

```typescript
import { companyHolidaysRouter } from './companyHolidays.js'
// ...
router.use('/company-holidays', companyHolidaysRouter)
```

Add these two lines alongside the existing `/departments` and `/leave-types` mounts. Do not restructure the file.

### 5. `frontend/src/features/holidays/index.tsx` (UPDATE — replace the stub)

Follow `frontend/src/features/departments/index.tsx` structure precisely — same `errorMessage()` helper, same `Modal` component, same loading/error state shape. Key differences from the departments page:

- Fetch `GET /company-holidays` via `apiClient` on mount and after every mutation.
- Render a table: Date | Name | Actions (Edit, Delete).
- "Add Holiday" button opens a modal with: a date input (`type="date"`, renders YYYY-MM-DD), a name text input.
- On submit: `POST /company-holidays { date, name }`. The `<input type="date">` yields a YYYY-MM-DD string — pass it directly.
- Edit modal: pre-fills `date` and `name`; on save, sends `PATCH /company-holidays/:id` with only changed fields (diff-based, like departments).
- Delete button: `DELETE /company-holidays/:id` — no modal needed; confirm inline or just send the request.
- Sort the displayed table by date ascending (the API already returns sorted; just render in order).
- Surface 409/400 errors inline using the same `axiosError?.response?.data?.error` pattern.
- No new shared component — reuse the same inline `Modal` pattern as `features/departments/index.tsx`. Do not extract a generic component library.
- Use `CompanyHoliday` from `'../../lib/types.js'` and `ApiListResponse`, `ApiResponse`, `ApiError` from the same import.

---

## File Checklist

| File | Action | Notes |
|------|--------|-------|
| `backend/src/services/holiday.ts` | NEW | All Prisma access; `toResult()` formats date as YYYY-MM-DD; `parseDateUTC()` prevents tz shift |
| `backend/src/controllers/companyHolidays.ts` | NEW | Thin handlers, AD-10 envelope, date format validation |
| `backend/src/routes/companyHolidays.ts` | NEW | GET open to all authenticated; POST/PATCH/DELETE admin-only |
| `backend/src/routes/index.ts` | UPDATE | Add `router.use('/company-holidays', companyHolidaysRouter)` |
| `frontend/src/features/holidays/index.tsx` | UPDATE | Replace stub with full CRUD UI |

**Do NOT touch:** `backend/src/utils/workingDays.ts` (already complete), `backend/src/utils/workingDays.test.ts` (already passing), `backend/src/prisma/schema.prisma` (model exists), `frontend/src/lib/types.ts` (`CompanyHoliday` exists), `frontend/src/App.tsx` (route wired), any middleware, any other service.

---

## Testing Requirements

Follow the existing Vitest patterns in `backend/src/services/department.test.ts` (mock `'../prisma/client.js'`, mock `'dotenv/config'`, `vi.clearAllMocks()` in `beforeEach`).

`backend/src/services/holiday.test.ts` (NEW):

- **`createHoliday`:**
  - Happy path: mocked `findFirst` returns null, `create` returns a mock holiday row; assert `toResult` produces YYYY-MM-DD `date`.
  - Duplicate date via pre-check: `findFirst` returns an existing row → throws 409 with correct message.
  - Duplicate date via concurrent P2002: `findFirst` returns null but `create` throws `{ code: 'P2002' }` → also throws 409 (Guardrail 4 — must test both paths).
  - Invalid date string: N/A in service (controller validates); service trusts caller.

- **`updateHoliday`:**
  - Happy path date change: `findUnique` returns existing, `findFirst` on new date returns null, `update` succeeds.
  - Happy path name-only change: `findUnique` returns existing, no date check skipped correctly, `update` succeeds.
  - Not found: `findUnique` returns null → throws 404.
  - Duplicate date on update via pre-check → 409.
  - Duplicate date on update via P2002 → 409.
  - Same date (no change): assert `findFirst` for duplicate check is NOT called when new date equals existing date.

- **`deleteHoliday`:**
  - Happy path: `findUnique` returns existing, `delete` called with correct `{ where: { id } }`.
  - Not found: `findUnique` returns null → throws 404.

- **`listHolidays`:**
  - Assert `findMany` is called with `orderBy: { date: 'asc' }` and correct `skip`/`take`.
  - Assert returned `date` fields are YYYY-MM-DD strings (not ISO datetimes).

Note: `workingDays.test.ts` already covers the utility function comprehensively — do not add to it.

---

## Dev Notes

- **Architecture compliance:** AD-1 (RBAC on mutating routes), AD-3 (pagination contract), AD-9 (`utils/workingDays.ts` is the single working-day implementation — this story wires the holiday table it depends on), AD-10 (response envelope), AD-11 (routes → controllers → services → Prisma).
- **Stack:** Express 5, Prisma 7 (client in `backend/src/prisma/client.ts`), React 18, TailwindCSS v4 (utility classes consistent with `features/departments/index.tsx`).
- **Conventions:** `camelCase.ts` file names; HTTP route is `kebab-case` plural noun `/company-holidays`.
- **Future integration note (Story 4.1 / leaveRequest.submit):** When `services/leaveRequest.ts` eventually calls `calculateWorkingDays`, it will fetch holidays via `prisma.companyHoliday.findMany()` (or call an exported helper from this service) and pass `holidays.map(h => h.date)` — those are already JS `Date` objects from Prisma, matching the `calculateWorkingDays(startDate, endDate, holidays: Date[])` signature.
- **Previous story intelligence (2.2 Leave Type Management, done):** Same dual-layer duplicate guard required (Guardrail 4). Same `next(err)` + `errorHandler` pattern. Same AD-10 envelope on every response. Runtime-validate every PATCH field (date, name). No Prisma calls in controllers.
- **Date input in React:** Use `<input type="date" />` — modern browsers render a date picker and yield a YYYY-MM-DD string via `e.target.value`. This matches the API's expected `date` format directly.

### Project Structure Notes

- No structural conflicts: `services/holiday.ts`, `controllers/companyHolidays.ts`, `routes/companyHolidays.ts`, and `features/holidays/` are all pre-named slots in the architecture structural seed.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3: Company Holiday Management & Working-Day Calculation]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-employee-leave-management-system-2026-06-29/ARCHITECTURE-SPINE.md#AD-1, AD-3, AD-9, AD-10, AD-11]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-employee-leave-management-system-2026-06-29/ARCHITECTURE-SPINE.md#Consistency Conventions (Dates: YYYY-MM-DD)]
- [Source: backend/src/prisma/schema.prisma#model CompanyHoliday]
- [Source: backend/src/utils/workingDays.ts (already implemented — do not recreate)]
- [Source: _bmad-output/implementation-artifacts/2-2-leave-type-management.md (reference implementation pattern + learnings)]
- [Source: _bmad-output/implementation-artifacts/2-1-department-management.md (reference implementation pattern)]

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (claude-sonnet-4-6)

### Debug Log References

None.

### Completion Notes List

- Implemented `backend/src/services/holiday.ts` with dual-layer duplicate-date guard (pre-check + P2002 catch) on both create and update paths.
- `toResult()` converts Prisma `DateTime @db.Date` objects to `YYYY-MM-DD` strings; `parseDateUTC()` anchors all date parsing to UTC midnight to prevent timezone shift.
- `updateHoliday` skips the duplicate-date `findFirst` when the incoming date equals the existing date (same-date no-op).
- Implemented `backend/src/controllers/companyHolidays.ts` — thin handlers with input validation (date regex + NaN guard, name non-empty), AD-10 envelope on all responses.
- Implemented `backend/src/routes/companyHolidays.ts` — GET open to all authenticated users (AC4); POST/PATCH/DELETE require `requireRole(['ADMIN'])`.
- Mounted `companyHolidaysRouter` at `/company-holidays` in `backend/src/routes/index.ts`.
- Replaced stub `frontend/src/features/holidays/index.tsx` with full CRUD UI: table of Date/Name/Actions, Add/Edit modals, Delete inline. Mirrors `features/departments/index.tsx` patterns exactly.
- All 13 new service tests pass; full suite 69/69 passes. TypeScript clean on backend and frontend.

### File List

- `backend/src/services/holiday.ts` — NEW
- `backend/src/services/holiday.test.ts` — NEW
- `backend/src/controllers/companyHolidays.ts` — NEW
- `backend/src/routes/companyHolidays.ts` — NEW
- `backend/src/routes/index.ts` — MODIFIED (added companyHolidaysRouter import and mount)
- `frontend/src/features/holidays/index.tsx` — MODIFIED (replaced stub with full CRUD UI)

### Change Log

- 2026-07-01: Implemented Story 2.3 — Company Holiday Management & Working-Day Calculation. Added backend service, controller, router, and frontend CRUD page for company holidays.
