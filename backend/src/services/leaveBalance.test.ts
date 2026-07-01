import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../prisma/client.js', () => ({
  prisma: {
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    user: {
      findMany: vi.fn(),
    },
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
  },
}))

vi.mock('dotenv/config', () => ({}))

import { prisma } from '../prisma/client.js'
import {
  provisionBalancesForNewLeaveType,
  getBalancesForUser,
  updateBalance,
  resetAllBalances,
} from './leaveBalance.js'

const mockBalanceWithType = {
  id: 'lb1',
  userId: 'u1',
  leaveTypeId: 'lt1',
  balance: 10,
  leaveType: { name: 'Annual Leave', defaultQuota: 20 },
}

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
