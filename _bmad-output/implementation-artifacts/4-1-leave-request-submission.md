---
story_id: "4.1"
story_key: "4-1-leave-request-submission"
epic: 4
story: 1
title: "Leave Request Submission"
status: "review"
created: "2026-07-01"
epic_title: "Leave Request Lifecycle"
baseline_commit: "79490a2aea35c785849ea0dc35e9205e8bbfc41d"
---

# Story 4.1: Leave Request Submission

## Status: review

## Story

As an employee,
I want to submit a leave request specifying type, dates, reason, and an optional or required document,
So that my manager is notified and my request enters the approval workflow.

---

## Acceptance Criteria

**AC1 — Successful submission:**
Given an authenticated employee,
When `POST /leave-requests` is called with `{ leaveTypeId, startDate, endDate, reason, document? }`,
Then a 201 response returns the new request including `duration_days` calculated server-side by `utils/workingDays.ts` (AD-9); status is PENDING.

**AC2 — Document required enforcement:**
Given the selected leave type has `document_required: true`,
When `POST /leave-requests` is called without a file,
Then a 400 response returns `{ success: false, error: "Document is required for this leave type" }`.

**AC3 — File upload validation:**
Given a file is attached,
When `upload.ts` middleware processes it,
Then only PDF, JPG, PNG files ≤ 5 MB are accepted (NFR-SEC-2); the file is saved via multer to `uploads/` and the filename stored in `leave_requests.document_path`; rejected file type or size returns 400.

**AC4 — Balance warning:**
Given the employee's remaining balance is less than `duration_days`,
When `POST /leave-requests` is processed,
Then the request is created (not blocked); the response includes `{ balanceWarning: true }`; the frontend displays a visible warning to the employee.

**AC5 — Overlap warning:**
Given one or more team members (employees with the same `managerId`) have an approved leave overlapping the requested dates,
When `POST /leave-requests` is processed,
Then the request is created (not blocked); the response includes `{ overlapWarning: true, overlappingLeaves: [...] }`; the frontend shows a warning banner.

**AC6 — Frontend document-required enforcement:**
Given the leave request submission form,
When an employee selects a leave type with `document_required: true`,
Then the file upload field is mandatory; the form cannot be submitted without it.

**AC7 — Submit transaction (AD-4):**
Given the submit transaction,
When `POST /leave-requests` executes,
Then the overlap availability SELECT and the INSERT into `leave_requests` run inside a single Prisma transaction; balance is NOT deducted at submission time.

**AC8 — Audit log on submission (FR-AUDIT-1):**
Given a leave request is successfully created,
When the transaction commits,
Then `services/audit.append({ action: 'SUBMITTED', actorId: employee.id, leaveRequestId, comment: undefined })` is called and an `audit_logs` entry exists for this submission.

---

## ⚠️ CRITICAL — Read Before Coding

Story 4.1 implements the leave submission endpoint from scratch. The `leaveRequest.ts` service is currently just `export const leaveRequestService = {}` — a complete rewrite is required. Read every file below before writing a single line.

**Files to change (6 total):**

| File | Action |
|------|--------|
| `backend/src/services/leaveRequest.ts` | UPDATE — replace stub entirely with `submit()` implementation |
| `backend/src/controllers/leaveRequests.ts` | NEW — `submitLeaveRequestController` |
| `backend/src/routes/leaveRequests.ts` | NEW — `POST /` with `upload.single('document')` middleware |
| `backend/src/routes/index.ts` | UPDATE — register `leaveRequestsRouter` at `/leave-requests` |
| `backend/src/services/leaveRequest.test.ts` | NEW — unit tests for `submit()` |
| `frontend/src/features/leaves/index.tsx` | UPDATE — replace `<div>Leaves</div>` stub with full form |

**Do NOT touch:** `App.tsx` (`/leaves` route already wired to `LeavesPage`), `frontend/src/lib/types.ts` (`LeaveRequest` interface already exists), schema, `middleware/auth.ts`, `middleware/rbac.ts`, `middleware/upload.ts`, `utils/workingDays.ts`, `utils/storage.ts`, `services/audit.ts`, `services/notification.ts`.

---

## STOP — Critical Guardrails

