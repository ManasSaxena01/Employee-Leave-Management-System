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
    expect(result.request.status).toBe('PENDING')
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
