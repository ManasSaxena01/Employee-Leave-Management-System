import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../prisma/client.js', () => ({
  prisma: {
    leaveType: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('./leaveBalance.js', () => ({
  provisionBalancesForNewLeaveType: vi.fn(),
}))

vi.mock('dotenv/config', () => ({}))

const { FakePrismaClientKnownRequestError } = vi.hoisted(() => {
  class FakePrismaClientKnownRequestError extends Error {
    code: string
    constructor(message: string, code: string) {
      super(message)
      this.code = code
    }
  }
  return { FakePrismaClientKnownRequestError }
})

vi.mock('@prisma/client', () => ({
  Prisma: {
    PrismaClientKnownRequestError: FakePrismaClientKnownRequestError,
  },
}))

import { prisma } from '../prisma/client.js'
import { provisionBalancesForNewLeaveType } from './leaveBalance.js'
import { createLeaveType, updateLeaveType, listLeaveTypes } from './leaveType.js'

describe('createLeaveType()', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a leave type and provisions balances for active employees', async () => {
    ;(prisma.leaveType.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(prisma.leaveType.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'lt1',
      name: 'Bereavement',
      defaultQuota: 5,
      documentRequired: false,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const result = await createLeaveType({ name: 'Bereavement', defaultQuota: 5, documentRequired: false })

    expect(prisma.leaveType.create).toHaveBeenCalledWith({
      data: { name: 'Bereavement', defaultQuota: 5, documentRequired: false },
    })
    expect(provisionBalancesForNewLeaveType).toHaveBeenCalledWith('lt1', 5)
    expect(result.name).toBe('Bereavement')
  })

  it('throws 409 when the name already exists (pre-check)', async () => {
    ;(prisma.leaveType.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'lt1', name: 'Sick' })

    await expect(
      createLeaveType({ name: 'Sick', defaultQuota: 10, documentRequired: true })
    ).rejects.toMatchObject({
      message: 'Leave type name already exists',
      status: 409,
    })
    expect(prisma.leaveType.create).not.toHaveBeenCalled()
    expect(provisionBalancesForNewLeaveType).not.toHaveBeenCalled()
  })

  it('throws 409 when a concurrent create() hits a P2002 unique violation', async () => {
    ;(prisma.leaveType.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(prisma.leaveType.create as ReturnType<typeof vi.fn>).mockRejectedValue(
      new FakePrismaClientKnownRequestError('Unique constraint failed', 'P2002')
    )

    await expect(
      createLeaveType({ name: 'Sick', defaultQuota: 10, documentRequired: true })
    ).rejects.toMatchObject({
      message: 'Leave type name already exists',
      status: 409,
    })
    expect(provisionBalancesForNewLeaveType).not.toHaveBeenCalled()
  })
})