| # | Risk | Wrong | Correct |
|---|------|-------|---------|
| 1 | **Balance deducted at submission** | Deducting balance in `submit()` | Balance is NEVER deducted at submission — only on `approve()` in Story 4.3 |
| 2 | **Overlap check outside transaction (AD-4)** | Running overlap SELECT as a controller pre-check before calling the service | Overlap SELECT runs inside `prisma.$transaction()` alongside the INSERT |
| 3 | **Audit append inside transaction** | Calling `audit.append()` inside the Prisma transaction | Call `audit.append()` AFTER `await prisma.$transaction(...)` resolves |
| 4 | **Wrong date parsing** | `new Date('2026-03-15')` — JS parses bare dates as UTC midnight but behavior is fragile | Always parse: `new Date('2026-03-15' + 'T00:00:00.000Z')` — same pattern as `services/holiday.ts` |
| 5 | **Calling `storage.save()` for uploaded file** | Calling `getStorageProvider().save()` in the controller | Multer's `diskStorage` in `upload.ts` already writes to `uploads/`. Use `req.file.filename` directly as `document_path`. |
| 6 | **Multer error not handled** | Unhandled multer errors (file size/type) reaching the global error handler with wrong status | Wrap `upload.single('document')` in a custom middleware that catches multer errors and returns 400 |
| 7 | **Forgetting to register the route** | Creating `routes/leaveRequests.ts` but not adding it to `routes/index.ts` | Add `router.use('/leave-requests', leaveRequestsRouter)` to `routes/index.ts` |
| 8 | **Notification recipient** | Calling `notification.trigger('SUBMITTED', employeeId)` | Per AD-14: SUBMITTED → employee's **manager**: `notification.trigger('SUBMITTED', managerId)`. Leave as no-op stub call — full implementation in Story 4.4. |
| 9 | **Frontend file upload headers** | Setting `Content-Type: multipart/form-data` manually | Pass FormData to Axios directly — Axios auto-sets the correct multipart boundary header |
| 10 | **LeaveRequest type on frontend** | Creating a new response interface | `LeaveRequest` already exists in `frontend/src/lib/types.ts`; extend response type inline if needed for warnings |
| 11 | **Working-day calculation** | Fetching holidays inside the transaction | Fetch all holidays BEFORE entering the transaction, pass the Date[] array to `calculateWorkingDays()` |
| 12 | **No date range validation** | Accepting `startDate > endDate` | Validate `startDate <= endDate` in controller; return 400 if violated |

---

## Implementation Guide

### 1. `backend/src/services/leaveRequest.ts` (UPDATE — replace entire stub)

The file currently contains `export const leaveRequestService = {}`. Replace entirely:

