import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../prisma/client.js', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
    },
    leaveBalance: {
      createMany: vi.fn(),
    },
  },
}))

vi.mock('dotenv/config', () => ({}))

import { prisma } from '../prisma/client.js'
import { provisionBalancesForNewLeaveType } from './leaveBalance.js'

describe('provisionBalancesForNewLeaveType()', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queries only active users', async () => {
    ;(prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(prisma.leaveBalance.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 })

    await provisionBalancesForNewLeaveType('lt1', 10)

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { active: true },
      select: { id: true },
    })
  })

  it('creates one balance row per active user at the given defaultQuota with skipDuplicates', async () => {
    ;(prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 'u1' }, { id: 'u2' }])
    ;(prisma.leaveBalance.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 })

    await provisionBalancesForNewLeaveType('lt1', 12)

    expect(prisma.leaveBalance.createMany).toHaveBeenCalledWith({
      data: [
        { userId: 'u1', leaveTypeId: 'lt1', balance: 12 },
        { userId: 'u2', leaveTypeId: 'lt1', balance: 12 },
      ],
      skipDuplicates: true,
    })
  })

  it('no-ops when there are zero active users', async () => {
    ;(prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])

    await provisionBalancesForNewLeaveType('lt1', 10)

    expect(prisma.leaveBalance.createMany).not.toHaveBeenCalled()
  })
})