describe('updateLeaveType()', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renames a leave type', async () => {
    ;(prisma.leaveType.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: 'lt1', name: 'Casual', defaultQuota: 5, documentRequired: false, active: true })
      .mockResolvedValueOnce(null)
    ;(prisma.leaveType.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'lt1',
      name: 'Personal',
      defaultQuota: 5,
      documentRequired: false,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const result = await updateLeaveType('lt1', { name: 'Personal' })

    expect(prisma.leaveType.update).toHaveBeenCalledWith({ where: { id: 'lt1' }, data: { name: 'Personal' } })
    expect(result.name).toBe('Personal')
  })

  it('throws 409 when renaming to a name that already exists', async () => {
    ;(prisma.leaveType.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: 'lt1', name: 'Casual', defaultQuota: 5, documentRequired: false, active: true })
      .mockResolvedValueOnce({ id: 'lt2', name: 'Sick' })

    await expect(updateLeaveType('lt1', { name: 'Sick' })).rejects.toMatchObject({
      message: 'Leave type name already exists',
      status: 409,
    })
    expect(prisma.leaveType.update).not.toHaveBeenCalled()
  })

  it('does not skip the duplicate-name check when name is an empty string', async () => {
    ;(prisma.leaveType.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: 'lt1', name: 'Casual', defaultQuota: 5, documentRequired: false, active: true })
      .mockResolvedValueOnce({ id: 'lt2', name: '' })

    await expect(updateLeaveType('lt1', { name: '' })).rejects.toMatchObject({
      message: 'Leave type name already exists',
      status: 409,
    })
    expect(prisma.leaveType.update).not.toHaveBeenCalled()
  })

  it('throws 404 when the leave type does not exist', async () => {
    ;(prisma.leaveType.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    await expect(updateLeaveType('missing', { name: 'X' })).rejects.toMatchObject({
      message: 'Leave type not found',
      status: 404,
    })
  })

  it('deactivates a leave type', async () => {
    ;(prisma.leaveType.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'lt1',
      name: 'Casual',
      defaultQuota: 5,
      documentRequired: false,
      active: true,
    })
    ;(prisma.leaveType.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'lt1',
      name: 'Casual',
      defaultQuota: 5,
      documentRequired: false,
      active: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const result = await updateLeaveType('lt1', { active: false })

    expect(prisma.leaveType.update).toHaveBeenCalledWith({ where: { id: 'lt1' }, data: { active: false } })
    expect(result.active).toBe(false)
  })

  it('updates defaultQuota and documentRequired', async () => {
    ;(prisma.leaveType.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'lt1',
      name: 'Casual',
      defaultQuota: 5,
      documentRequired: false,
      active: true,
    })
    ;(prisma.leaveType.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'lt1',
      name: 'Casual',
      defaultQuota: 8,
      documentRequired: true,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const result = await updateLeaveType('lt1', { defaultQuota: 8, documentRequired: true })

    expect(prisma.leaveType.update).toHaveBeenCalledWith({
      where: { id: 'lt1' },
      data: { defaultQuota: 8, documentRequired: true },
    })
    expect(result.defaultQuota).toBe(8)
    expect(result.documentRequired).toBe(true)
  })

  it('throws 409 when a concurrent update() hits a P2002 unique violation on rename', async () => {
    ;(prisma.leaveType.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: 'lt1', name: 'Casual', defaultQuota: 5, documentRequired: false, active: true })
      .mockResolvedValueOnce(null)
    ;(prisma.leaveType.update as ReturnType<typeof vi.fn>).mockRejectedValue(
      new FakePrismaClientKnownRequestError('Unique constraint failed', 'P2002')
    )

    await expect(updateLeaveType('lt1', { name: 'Sick' })).rejects.toMatchObject({
      message: 'Leave type name already exists',
      status: 409,
    })
  })
})

describe('listLeaveTypes()', () => {
  beforeEach(() => vi.clearAllMocks())

  it('includes inactive leave types for ADMIN role', async () => {
    ;(prisma.leaveType.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(prisma.leaveType.count as ReturnType<typeof vi.fn>).mockResolvedValue(0)

    await listLeaveTypes('ADMIN', 1, 20)

    expect(prisma.leaveType.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }))
    expect(prisma.leaveType.count).toHaveBeenCalledWith({ where: {} })
  })

  it('filters to active-only leave types for MANAGER role', async () => {
    ;(prisma.leaveType.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(prisma.leaveType.count as ReturnType<typeof vi.fn>).mockResolvedValue(0)

    await listLeaveTypes('MANAGER', 1, 20)

    expect(prisma.leaveType.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { active: true } }))
    expect(prisma.leaveType.count).toHaveBeenCalledWith({ where: { active: true } })
  })

  it('filters to active-only leave types for EMPLOYEE role', async () => {
    ;(prisma.leaveType.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(prisma.leaveType.count as ReturnType<typeof vi.fn>).mockResolvedValue(0)

    await listLeaveTypes('EMPLOYEE', 1, 20)

    expect(prisma.leaveType.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { active: true } }))
  })

  it('applies pagination skip/take based on page and limit', async () => {
    ;(prisma.leaveType.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(prisma.leaveType.count as ReturnType<typeof vi.fn>).mockResolvedValue(0)

    await listLeaveTypes('ADMIN', 3, 10)

    expect(prisma.leaveType.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }))
  })
})
