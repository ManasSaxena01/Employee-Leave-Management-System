---
story_id: "3.3"
story_key: "3-3-leave-balance-management-and-annual-reset"
epic: 3
story: 3
title: "Leave Balance Management & Annual Reset"
status: "review"
created: "2026-07-01"
epic_title: "Employee Management & Leave Balances"
baseline_commit: "79490a2aea35c785849ea0dc35e9205e8bbfc41d"
---

# Story 3.3: Leave Balance Management & Annual Reset

## Status: review

## Story

As an admin,
I want to view and manually adjust individual employee leave balances per leave type, with automatic reset to default quotas every January 1st,
So that special accommodations can be made and all balances stay accurate year over year.

---

## Acceptance Criteria

**AC1 — Read balances:**
Given `GET /employees/:id/balances`,
When called by an admin,
Then returns all `leave_balances` rows for that employee: `{ leaveTypeId, leaveTypeName, balance, defaultQuota }`.

**AC2 — Update balance:**
Given `PATCH /employees/:id/balances/:leaveTypeId` is called with `{ balance: <integer> }`,
When processed by the server,
Then the `leave_balances` row is updated to the specified value; balance must be ≥ 0 (400 otherwise); the write goes through `services/leaveBalance` — no direct Prisma call from the controller (AD-2).

**AC3 — Annual reset job:**
Given `jobs/resetBalances.ts` is wired into `server.ts` via `node-cron`,
When January 1st 00:00 server time arrives,
Then every `leave_balances` row is set to its leave type's `default_quota`; the job logs start and completion; no HTTP endpoint exists that can trigger the reset (AD-12).

**AC4 — Frontend balance panel:**
Given the admin UI employee detail page (Employees list),
When the admin clicks a "Balances" button on an employee row,
Then a modal shows a table with each active leave type, current balance, and default quota; an inline Edit control lets the admin enter a new balance value and save it per leave type.

**AC5 — Admin-only access:**
Given a non-admin user,
When `GET` or `PATCH /employees/:id/balances` is called,
Then a 403 response is returned; balance management is admin-only.

---

## ⚠️ CRITICAL — Read Before Coding

Story 3.3 adds new functions to an existing service and two new routes on an existing router. Read every file listed below before writing a single line.

**Files to change (6 total):**

| File | Action |
|------|--------|
| `backend/src/services/leaveBalance.ts` | UPDATE — add `getBalancesForUser`, `updateBalance`, `resetAllBalances` |
| `backend/src/controllers/employees.ts` | UPDATE — add 2 new controllers for balance read/write |
| `backend/src/routes/employees.ts` | UPDATE — add 2 new balance routes (admin-only) |
| `backend/src/jobs/resetBalances.ts` | UPDATE — implement the reset body (currently a shell placeholder) |
| `frontend/src/features/employees/index.tsx` | UPDATE — add Balances button + `BalancesModal` component |
| `backend/src/services/leaveBalance.test.ts` | NEW — unit tests for the 3 new service functions |

**Do NOT touch:** `backend/src/routes/index.ts`, `backend/src/server.ts`, `backend/src/services/user.ts`, `backend/src/services/user.test.ts`, schema, middleware, `frontend/src/lib/types.ts`, `App.tsx`.

---

## STOP — Critical Guardrails

