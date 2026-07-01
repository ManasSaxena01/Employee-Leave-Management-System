---
story_id: "3.2"
story_key: "3-2-employee-list-search-filter-and-pagination"
epic: 3
story: 2
title: "Employee List Search, Filter & Pagination"
status: "review"
created: "2026-07-01"
epic_title: "Employee Management & Leave Balances"
baseline_commit: "79490a2"
---

# Story 3.2: Employee List Search, Filter & Pagination

## Status: review

## Story

As an admin,
I want to search employees by name or email and filter by department, with server-side paginated results,
So that I can efficiently locate any employee in organisations with many staff.

---

## Acceptance Criteria

**AC1 — Paginated list (no filters):**
Given `GET /employees` with no query parameters,
When called by an admin,
Then returns `{ success: true, data: [...], meta: { page, limit, total } }` with default `limit=20`; this is unchanged from Story 3.1 (AD-3).

**AC2 — Search by name or email:**
Given `GET /employees?search=alice`,
When processed by the server,
Then only employees whose name or email contains "alice" (case-insensitive) are returned.

**AC3 — Filter by department:**
Given `GET /employees?departmentId=<uuid>`,
When processed by the server,
Then only employees belonging to that department are returned; `search` and `departmentId` can be combined in a single request.

**AC4 — Pagination with accurate filtered total:**
Given `GET /employees?page=2&limit=10`,
When processed by the server,
Then the correct slice of results is returned and `meta.total` reflects the full filtered count (not the unfiltered row count).

**AC5 — Frontend search, filter, and pagination controls:**
Given the admin UI employee table,
When the page loads,
Then a search input and a department filter dropdown appear above the table; changing either re-fetches from page 1; pagination controls (Previous / Next / page indicator) appear below the table.

---

## ⚠️ CRITICAL — Read Before Coding

This story extends Story 3.1 without creating any new files. Read the current state of every file before touching it.

**Files to change (4 total):**

| File | Change |
|------|--------|
| `backend/src/services/user.ts` | Wire up `_filters` → real `where` clause |
| `backend/src/controllers/employees.ts` | Parse `search` + `departmentId` from `req.query`; pass to `listUsers` |
| `frontend/src/features/employees/index.tsx` | Add search input, department dropdown, pagination controls |
| `backend/src/services/user.test.ts` | Add filter test cases to existing `describe('listUsers()')` |

**Do NOT touch:** routes, route index, any service other than `user.ts`, `leaveBalance.ts`, `auth.ts`, middleware, schema, `App.tsx`, `types.ts`.

---

## STOP — Critical Guardrails

| # | Risk | Wrong | Correct |
|---|------|-------|---------|
| 1 | **Count divergence** | Only adding `where` to `findMany` but leaving `count()` as bare `count()` | Both `prisma.user.findMany({ where })` and `prisma.user.count({ where })` must receive the **same** `where` object — without this, `meta.total` is the unfiltered count while `data` is filtered, causing broken pagination |
| 2 | **Unused-param lint error** | Keeping the `_filters` underscore prefix in `listUsers` after wiring it up | Rename `_filters` to `filters`; TypeScript treats `_`-prefixed params as intentionally unused; once you read the value, remove the underscore |
| 3 | **Empty string treated as filter** | Passing `search: ""` to `listUsers` when no text is typed | Trim and convert empty string to `undefined` in the controller: `req.query['search'].trim() \|\| undefined`; the service should skip the `OR` clause when `filters?.search` is falsy |
| 4 | **Frontend: stale filters on page change** | Maintaining separate page-change handler that doesn't read current search/dept state | `loadEmployees` reads `page`, `search`, `filterDeptId` from closure at call time — these are up-to-date because the function is recreated on every render |
| 5 | **Frontend: page not reset on filter change** | User is on page 3, changes search, sees page 3 of new results (possibly empty) | Call `setPage(1)` in the search/dept change handlers; React 18 batches `setSearch(v)` + `setPage(1)` into one render and one effect invocation |
| 6 | **Frontend: total not tracked** | `meta.total` from API never stored; pagination controls can't know the last page | Add `const [total, setTotal] = useState(0)` and set it from `res.data.meta.total` in `loadEmployees` |
| 7 | **No new API endpoints** | Adding a separate `/employees/search` endpoint | Story 3.2 adds query params to the existing `GET /employees` endpoint only — no new routes |
| 8 | **`ApiListResponse` meta shape** | Reading `res.data.total` directly | `ApiListResponse` wraps `meta: { page, limit, total }` — use `res.data.meta.total` |