```typescript
import { prisma } from '../prisma/client.js'
import { calculateWorkingDays } from '../utils/workingDays.js'
import { audit } from './audit.js'
import { notification } from './notification.js'

function parseDateUTC(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00.000Z')
}

export interface OverlappingLeave {
  id: string
  employeeName: string
  leaveTypeName: string
  startDate: string
  endDate: string
}

export interface LeaveRequestRow {
  id: string
  userId: string
  leaveTypeId: string
  startDate: string
  endDate: string
  durationDays: number
  status: string
  reason: string
  documentPath: string | null
  comment: string | null
  createdAt: Date
  updatedAt: Date
}

export interface SubmitResult {
  request: LeaveRequestRow
  balanceWarning: boolean
  overlapWarning: boolean
  overlappingLeaves: OverlappingLeave[]
}

export async function submit(input: {
  userId: string
  leaveTypeId: string
  startDate: string
  endDate: string
  reason: string
  documentPath?: string
}): Promise<SubmitResult> {
  const { userId, leaveTypeId, startDate, endDate, reason, documentPath } = input

  // Parse dates as UTC (same pattern as holiday.ts)
  const start = parseDateUTC(startDate)
  const end = parseDateUTC(endDate)

  // Fetch leave type to validate it exists and check documentRequired
  const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } })
  if (!leaveType) {
    throw Object.assign(new Error('Leave type not found'), { status: 404 })
  }
  if (!leaveType.active) {
    throw Object.assign(new Error('Leave type is not active'), { status: 400 })
  }
  if (leaveType.documentRequired && !documentPath) {
    throw Object.assign(new Error('Document is required for this leave type'), { status: 400 })
  }

  // Fetch submitter to get managerId for overlap check
  const submitter = await prisma.user.findUnique({
    where: { id: userId },
    select: { managerId: true },
  })
  if (!submitter) {
    throw Object.assign(new Error('User not found'), { status: 404 })
  }

  // Fetch holidays for working-day calculation (outside tx — read-only, no race concern)
  const holidays = await prisma.companyHoliday.findMany({ select: { date: true } })
  const holidayDates = holidays.map((h) => h.date)

  const durationDays = calculateWorkingDays(start, end, holidayDates)
  if (durationDays <= 0) {
    throw Object.assign(new Error('Leave request must span at least one working day'), { status: 400 })
  }

  // Check balance (outside tx — warning only, not a blocking constraint)
  const balanceRow = await prisma.leaveBalance.findUnique({
    where: { userId_leaveTypeId: { userId, leaveTypeId } },
    select: { balance: true },
  })
  const balanceWarning = balanceRow ? balanceRow.balance < durationDays : false

  // Transaction: overlap SELECT + INSERT (AD-4 TOCTOU prevention)
  const { request, overlappingLeaves } = await prisma.$transaction(async (tx) => {
    // Overlap check — only when submitter has a manager (team context)
    let overlapping: OverlappingLeave[] = []
    if (submitter.managerId) {
      const teamLeaves = await tx.leaveRequest.findMany({
        where: {
          status: 'APPROVED',
          userId: { not: userId },
          user: { managerId: submitter.managerId },
          startDate: { lte: end },
          endDate: { gte: start },
        },
        include: {
          user: { select: { name: true } },
          leaveType: { select: { name: true } },
        },
      })
      overlapping = teamLeaves.map((lr) => ({
        id: lr.id,
        employeeName: lr.user.name,
        leaveTypeName: lr.leaveType.name,
        startDate: lr.startDate.toISOString().slice(0, 10),
        endDate: lr.endDate.toISOString().slice(0, 10),
      }))
    }

    const created = await tx.leaveRequest.create({
      data: {
        userId,
        leaveTypeId,
        startDate: start,
        endDate: end,
        durationDays,
        reason,
        documentPath: documentPath ?? null,
        status: 'PENDING',
      },
    })

    const row: LeaveRequestRow = {
      id: created.id,
      userId: created.userId,
      leaveTypeId: created.leaveTypeId,
      startDate: created.startDate.toISOString().slice(0, 10),
      endDate: created.endDate.toISOString().slice(0, 10),
      durationDays: created.durationDays,
      status: created.status,
      reason: created.reason,
      documentPath: created.documentPath,
      comment: created.comment,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    }

    return { request: row, overlappingLeaves: overlapping }
  })

  // Audit append AFTER transaction commits (AD-8: append-only, no tx wrapping required)
  await audit.append({
    leaveRequestId: request.id,
    actorId: userId,
    action: 'SUBMITTED' as const,
    comment: undefined,
  })

  // Notification stub — no-op until Story 4.4 wires it (AD-14: SUBMITTED → manager)
  if (submitter.managerId) {
    await notification.trigger('SUBMITTED', submitter.managerId)
  }

  return {
    request,
    balanceWarning,
    overlapWarning: overlappingLeaves.length > 0,
    overlappingLeaves,
  }
}
```

> **Note on `audit.append()`**: Currently `services/audit.ts` has `append: async (): Promise<void> => {}` — a no-op stub. Call it with the correct shape anyway so when Story 4.3 implements the real audit log, the call site is already correct. The shape `{ leaveRequestId, actorId, action, comment }` matches the `audit_logs` schema.

### 2. `backend/src/controllers/leaveRequests.ts` (NEW)