| # | Risk | Wrong | Correct |
|---|------|-------|---------|
| 1 | **Direct Prisma in controller (AD-2)** | Calling `prisma.leaveBalance.update` from the controller | Both controllers call service functions only: `getBalancesForUser()` and `updateBalance()` |
| 2 | **Negative balance** | Allowing `balance: -1` to reach Prisma | Throw `{ message: 'balance must be ≥ 0', status: 400 }` in the **service** (not just controller), so the rule is enforced at the logic layer |
| 3 | **Non-integer balance** | Accepting `{ balance: 3.5 }` | Controller validates `Number.isInteger(balance)` before calling service; return 400 if not |
| 4 | **Reset job has no implementation** | Shipping Story 3.3 with the shell job (`console.log` only, per the TODO comment in the file) | Replace the shell job body with a call to `resetAllBalances()` from the service |
| 5 | **Reset creates an HTTP endpoint (AD-12)** | Adding `POST /admin/reset-balances` or any HTTP trigger for the reset | Reset runs only via the `node-cron` job; server.ts is already wired correctly — do NOT add an HTTP route |
| 6 | **`include` needed for BalanceRow** | Querying `leaveBalance.findMany({ where: { userId } })` — no leaveType join → missing `leaveTypeName` and `defaultQuota` | Use `include: { leaveType: { select: { name: true, defaultQuota: true } } }` in all balance queries that return `BalanceRow` |
| 7 | **Compound unique key name** | Using `where: { id: ... }` or a separate `findFirst` | Prisma generates a compound unique name from `@@unique([userId, leaveTypeId])` as `userId_leaveTypeId`; use `where: { userId_leaveTypeId: { userId, leaveTypeId } }` in `findUnique` and `update` |
| 8 | **Route order in employeesRouter** | Registering `/:id/balances` after `/:id` and worrying about conflicts | Express matches by full path segment — `GET /employees/123/balances` will NOT match `/:id` (single-segment route); balance routes can go after existing routes safely |
| 9 | **Frontend: balances endpoint not paginated** | Wrapping response in `ApiListResponse` | AC1 returns all balances (≤5 leave types); use `ApiResponse<BalanceRow[]>` wrapper, not `ApiListResponse` |
| 10 | **Frontend: edit one row at a time** | Allowing multiple rows to be in edit mode simultaneously | Track a single `editingTypeId: string \| null` state; opening edit on one row closes any other |

---

## Implementation Guide

### 1. `backend/src/services/leaveBalance.ts` (UPDATE — add 3 functions)

Current file (lines 1–40) has `provisionBalancesForNewLeaveType` and `provisionBalancesForNewUser`. Append after line 40:

```typescript
export type BalanceRow = {
  leaveTypeId: string
  leaveTypeName: string
  balance: number
  defaultQuota: number
}

export async function getBalancesForUser(userId: string): Promise<BalanceRow[]> {
  const balances = await prisma.leaveBalance.findMany({
    where: { userId },
    include: { leaveType: { select: { name: true, defaultQuota: true } } },
    orderBy: { leaveType: { name: 'asc' } },
  })
  return balances.map((b) => ({
    leaveTypeId: b.leaveTypeId,
    leaveTypeName: b.leaveType.name,
    balance: b.balance,
    defaultQuota: b.leaveType.defaultQuota,
  }))
}

export async function updateBalance(
  userId: string,
  leaveTypeId: string,
  newBalance: number
): Promise<BalanceRow> {
  if (newBalance < 0) {
    throw Object.assign(new Error('balance must be ≥ 0'), { status: 400 })
  }
  const existing = await prisma.leaveBalance.findUnique({
    where: { userId_leaveTypeId: { userId, leaveTypeId } },
  })
  if (!existing) {
    throw Object.assign(new Error('Leave balance record not found'), { status: 404 })
  }
  const updated = await prisma.leaveBalance.update({
    where: { userId_leaveTypeId: { userId, leaveTypeId } },
    data: { balance: newBalance },
    include: { leaveType: { select: { name: true, defaultQuota: true } } },
  })
  return {
    leaveTypeId: updated.leaveTypeId,
    leaveTypeName: updated.leaveType.name,
    balance: updated.balance,
    defaultQuota: updated.leaveType.defaultQuota,
  }
}

export async function resetAllBalances(): Promise<void> {
  const leaveTypes = await prisma.leaveType.findMany({
    select: { id: true, defaultQuota: true },
  })
  for (const lt of leaveTypes) {
    await prisma.leaveBalance.updateMany({
      where: { leaveTypeId: lt.id },
      data: { balance: lt.defaultQuota },
    })
  }
}
```

Key design decisions:
- `BalanceRow` is exported so the controller can import it for typing
- `updateBalance` validates `balance < 0` in the service layer (AD-2 enforcement layer)
- `resetAllBalances` uses a sequential `for` loop (fire-and-forget job, no transaction needed for a once-a-year run)
- `userId_leaveTypeId` is the Prisma-generated compound unique name from `@@unique([userId, leaveTypeId])`