---

## Implementation Guide

### 1. `backend/src/services/user.ts` (UPDATE — wire `listUsers` filters)

Current `listUsers` (lines 43–59) ignores `_filters`. Replace with:

```typescript
export async function listUsers(
  page: number,
  limit: number,
  filters?: { search?: string; departmentId?: string }
): Promise<{ data: UserResult[]; total: number }> {
  const where = {
    ...(filters?.departmentId !== undefined ? { departmentId: filters.departmentId } : {}),
    ...(filters?.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: 'insensitive' as const } },
            { email: { contains: filters.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }
  const [data, total] = await Promise.all([
    prisma.user.findMany({
      select: USER_SELECT,
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: 'asc' },
    }),
    prisma.user.count({ where }),
  ])
  return { data: data as UserResult[], total }
}
```

Key changes from the Story 3.1 shell:
- Rename `_filters` → `filters` (remove underscore)
- Build `where` object from filters, then pass to **both** `findMany` and `count`
- `mode: 'insensitive' as const` — required to satisfy Prisma's `QueryMode` literal type; without `as const` TypeScript widens to `string` and the compiler rejects it

Remove the comment `// Story 3.2 will populate these; implement the shell now to avoid refactoring` since it is now implemented.

### 2. `backend/src/controllers/employees.ts` (UPDATE — parse query params)

In `listEmployeesController`, extract `search` and `departmentId` from `req.query` and pass them to `listUsers`:

```typescript
export async function listEmployeesController(req: Request, res: Response, next: NextFunction) {
  try {
    const pageParam = Number(req.query['page'])
    const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1
    const limitParam = Number(req.query['limit'])
    const limit = Number.isInteger(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 20

    const search =
      typeof req.query['search'] === 'string' ? req.query['search'].trim() || undefined : undefined
    const departmentId =
      typeof req.query['departmentId'] === 'string' ? req.query['departmentId'] : undefined

    const { data, total } = await listUsers(page, limit, { search, departmentId })
    res.status(200).json({ success: true, data, meta: { page, limit, total } })
  } catch (err) {
    next(err)
  }
}
```

Only `listEmployeesController` changes — no other controllers in this file need modification.

### 3. `frontend/src/features/employees/index.tsx` (UPDATE — add controls)

Add these state declarations to `EmployeesPage` (alongside existing state):

```tsx
const [search, setSearch] = useState('')
const [filterDeptId, setFilterDeptId] = useState('')
const [page, setPage] = useState(1)
const [total, setTotal] = useState(0)
const limit = 20
```

Replace `loadEmployees` to read filters + page from state and store `total`:

```tsx
async function loadEmployees() {
  setLoading(true)
  try {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (search.trim()) params.set('search', search.trim())
    if (filterDeptId) params.set('departmentId', filterDeptId)
    const res = await apiClient.get<ApiListResponse<User>>(`/employees?${params}`)
    setEmployees(res.data.data)
    setTotal(res.data.meta.total)
    setError(null)
  } catch (err) {
    setError(errorMessage(err, 'Failed to load employees'))
  } finally {
    setLoading(false)
  }
}
```

Replace the `useEffect` to re-run on filter/page changes:

```tsx
useEffect(() => {
  loadEmployees()
}, [page, search, filterDeptId]) // eslint-disable-line react-hooks/exhaustive-deps

useEffect(() => {
  loadDepartments()
  loadManagers()
}, [])
```

Add search/filter handlers that reset page to 1:

```tsx
function handleSearchChange(value: string) {
  setSearch(value)
  setPage(1)
}

function handleDeptFilterChange(value: string) {
  setFilterDeptId(value)
  setPage(1)
}
```