```typescript
import type { Request, Response, NextFunction } from 'express'
import { submit } from '../services/leaveRequest.js'

export async function submitLeaveRequestController(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId
    const { leaveTypeId, startDate, endDate, reason } = req.body as Record<string, unknown>

    if (!leaveTypeId || typeof leaveTypeId !== 'string') {
      res.status(400).json({ success: false, error: 'leaveTypeId is required' })
      return
    }
    if (!startDate || typeof startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      res.status(400).json({ success: false, error: 'startDate must be YYYY-MM-DD' })
      return
    }
    if (!endDate || typeof endDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      res.status(400).json({ success: false, error: 'endDate must be YYYY-MM-DD' })
      return
    }
    if (startDate > endDate) {
      res.status(400).json({ success: false, error: 'startDate must not be after endDate' })
      return
    }
    if (!reason || typeof reason !== 'string' || reason.trim() === '') {
      res.status(400).json({ success: false, error: 'reason is required' })
      return
    }

    const documentPath = req.file?.filename  // multer already saved to uploads/

    const result = await submit({
      userId,
      leaveTypeId,
      startDate,
      endDate,
      reason: (reason as string).trim(),
      documentPath,
    })

    res.status(201).json({
      success: true,
      data: {
        ...result.request,
        balanceWarning: result.balanceWarning,
        overlapWarning: result.overlapWarning,
        overlappingLeaves: result.overlappingLeaves,
      },
    })
  } catch (err) {
    next(err)
  }
}
```

### 3. `backend/src/routes/leaveRequests.ts` (NEW)

Multer errors (file too large, wrong type) need to be caught here and returned as 400, not passed to the global error handler as 500.

```typescript
import { Router, type Request, type Response, type NextFunction } from 'express'
import multer from 'multer'
import { authenticate } from '../middleware/auth.js'
import { upload } from '../middleware/upload.js'
import { submitLeaveRequestController } from '../controllers/leaveRequests.js'

export const leaveRequestsRouter = Router()

function handleUpload(req: Request, res: Response, next: NextFunction) {
  upload.single('document')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      res.status(400).json({ success: false, error: err.message })
      return
    }
    if (err instanceof Error) {
      // fileFilter rejection (wrong type)
      res.status(400).json({ success: false, error: err.message })
      return
    }
    next()
  })
}

leaveRequestsRouter.post('/', authenticate, handleUpload, submitLeaveRequestController)
```

### 4. `backend/src/routes/index.ts` (UPDATE — add one import + one mount)

Add after the last `import` and last `router.use(...)`:

```typescript
import { leaveRequestsRouter } from './leaveRequests.js'
// ...
router.use('/leave-requests', leaveRequestsRouter)
```

The existing `router.get('/files/:filename', ...)` line stays unchanged.

### 5. `backend/src/services/leaveRequest.test.ts` (NEW)

The service uses `prisma.$transaction`. Mock it to receive the async callback and execute it synchronously for testing. Also mock all Prisma models the service touches.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../prisma/client.js', () => ({
  prisma: {
    $transaction: vi.fn(),
    leaveType: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    companyHoliday: { findMany: vi.fn() },
    leaveBalance: { findUnique: vi.fn() },
    leaveRequest: { findMany: vi.fn(), create: vi.fn() },
  },
}))

vi.mock('../utils/workingDays.js', () => ({
  calculateWorkingDays: vi.fn().mockReturnValue(3),
}))

vi.mock('./audit.js', () => ({
  audit: { append: vi.fn().mockResolvedValue(undefined) },
}))

vi.mock('./notification.js', () => ({
  notification: { trigger: vi.fn().mockResolvedValue(undefined) },
}))

vi.mock('dotenv/config', () => ({}))

import { prisma } from '../prisma/client.js'
import { audit } from './audit.js'
import { notification } from './notification.js'
import { submit } from './leaveRequest.js'

const MOCK_LEAVE_TYPE = {
  id: 'lt1',
  name: 'Annual',
  active: true,
  documentRequired: false,
  defaultQuota: 20,
}

const MOCK_CREATED_REQUEST = {
  id: 'lr1',
  userId: 'u1',
  leaveTypeId: 'lt1',
  startDate: new Date('2026-08-03T00:00:00.000Z'),
  endDate: new Date('2026-08-05T00:00:00.000Z'),
  durationDays: 3,
  status: 'PENDING',
  reason: 'Holiday',
  documentPath: null,
  comment: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

function setupHappyPath() {
  ;(prisma.leaveType.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_LEAVE_TYPE)
  ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ managerId: 'mgr1' })
  ;(prisma.companyHoliday.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
  ;(prisma.leaveBalance.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ balance: 10 })
  ;(prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
    async (fn: (tx: typeof prisma) => Promise<unknown>) =>
      fn({
        leaveRequest: {
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockResolvedValue(MOCK_CREATED_REQUEST),
        },
      } as unknown as typeof prisma)
  )
}