### 2. `backend/src/controllers/employees.ts` (UPDATE — add 2 controllers)

Add import for the new service functions at the top:

```typescript
import { getBalancesForUser, updateBalance } from '../services/leaveBalance.js'
```

Append 2 new controllers after `listAvailableManagersController`:

```typescript
export async function getEmployeeBalancesController(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string }
    const balances = await getBalancesForUser(id)
    res.status(200).json({ success: true, data: balances })
  } catch (err) {
    next(err)
  }
}

export async function updateEmployeeBalanceController(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, leaveTypeId } = req.params as { id: string; leaveTypeId: string }
    const { balance } = req.body as { balance?: unknown }

    if (balance === undefined || balance === null || typeof balance !== 'number' || !Number.isInteger(balance)) {
      res.status(400).json({ success: false, error: 'balance must be an integer' })
      return
    }

    const updated = await updateBalance(id, leaveTypeId, balance)
    res.status(200).json({ success: true, data: updated })
  } catch (err) {
    next(err)
  }
}
```

Note: The controller checks `Number.isInteger(balance)` to reject floats like `3.5`. The service additionally rejects negatives. This double-layer is intentional — controller guards the parse boundary, service enforces the business rule.

### 3. `backend/src/routes/employees.ts` (UPDATE — add 2 routes)

Add the 2 new controllers to the import statement (existing import on line 5):

```typescript
import {
  listEmployeesController,
  getEmployeeController,
  createEmployeeController,
  updateEmployeeController,
  listAvailableManagersController,
  getEmployeeBalancesController,
  updateEmployeeBalanceController,
} from '../controllers/employees.js'
```

Append the 2 new routes at the end of the file (after the existing `PATCH /:id` line):

```typescript
employeesRouter.get('/:id/balances', authenticate, requireRole(['ADMIN']), getEmployeeBalancesController)
employeesRouter.patch('/:id/balances/:leaveTypeId', authenticate, requireRole(['ADMIN']), updateEmployeeBalanceController)
```

Why no route conflict: `/:id` matches a single path segment. `GET /employees/123/balances` has two segments after `/employees/` so Express will only match `/:id/balances`, not `/:id`.

### 4. `backend/src/jobs/resetBalances.ts` (UPDATE — implement reset body)

Replace the entire file (keeping the same `createTask` API from node-cron v4):

```typescript
import { createTask } from 'node-cron'
import { resetAllBalances } from '../services/leaveBalance.js'

export const resetBalancesJob = createTask(
  '0 0 1 1 *',
  async () => {
    console.log('[resetBalances] Annual balance reset started')
    await resetAllBalances()
    console.log('[resetBalances] Annual balance reset completed')
  },
  { timezone: process.env['CRON_TIMEZONE'] ?? 'UTC' }
)
```

`server.ts` already imports and calls `resetBalancesJob.start()` — no changes to server.ts needed.

### 5. `frontend/src/features/employees/index.tsx` (UPDATE — add Balances button + modal)

Add a `BalanceRow` interface near the top of the file (alongside `AvailableManager`):

```tsx
interface BalanceRow {
  leaveTypeId: string
  leaveTypeName: string
  balance: number
  defaultQuota: number
}
```

Add one new state variable to `EmployeesPage` (alongside existing state declarations):

```tsx
const [balancesEmployee, setBalancesEmployee] = useState<User | null>(null)
```

In the employee table row's Actions cell, add a "Balances" button alongside the existing Edit/Deactivate buttons:

```tsx
<button
  onClick={() => setBalancesEmployee(employee)}
  className="text-indigo-600 hover:underline"
>
  Balances
</button>
```

After the closing `{editingEmployee && ...}` block and before the closing `</div>` of the page, add:

```tsx
{balancesEmployee && (
  <BalancesModal
    employee={balancesEmployee}
    onClose={() => setBalancesEmployee(null)}
  />
)}
```

Add the `BalancesModal` component at the bottom of the file (after `EmployeeFormModal`):