Add search input + department dropdown above the table (inside the `return`, above the `{loading ? ... : <table>}` block):

```tsx
<div className="flex gap-3 mb-4">
  <input
    type="text"
    placeholder="Search by name or email…"
    value={search}
    onChange={(e) => handleSearchChange(e.target.value)}
    className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
  />
  <select
    value={filterDeptId}
    onChange={(e) => handleDeptFilterChange(e.target.value)}
    className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
  >
    <option value="">All Departments</option>
    {departments.filter((d) => d.active).map((d) => (
      <option key={d.id} value={d.id}>
        {d.name}
      </option>
    ))}
  </select>
</div>
```

Add pagination controls below the table (after `</table>` and before the modals):

```tsx
{total > limit && (
  <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
    <button
      onClick={() => setPage((p) => Math.max(1, p - 1))}
      disabled={page === 1}
      className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
    >
      Previous
    </button>
    <span>
      Page {page} of {Math.ceil(total / limit)} ({total} total)
    </span>
    <button
      onClick={() => setPage((p) => p + 1)}
      disabled={page >= Math.ceil(total / limit)}
      className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
    >
      Next
    </button>
  </div>
)}
```

### 4. `backend/src/services/user.test.ts` (UPDATE — add filter tests)

Add a new `describe` block after the existing `describe('listUsers()')`:

```typescript
describe('listUsers() — with filters', () => {
  beforeEach(() => vi.clearAllMocks())

  it('passes search where clause to both findMany and count', async () => {
    ;(prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockUser])
    ;(prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(1)

    await listUsers(1, 20, { search: 'alice' })

    const expectedWhere = expect.objectContaining({
      OR: [
        { name: { contains: 'alice', mode: 'insensitive' } },
        { email: { contains: 'alice', mode: 'insensitive' } },
      ],
    })
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expectedWhere }))
    expect(prisma.user.count).toHaveBeenCalledWith({ where: expectedWhere })
  })

  it('passes departmentId where clause to both findMany and count', async () => {
    ;(prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockUser])
    ;(prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(1)

    await listUsers(1, 20, { departmentId: 'd1' })

    const expectedWhere = expect.objectContaining({ departmentId: 'd1' })
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expectedWhere }))
    expect(prisma.user.count).toHaveBeenCalledWith({ where: expectedWhere })
  })

  it('combines search and departmentId when both provided', async () => {
    ;(prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockUser])
    ;(prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(1)

    await listUsers(1, 20, { search: 'alice', departmentId: 'd1' })

    const expectedWhere = expect.objectContaining({
      departmentId: 'd1',
      OR: expect.any(Array),
    })
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expectedWhere }))
    expect(prisma.user.count).toHaveBeenCalledWith({ where: expectedWhere })
  })

  it('does not add OR clause when search is empty string', async () => {
    ;(prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockUser])
    ;(prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(1)

    await listUsers(1, 20, { search: '' })

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.not.objectContaining({ OR: expect.anything() }) })
    )
  })
})
```

> **Note:** The existing `listUsers()` test `'calls findMany with correct skip, take, and orderBy'` uses `expect.objectContaining`, so it will still pass after the `where` clause is added (extra keys are allowed). The `count()` test `'returns total count alongside data'` passes because the mock returns 42 regardless of call arguments.

---

## File Checklist

| File | Action | Notes |
|------|--------|-------|
| `backend/src/services/user.ts` | UPDATE | Wire `filters` → `where` in `listUsers`; rename `_filters` → `filters`; same `where` to both `findMany` and `count` |
| `backend/src/controllers/employees.ts` | UPDATE | Parse `search` and `departmentId` from `req.query`; pass as `filters` arg to `listUsers` |
| `frontend/src/features/employees/index.tsx` | UPDATE | Add `search`, `filterDeptId`, `page`, `total` state; update `loadEmployees` to build query string; split useEffects; add controls above and below table |
| `backend/src/services/user.test.ts` | UPDATE | Add `describe('listUsers() — with filters')` block with 4 new test cases |