describe('submit()', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a leave request and returns SubmitResult', async () => {
    setupHappyPath()

    const result = await submit({
      userId: 'u1',
      leaveTypeId: 'lt1',
      startDate: '2026-08-03',
      endDate: '2026-08-05',
      reason: 'Holiday',
    })

    expect(result.request.id).toBe('lr1')
    expect(result.balanceWarning).toBe(false)
    expect(result.overlapWarning).toBe(false)
    expect(result.overlappingLeaves).toHaveLength(0)
  })

  it('sets balanceWarning=true when balance < durationDays', async () => {
    setupHappyPath()
    ;(prisma.leaveBalance.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ balance: 1 }) // 1 < 3

    const result = await submit({
      userId: 'u1',
      leaveTypeId: 'lt1',
      startDate: '2026-08-03',
      endDate: '2026-08-05',
      reason: 'Holiday',
    })

    expect(result.balanceWarning).toBe(true)
  })

  it('sets overlapWarning=true when team member has approved overlap', async () => {
    setupHappyPath()
    const overlappingLeave = {
      id: 'lr-other',
      startDate: new Date('2026-08-04T00:00:00.000Z'),
      endDate: new Date('2026-08-06T00:00:00.000Z'),
      user: { name: 'Alice' },
      leaveType: { name: 'Annual' },
    }
    ;(prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: typeof prisma) => Promise<unknown>) =>
        fn({
          leaveRequest: {
            findMany: vi.fn().mockResolvedValue([overlappingLeave]),
            create: vi.fn().mockResolvedValue(MOCK_CREATED_REQUEST),
          },
        } as unknown as typeof prisma)
    )

    const result = await submit({
      userId: 'u1',
      leaveTypeId: 'lt1',
      startDate: '2026-08-03',
      endDate: '2026-08-05',
      reason: 'Holiday',
    })

    expect(result.overlapWarning).toBe(true)
    expect(result.overlappingLeaves).toHaveLength(1)
    expect(result.overlappingLeaves[0].employeeName).toBe('Alice')
  })

  it('throws 400 when document_required and no documentPath', async () => {
    ;(prisma.leaveType.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...MOCK_LEAVE_TYPE,
      documentRequired: true,
    })

    await expect(
      submit({ userId: 'u1', leaveTypeId: 'lt1', startDate: '2026-08-03', endDate: '2026-08-05', reason: 'Sick' })
    ).rejects.toMatchObject({ message: 'Document is required for this leave type', status: 400 })

    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('throws 404 when leave type not found', async () => {
    ;(prisma.leaveType.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    await expect(
      submit({ userId: 'u1', leaveTypeId: 'lt-bad', startDate: '2026-08-03', endDate: '2026-08-05', reason: 'Sick' })
    ).rejects.toMatchObject({ status: 404 })
  })

  it('throws 400 when leave type is inactive', async () => {
    ;(prisma.leaveType.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ ...MOCK_LEAVE_TYPE, active: false })

    await expect(
      submit({ userId: 'u1', leaveTypeId: 'lt1', startDate: '2026-08-03', endDate: '2026-08-05', reason: 'Sick' })
    ).rejects.toMatchObject({ status: 400 })
  })

  it('calls audit.append after transaction commits', async () => {
    setupHappyPath()

    await submit({ userId: 'u1', leaveTypeId: 'lt1', startDate: '2026-08-03', endDate: '2026-08-05', reason: 'Holiday' })

    expect(audit.append).toHaveBeenCalledOnce()
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SUBMITTED', actorId: 'u1', leaveRequestId: 'lr1' })
    )
  })

  it('calls notification.trigger with managerId after transaction', async () => {
    setupHappyPath()

    await submit({ userId: 'u1', leaveTypeId: 'lt1', startDate: '2026-08-03', endDate: '2026-08-05', reason: 'Holiday' })

    expect(notification.trigger).toHaveBeenCalledWith('SUBMITTED', 'mgr1')
  })
})
```

### 6. `frontend/src/features/leaves/index.tsx` (UPDATE — replace stub with full page)

The current file is 3 lines: `export function LeavesPage() { return <div>Leaves</div> }`. Replace entirely.

The `LeavesPage` shows a "Submit Leave" button that opens a `SubmitLeaveModal`. After successful submission, show success state with any returned warnings.

**Key frontend patterns to follow** (from `holidays/index.tsx` and `employees/index.tsx`):
- `apiClient` from `../../lib/apiClient.js`
- `errorMessage`, `Modal` from `../../lib/uiHelpers.js`
- Types from `../../lib/types.js` — `LeaveType`, `LeaveRequest`, `ApiListResponse`, `ApiResponse`
- `useAuth()` from `../../context/AuthContext.js` — use `user.id` if needed
- State pattern: `const [loading, setLoading] = useState(true)` + `useEffect` on mount

**File upload with Axios + FormData:**
```tsx
const formData = new FormData()
formData.append('leaveTypeId', leaveTypeId)
formData.append('startDate', startDate)
formData.append('endDate', endDate)
formData.append('reason', reason)
if (file) formData.append('document', file)  // must use field name 'document' — matches upload.single('document')