```tsx
function BalancesModal({ employee, onClose }: { employee: User; onClose: () => void }) {
  const [balances, setBalances] = useState<BalanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    apiClient
      .get<ApiResponse<BalanceRow[]>>(`/employees/${employee.id}/balances`)
      .then((res) => {
        if (!cancelled) {
          setBalances(res.data.data)
          setFetchError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) setFetchError(errorMessage(err, 'Failed to load balances'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [employee.id])

  async function handleSave(leaveTypeId: string) {
    const parsed = parseInt(editValue, 10)
    if (!Number.isInteger(parsed) || parsed < 0) {
      setSaveError('Balance must be a non-negative whole number')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const res = await apiClient.patch<ApiResponse<BalanceRow>>(
        `/employees/${employee.id}/balances/${leaveTypeId}`,
        { balance: parsed }
      )
      setBalances((prev) => prev.map((b) => (b.leaveTypeId === leaveTypeId ? res.data.data : b)))
      setEditingTypeId(null)
    } catch (err) {
      setSaveError(errorMessage(err, 'Failed to update balance'))
    } finally {
      setSaving(false)
    }
  }

  function startEdit(b: BalanceRow) {
    setEditingTypeId(b.leaveTypeId)
    setEditValue(String(b.balance))
    setSaveError(null)
  }

  function cancelEdit() {
    setEditingTypeId(null)
    setSaveError(null)
  }

  return (
    <Modal title={`Leave Balances — ${employee.name}`} onClose={onClose}>
      {loading ? (
        <p className="text-gray-600">Loading…</p>
      ) : fetchError ? (
        <p className="text-sm text-red-600" role="alert">{fetchError}</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2 pr-4">Leave Type</th>
              <th className="py-2 pr-4">Default</th>
              <th className="py-2 pr-4">Balance</th>
              <th className="py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((b) => (
              <tr key={b.leaveTypeId} className="border-b">
                <td className="py-2 pr-4">{b.leaveTypeName}</td>
                <td className="py-2 pr-4">{b.defaultQuota}</td>
                <td className="py-2 pr-4">
                  {editingTypeId === b.leaveTypeId ? (
                    <input
                      type="number"
                      min={0}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  ) : (
                    b.balance
                  )}
                </td>
                <td className="py-2">
                  {editingTypeId === b.leaveTypeId ? (
                    <span className="space-x-2">
                      <button
                        onClick={() => handleSave(b.leaveTypeId)}
                        disabled={saving}
                        className="text-indigo-600 hover:underline disabled:opacity-50"
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="text-gray-600 hover:underline"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => startEdit(b)}
                      className="text-indigo-600 hover:underline"
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {balances.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-gray-500">
                  No balances found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
      {saveError && (
        <p className="mt-2 text-sm text-red-600" role="alert">{saveError}</p>
      )}
    </Modal>
  )
}
```

### 6. `backend/src/services/leaveBalance.test.ts` (NEW)