**Do NOT touch:** `backend/src/routes/employees.ts`, `backend/src/routes/index.ts`, any other service, `leaveBalance.ts`, `holiday.ts`, `auth.ts`, middleware, schema, `App.tsx`, `types.ts`, `frontend/src/features/holidays/index.tsx`.

---

## Dev Notes

- **Architecture compliance:** AD-3 (server-side pagination on list endpoints), AD-10 (response envelope unchanged).
- **`mode: 'insensitive' as const`** — Prisma 7 `StringFilter.mode` expects the literal type `'default' | 'insensitive'`. Without `as const`, TypeScript may widen the inferred type to `string` in a spread expression, causing a compile error. This is the canonical fix.
- **React 18 batching** — `setSearch(v)` and `setPage(1)` in the same event handler are batched into a single render, which then triggers one `useEffect` invocation. There is no double-fetch.
- **Empty search → no filter** — the controller converts `""` to `undefined` via `.trim() || undefined`. The service skips the `OR` clause when `filters?.search` is falsy. This means a blank search returns all employees.
- **Existing tests stay green** — the existing `listUsers` tests use `expect.objectContaining` for `findMany` (extra `where` key is allowed) and check `count` only for its return value (not call arguments). No existing assertions break.
- **No debouncing** — ACs only require re-fetch on change; debouncing is not specified and should not be added.
- **Pagination controls hidden when ≤ 1 page** — render the Previous/Next block only when `total > limit`, keeping the UI clean for small datasets.

### Project Structure Notes

- No new files, no new routes — this is a pure extension of existing Story 3.1 code.
- `listUsers` is the only function in `user.ts` that changes.
- Only `listEmployeesController` changes in `controllers/employees.ts`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2: Employee List Search, Filter & Pagination]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-employee-leave-management-system-2026-06-29/ARCHITECTURE-SPINE.md#AD-3, AD-10]
- [Source: backend/src/services/user.ts#listUsers (current shell implementation)]
- [Source: backend/src/controllers/employees.ts#listEmployeesController (current — no filter parsing)]
- [Source: frontend/src/features/employees/index.tsx (current 3.1 implementation to extend)]
- [Source: backend/src/services/user.test.ts (existing listUsers tests to extend)]

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (Claude Code)

### Debug Log References

None — implementation matched spec exactly with no issues.

### Completion Notes List

- AC1–AC4 (backend): Wired `filters` into `listUsers` in `user.ts` — same `where` object passed to both `findMany` and `count`, ensuring `meta.total` reflects the filtered count. Renamed `_filters` → `filters` to satisfy TypeScript lint.
- AC2: Case-insensitive `OR` clause on `name` and `email` with `mode: 'insensitive' as const` (required for Prisma's `QueryMode` literal type).
- AC3: `departmentId` filter combined with `search` in a single `where` spread.
- AC4: Pagination `skip`/`take` applied after `where`, with `count({ where })` for accurate totals.
- AC5 (frontend): Added `search`, `filterDeptId`, `page`, `total` state to `EmployeesPage`. Split `useEffect` so filters/page changes re-fetch; `loadDepartments`/`loadManagers` run once on mount. Search and dept handlers call `setPage(1)` to reset on filter change (React 18 batches the two `setState` calls into one render/effect invocation). Pagination controls hidden when `total <= limit`.
- 4 new filter tests added to `user.test.ts` under `describe('listUsers() — with filters')`. All 95 backend tests pass. Both frontend and backend TypeScript check clean.

### File List

- `backend/src/services/user.ts`
- `backend/src/controllers/employees.ts`
- `frontend/src/features/employees/index.tsx`
- `backend/src/services/user.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/3-2-employee-list-search-filter-and-pagination.md`

### Change Log

- 2026-07-01: Implemented Story 3.2 — wired search/departmentId filters in `listUsers`, parsed query params in `listEmployeesController`, added search input + department dropdown + pagination controls to `EmployeesPage`, added 4 filter test cases to `user.test.ts`.