// Axios auto-sets Content-Type + boundary for FormData — do NOT set Content-Type manually
const res = await apiClient.post<ApiResponse<SubmitResponse>>('/leave-requests', formData)
```

**`SubmitResponse` type** (inline, don't add to types.ts):
```tsx
interface SubmitResponse extends LeaveRequest {
  balanceWarning: boolean
  overlapWarning: boolean
  overlappingLeaves: Array<{
    id: string
    employeeName: string
    leaveTypeName: string
    startDate: string
    endDate: string
  }>
}
```

**`LeavesPage` should render:**
1. A title "My Leave Requests"
2. A "Submit Leave Request" button (top right, indigo style)
3. A `SubmitLeaveModal` when the button is clicked
4. After successful submit: show a success banner with any balance or overlap warnings before it clears

**`SubmitLeaveModal` form fields:**
- Leave Type: `<select>` populated from `GET /leave-types` — only `active: true` types
- Start Date: `<input type="date">`
- End Date: `<input type="date">`
- Reason: `<textarea>`
- Document: `<input type="file" accept=".pdf,.jpg,.jpeg,.png">` — required when `documentRequired: true` for selected leave type
- Submit button disabled while submitting

**Document field behavior:**
```tsx
const selectedType = leaveTypes.find(lt => lt.id === leaveTypeId)
const isDocRequired = selectedType?.documentRequired ?? false
// File input: required={isDocRequired}
// HTML required attr won't trigger on file in all browsers — add JS validation before submit
if (isDocRequired && !file) {
  setError('Document is required for this leave type')
  return
}
```

**Warning banners after submit:**
```tsx
{result?.balanceWarning && (
  <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 rounded p-3 text-sm">
    Warning: Your remaining balance is less than the requested leave duration.
  </div>
)}
{result?.overlapWarning && (
  <div className="bg-orange-50 border border-orange-300 text-orange-800 rounded p-3 text-sm">
    Warning: The following team members have approved leave overlapping your dates:{' '}
    {result.overlappingLeaves.map(l => l.employeeName).join(', ')}
  </div>
)}
```

Keep the overall structure consistent with `holidays/index.tsx` (same UI library: Tailwind, Modal component from uiHelpers).

---

## Dev Notes

### Architecture Compliance
- **AD-4**: Overlap SELECT + INSERT inside single `prisma.$transaction(async tx => {...})`. Balance is NOT deducted — balance deduction happens on approval in Story 4.3.
- **AD-9**: `calculateWorkingDays()` called in `services/leaveRequest.ts`. Frontend renders server-returned `durationDays` — no client-side calculation.
- **AD-8**: `audit.append()` called after transaction. Currently a no-op stub — the call shape `{ leaveRequestId, actorId, action, comment }` is correct for when Story 4.3/4.4 implements the real audit service.
- **AD-14**: Notification recipient for SUBMITTED is the **manager**, not the employee. `notification.trigger('SUBMITTED', managerId)`.
- **AD-10**: All responses follow `{ success, data?, error? }` envelope.
- **AD-1**: `POST /leave-requests` uses `authenticate` only — all authenticated roles can submit. No `requireRole` needed (employees, managers, and admins can all submit leave requests).

### Multer Behaviour
- `upload.ts` uses `multer.diskStorage` → files are written to `uploads/<timestamp>-<random>.ext` automatically
- `req.file.filename` contains just the filename (e.g., `1734567890123-987654321.pdf`)
- `req.file` is `undefined` if no file was uploaded — check before reading `.filename`
- `upload.single('document')` — field name is `'document'` (matches FormData key in frontend)
- Multer's `fileFilter` throws `new Error('Only PDF, JPEG, and PNG files are allowed')` for bad types
- Multer's `MulterError` (code `LIMIT_FILE_SIZE`) fires for files > 5MB
- Both must be caught in `handleUpload` wrapper and returned as 400

### Date Handling
- Schema: `startDate DateTime @db.Date`, `endDate DateTime @db.Date` — stored as date only (no time)
- Always parse input YYYY-MM-DD as UTC: `new Date(dateStr + 'T00:00:00.000Z')`
- When serializing back to strings in `LeaveRequestRow`: `date.toISOString().slice(0, 10)` gives `YYYY-MM-DD`

### `audit.ts` Current State
```typescript
// services/audit.ts current content:
export const audit = {
  append: async (): Promise<void> => {}
}
```
Call it with the full shape — it's a no-op now but will be replaced in Story 4.3. The `AuditLog` schema has `leaveRequestId`, `actorId`, `action` (AuditAction enum: SUBMITTED | APPROVED | REJECTED | CANCELLED), `comment`.

### `notification.ts` Current State
```typescript
// services/notification.ts current content:
export const notification = {
  trigger: async (): Promise<void> => {}
}
```
Stub call with `('SUBMITTED', managerId)`. Full implementation in Story 4.4.

### Working Day Calculation
```typescript
// utils/workingDays.ts signature:
export function calculateWorkingDays(startDate: Date, endDate: Date, holidays: Date[]): number
```
The function expects `holidays` as `Date[]`. `prisma.companyHoliday.findMany({ select: { date: true } })` returns `{ date: Date }[]` — map to `holidays.map(h => h.date)`.

### `leaveRequest.ts` Status Before This Story
Currently: `export const leaveRequestService = {}` — entire file is replaced (not appended to).

### Frontend: `/leaves` Route
- `App.tsx` already has `<Route path="/leaves" element={<LeavesPage />} />` inside `<RequireAuth />` — no route changes needed
- `LeavesPage` is accessible to ADMIN, MANAGER, and EMPLOYEE roles
- `frontend/src/lib/types.ts` already has `LeaveRequest`, `LeaveType`, `ApiListResponse`, `ApiResponse` — no type additions needed

### Project Structure Notes
- Two new backend files: `controllers/leaveRequests.ts` and `routes/leaveRequests.ts`
- One new test file: `services/leaveRequest.test.ts`
- `routes/index.ts` gets one new import + one `router.use()` line
- `services/leaveRequest.ts` is a complete rewrite of the stub
- `frontend/src/features/leaves/index.tsx` is a complete rewrite of the stub

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.1: Leave Request Submission]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-employee-leave-management-system-2026-06-29/ARCHITECTURE-SPINE.md#AD-4, AD-9, AD-8, AD-14, AD-1]
- [Source: backend/src/middleware/upload.ts — multer diskStorage writing to uploads/]
- [Source: backend/src/utils/workingDays.ts — calculateWorkingDays signature]
- [Source: backend/src/utils/storage.ts — save() + getSignedUrl() (used in Story 4.3 for document viewing, NOT needed here)]
- [Source: backend/src/services/audit.ts — no-op stub, call shape needed for Story 4.3]
- [Source: backend/src/services/notification.ts — no-op stub, AD-14 recipient contract]
- [Source: backend/src/routes/index.ts — existing route registration pattern]
- [Source: backend/src/services/leaveBalance.ts — userId_leaveTypeId compound key pattern for balance lookup]
- [Source: backend/src/services/holiday.ts — parseDateUTC pattern + error throw pattern]
- [Source: frontend/src/features/holidays/index.tsx — UI/form/modal pattern to follow]
- [Source: frontend/src/lib/types.ts — LeaveRequest, LeaveType, ApiResponse, ApiListResponse already defined]
- [Source: frontend/src/lib/uiHelpers.tsx — errorMessage(), Modal component]
- [Source: frontend/src/App.tsx — /leaves route already wired, no App.tsx changes needed]

---

## Tasks / Subtasks

- [x] Task 1: Implement `submit()` in `leaveRequest.ts` (AC1, AC2, AC4, AC5, AC7, AC8)
  - [x] 1.1 Replace stub with full module — fetch leave type, validate documentRequired, validate dates
  - [x] 1.2 Fetch submitter's managerId and holidays for overlap check + working-day calc
  - [x] 1.3 Calculate `durationDays` via `calculateWorkingDays()`; throw 400 if ≤ 0
  - [x] 1.4 Check `balanceWarning` (balance < durationDays) outside transaction
  - [x] 1.5 Run `prisma.$transaction`: overlap SELECT (team members with APPROVED overlap) + INSERT leave request
  - [x] 1.6 Call `audit.append()` after transaction with correct shape
  - [x] 1.7 Call `notification.trigger('SUBMITTED', managerId)` after transaction (stub)
  - [x] 1.8 Return `{ request, balanceWarning, overlapWarning, overlappingLeaves }`

- [x] Task 2: Create `controllers/leaveRequests.ts` (AC1, AC2, AC3, AC4, AC5)
  - [x] 2.1 Validate all required fields: `leaveTypeId`, `startDate` (YYYY-MM-DD), `endDate` (YYYY-MM-DD), `reason`
  - [x] 2.2 Validate `startDate <= endDate`
  - [x] 2.3 Extract `documentPath` from `req.file?.filename`
  - [x] 2.4 Call `submit()` and return 201 response with warnings

- [x] Task 3: Create `routes/leaveRequests.ts` (AC3)
  - [x] 3.1 Export `leaveRequestsRouter`
  - [x] 3.2 Add `handleUpload` wrapper catching `multer.MulterError` and file-type errors → 400
  - [x] 3.3 Register `POST /` with `authenticate`, `handleUpload`, `submitLeaveRequestController`

- [x] Task 4: Update `routes/index.ts` (AC1)
  - [x] 4.1 Import `leaveRequestsRouter` from `./leaveRequests.js`
  - [x] 4.2 Add `router.use('/leave-requests', leaveRequestsRouter)`

- [x] Task 5: Write tests `services/leaveRequest.test.ts` (AC1–AC8)
  - [x] 5.1 Mock `prisma/client.js`, `utils/workingDays.js`, `services/audit.js`, `services/notification.js`
  - [x] 5.2 Test happy path: returns SubmitResult with correct shape
  - [x] 5.3 Test `balanceWarning: true` when balance < durationDays
  - [x] 5.4 Test `overlapWarning: true` when team member has overlapping approved leave
  - [x] 5.5 Test `document_required` + no file → 400
  - [x] 5.6 Test leave type not found → 404
  - [x] 5.7 Test inactive leave type → 400
  - [x] 5.8 Test `audit.append()` called after transaction
  - [x] 5.9 Test `notification.trigger()` called with managerId

- [x] Task 6: Update `frontend/src/features/leaves/index.tsx` (AC1, AC4, AC5, AC6)
  - [x] 6.1 Replace stub with `LeavesPage` (title + Submit button + modal trigger)
  - [x] 6.2 Implement `SubmitLeaveModal`:
    - [x] 6.2.1 Load active leave types on mount via `GET /leave-types`
    - [x] 6.2.2 Render form: leave type select, start date, end date, reason, file input
    - [x] 6.2.3 Make file input required when selected leave type has `documentRequired: true` (JS validation before submit)
    - [x] 6.2.4 Submit as `FormData` via `apiClient.post('/leave-requests', formData)` — no manual Content-Type header
    - [x] 6.2.5 On success: show balance warning banner if `balanceWarning: true`
    - [x] 6.2.6 On success: show overlap warning banner if `overlapWarning: true` with employee names
    - [x] 6.2.7 On API error: display error message in modal
  - [x] 6.3 No changes to `App.tsx` or `frontend/src/lib/types.ts`

- [x] Task 7: Validate and run tests
  - [x] 7.1 Run `npm test` in backend — all tests pass including new `submit()` test cases
  - [x] 7.2 TypeScript check passes for backend (`tsc --noEmit`)
  - [x] 7.3 TypeScript check passes for frontend (`tsc --noEmit`)
  - [x] 7.4 Verify `POST /leave-requests` returns 201 with correct envelope manually

---

## Dev Agent Record

### Agent Model Used

_to be filled by dev agent_

### Debug Log References

### Completion Notes List

### File List