Create this file from scratch following the vitest + prisma mock pattern from `user.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../prisma/client.js', () => {
  const prismaMock = {
    leaveBalance: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      createMany: vi.fn(),
    },
    leaveType: {
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  }
  return { prisma: prismaMock }
})

vi.mock('dotenv/config', () => ({}))

import { prisma } from '../prisma/client.js'
import { getBalancesForUser, updateBalance, resetAllBalances } from './leaveBalance.js'

const mockBalanceWithType = {
  id: 'lb1',
  userId: 'u1',
  leaveTypeId: 'lt1',
  balance: 10,
  leaveType: { name: 'Annual Leave', defaultQuota: 20 },
}

describe('getBalancesForUser()', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns mapped BalanceRow array for user', async () => {
    ;(prisma.leaveBalance.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockBalanceWithType])

    const result = await getBalancesForUser('u1')

    expect(prisma.leaveBalance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' } })
    )
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      leaveTypeId: 'lt1',
      leaveTypeName: 'Annual Leave',
      balance: 10,
      defaultQuota: 20,
    })
  })

  it('returns empty array when user has no balances', async () => {
    ;(prisma.leaveBalance.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])

    const result = await getBalancesForUser('u1')

    expect(result).toHaveLength(0)
  })
})

describe('updateBalance()', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates balance and returns BalanceRow', async () => {
    ;(prisma.leaveBalance.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockBalanceWithType)
    ;(prisma.leaveBalance.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockBalanceWithType,
      balance: 15,
    })

    const result = await updateBalance('u1', 'lt1', 15)

    expect(prisma.leaveBalance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_leaveTypeId: { userId: 'u1', leaveTypeId: 'lt1' } },
        data: { balance: 15 },
      })
    )
    expect(result.balance).toBe(15)
    expect(result.leaveTypeName).toBe('Annual Leave')
    expect(result.defaultQuota).toBe(20)
  })

  it('throws 400 when balance is negative', async () => {
    await expect(updateBalance('u1', 'lt1', -1)).rejects.toMatchObject({
      message: 'balance must be ≥ 0',
      status: 400,
    })
    expect(prisma.leaveBalance.findUnique).not.toHaveBeenCalled()
    expect(prisma.leaveBalance.update).not.toHaveBeenCalled()
  })

  it('allows balance of 0', async () => {
    ;(prisma.leaveBalance.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockBalanceWithType)
    ;(prisma.leaveBalance.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockBalanceWithType,
      balance: 0,
    })

    const result = await updateBalance('u1', 'lt1', 0)

    expect(result.balance).toBe(0)
  })

  it('throws 404 when balance record not found', async () => {
    ;(prisma.leaveBalance.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    await expect(updateBalance('u1', 'lt1', 5)).rejects.toMatchObject({
      message: 'Leave balance record not found',
      status: 404,
    })
    expect(prisma.leaveBalance.update).not.toHaveBeenCalled()
  })
})

describe('resetAllBalances()', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls updateMany for each leave type with its defaultQuota', async () => {
    ;(prisma.leaveType.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'lt1', defaultQuota: 10 },
      { id: 'lt2', defaultQuota: 20 },
    ])
    ;(prisma.leaveBalance.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 })

    await resetAllBalances()

    expect(prisma.leaveType.findMany).toHaveBeenCalledOnce()
    expect(prisma.leaveBalance.updateMany).toHaveBeenCalledTimes(2)
    expect(prisma.leaveBalance.updateMany).toHaveBeenCalledWith({
      where: { leaveTypeId: 'lt1' },
      data: { balance: 10 },
    })
    expect(prisma.leaveBalance.updateMany).toHaveBeenCalledWith({
      where: { leaveTypeId: 'lt2' },
      data: { balance: 20 },
    })
  })

  it('does nothing when there are no leave types', async () => {
    ;(prisma.leaveType.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])

    await resetAllBalances()

    expect(prisma.leaveBalance.updateMany).not.toHaveBeenCalled()
  })
})
```

---

## File Checklist

| File | Action | Notes |
|------|--------|-------|
| `backend/src/services/leaveBalance.ts` | UPDATE | Add `BalanceRow` type, `getBalancesForUser`, `updateBalance`, `resetAllBalances` |
| `backend/src/controllers/employees.ts` | UPDATE | Add `getEmployeeBalancesController`, `updateEmployeeBalanceController`; import new service functions |
| `backend/src/routes/employees.ts` | UPDATE | Add 2 new admin-only routes at the end of the file |
| `backend/src/jobs/resetBalances.ts` | UPDATE | Replace shell body with `resetAllBalances()` call + logging |
| `frontend/src/features/employees/index.tsx` | UPDATE | Add `BalanceRow` interface, `balancesEmployee` state, Balances button, `BalancesModal` component |
| `backend/src/services/leaveBalance.test.ts` | NEW | 7 test cases across 3 describe blocks |

**Do NOT touch:** `backend/src/routes/index.ts`, `backend/src/server.ts` (already wired), `backend/src/services/user.ts`, `backend/src/services/user.test.ts`, schema, any other service, middleware, `frontend/src/lib/types.ts`, `App.tsx`.

---

## Dev Notes

### Architecture Compliance
- **AD-2:** All balance reads and writes go through `services/leaveBalance`. The controller calls `getBalancesForUser()` and `updateBalance()` — never `prisma.leaveBalance` directly.
- **AD-12:** No HTTP endpoint for reset. `resetAllBalances()` is exported from the service for the job only; no controller calls it. `server.ts` already wires the job — don't add another `resetBalancesJob.start()` call.
- **AD-1:** Both routes use `requireRole(['ADMIN'])`. Balance management is admin-only per AC5.
- **AD-10:** All responses follow `{ success, data?, error? }` envelope.
- **AD-3:** Balance endpoint is NOT paginated — there are only ~5 leave types per employee. Use `ApiResponse<BalanceRow[]>`, not `ApiListResponse`.

### node-cron v4 API
- `createTask(expression, fn, options)` — does not auto-start; call `.start()` separately in `server.ts`
- `server.ts` already calls `resetBalancesJob.start()` — nothing to change there
- `{ timezone: 'UTC' }` option: the cron runs at midnight UTC by default; override with `CRON_TIMEZONE` env var

### Prisma compound unique selector
The `LeaveBalance` model has `@@unique([userId, leaveTypeId])`. Prisma generates the compound key name `userId_leaveTypeId`. Use:
```typescript
prisma.leaveBalance.findUnique({ where: { userId_leaveTypeId: { userId, leaveTypeId } } })
prisma.leaveBalance.update({ where: { userId_leaveTypeId: { userId, leaveTypeId } }, data: { balance: n } })
```

### Frontend: `ApiResponse` import
The frontend `BalancesModal` uses `ApiResponse<BalanceRow[]>` for the GET and `ApiResponse<BalanceRow>` for the PATCH. Both are already imported from `../../lib/types.js` in the existing file — no new import needed.

### Frontend: `balancesEmployee` cleanup
The `BalancesModal` effect runs on `employee.id`. When `setBalancesEmployee(null)` is called, the modal unmounts and the effect's cleanup (`cancelled = true`) prevents stale updates.

### Test mock for `leaveBalance.test.ts`
The mock covers only the Prisma methods this file uses: `leaveBalance.findMany`, `findUnique`, `update`, `updateMany`, `createMany` (for existing provisioning functions) and `leaveType.findMany`, `user.findMany`. The `$transaction` is NOT in the mock because `resetAllBalances` uses sequential awaits, not a transaction.

### Project Structure Notes
- No new files except `leaveBalance.test.ts`
- No new routes at the router-index level (`routes/index.ts` is untouched)
- `leaveBalance.ts` grows to ~90 lines (from ~40) — all cohesive balance logic in one service
- The `BalancesModal` lives in `employees/index.tsx` (not a separate file) because it's used only there and mirrors the pattern of `EmployeeFormModal` in the same file

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.3: Leave Balance Management & Annual Reset]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-employee-leave-management-system-2026-06-29/ARCHITECTURE-SPINE.md#AD-2, AD-12, AD-1, AD-10]
- [Source: backend/src/services/leaveBalance.ts (current state — provisionBalancesForNewUser, provisionBalancesForNewUser)]
- [Source: backend/src/jobs/resetBalances.ts (shell stub — "Full implementation in Story 3.3")]
- [Source: backend/src/routes/employees.ts (current 5 routes to extend)]
- [Source: backend/src/controllers/employees.ts (existing controller pattern to follow)]
- [Source: frontend/src/features/employees/index.tsx (current EmployeesPage + EmployeeFormModal pattern)]
- [Source: backend/src/services/user.test.ts (vitest + prisma mock pattern to replicate)]

---

## Tasks / Subtasks

- [x] Task 1: Add service functions to `leaveBalance.ts` (AC1, AC2, AC3)
  - [x] 1.1 Export `BalanceRow` type
  - [x] 1.2 Implement `getBalancesForUser(userId)` with leaveType join
  - [x] 1.3 Implement `updateBalance(userId, leaveTypeId, newBalance)` with 400/404 guards
  - [x] 1.4 Implement `resetAllBalances()` with sequential `updateMany` per leave type

- [x] Task 2: Add controllers to `employees.ts` controller (AC1, AC2, AC5)
  - [x] 2.1 Import `getBalancesForUser` and `updateBalance` from leaveBalance service
  - [x] 2.2 Implement `getEmployeeBalancesController`
  - [x] 2.3 Implement `updateEmployeeBalanceController` with integer validation

- [x] Task 3: Add routes to `employees.ts` router (AC1, AC2, AC5)
  - [x] 3.1 Import 2 new controllers
  - [x] 3.2 Add `GET /:id/balances` (admin-only)
  - [x] 3.3 Add `PATCH /:id/balances/:leaveTypeId` (admin-only)

- [x] Task 4: Implement reset job body in `resetBalances.ts` (AC3)
  - [x] 4.1 Import `resetAllBalances` from leaveBalance service
  - [x] 4.2 Replace shell body with logging + `resetAllBalances()` call

- [x] Task 5: Add balance UI to frontend `employees/index.tsx` (AC4)
  - [x] 5.1 Add `BalanceRow` interface
  - [x] 5.2 Add `balancesEmployee` state to `EmployeesPage`
  - [x] 5.3 Add "Balances" button to each employee row Actions cell
  - [x] 5.4 Render `BalancesModal` conditionally when `balancesEmployee` is set
  - [x] 5.5 Implement `BalancesModal` component with fetch, table, inline edit, save

- [x] Task 6: Write tests for new service functions (AC1, AC2, AC3)
  - [x] 6.1 Create `backend/src/services/leaveBalance.test.ts` with prisma mock setup
  - [x] 6.2 `getBalancesForUser`: 2 test cases (happy path, empty array)
  - [x] 6.3 `updateBalance`: 4 test cases (success, balance=0 allowed, negative→400, not found→404)
  - [x] 6.4 `resetAllBalances`: 2 test cases (multiple types, no types)

- [x] Task 7: Run full test suite and validate all ACs
  - [x] 7.1 Run `npm test` in backend — all tests pass including new 8 test cases
  - [x] 7.2 TypeScript check passes (`tsc --noEmit`)
  - [x] 7.3 Verify AC5 (non-admin 403) is enforced via `requireRole(['ADMIN'])` in route

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

No blocking issues. All tests passed on first run.

### Completion Notes List

- Expanded `leaveBalance.ts` with `BalanceRow` type and 3 functions: `getBalancesForUser`, `updateBalance`, `resetAllBalances`. Compound unique key `userId_leaveTypeId` used throughout.
- Added 2 controllers to `employees.ts`: `getEmployeeBalancesController` and `updateEmployeeBalanceController` (integer validation at controller boundary, negative guard in service).
- Added 2 admin-only routes to `employees.ts` router: `GET /:id/balances` and `PATCH /:id/balances/:leaveTypeId`.
- Replaced shell stub in `resetBalances.ts` with full implementation calling `resetAllBalances()` with start/complete logging.
- Added `BalanceRow` interface, `balancesEmployee` state, "Balances" button, and `BalancesModal` component to `frontend/src/features/employees/index.tsx`. Modal loads per-employee balances, displays table with default quota, and supports single-row inline edit.
- Expanded `leaveBalance.test.ts`: retained 3 existing tests for `provisionBalancesForNewLeaveType`, added 8 new tests across `getBalancesForUser` (2), `updateBalance` (4), `resetAllBalances` (2). All 106 backend tests pass.
- Both backend and frontend TypeScript checks (`tsc --noEmit`) pass with zero errors.

### File List

- `backend/src/services/leaveBalance.ts` — updated (added `BalanceRow`, `getBalancesForUser`, `updateBalance`, `resetAllBalances`)
- `backend/src/controllers/employees.ts` — updated (added `getEmployeeBalancesController`, `updateEmployeeBalanceController`)
- `backend/src/routes/employees.ts` — updated (added 2 admin-only balance routes)
- `backend/src/jobs/resetBalances.ts` — updated (implemented reset body)
- `frontend/src/features/employees/index.tsx` — updated (added `BalanceRow`, `balancesEmployee` state, Balances button, `BalancesModal`)
- `backend/src/services/leaveBalance.test.ts` — updated (added 8 test cases for new functions)

### Change Log

- 2026-07-01: Implemented Story 3.3 — Leave Balance Management & Annual Reset. Added balance read/write service functions, admin-only REST endpoints, annual reset cron job implementation, frontend Balances modal, and full unit test coverage. (claude-sonnet-4-6)
