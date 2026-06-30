import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../prisma/client.js', () => ({
  prisma: {
    department: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock('dotenv/config', () => ({}))

import { prisma } from '../prisma/client.js'
import { createDepartment, updateDepartment, listDepartments, listAvailableManagers } from './department.js'

describe('createDepartment()', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a department when the name is unique', async () => {
    ;(prisma.department.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(prisma.department.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'd1',
      name: 'Engineering',
      managerId: null,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const result = await createDepartment('Engineering')

    expect(prisma.department.create).toHaveBeenCalledWith({ data: { name: 'Engineering' } })
    expect(result.name).toBe('Engineering')
  })

  it('throws 409 when the department name already exists', async () => {
    ;(prisma.department.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'd1', name: 'Engineering' })

    await expect(createDepartment('Engineering')).rejects.toMatchObject({
      message: 'Department name already exists',
      status: 409,
    })
    expect(prisma.department.create).not.toHaveBeenCalled()
  })
})

describe('updateDepartment()', () => {
  beforeEach(() => vi.clearAllMocks())

  it('assigns a manager when the user has role MANAGER and manages no other department', async () => {
    ;(prisma.department.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'd1',
      name: 'Engineering',
      managerId: null,
      active: true,
    })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u1', role: 'MANAGER', active: true })
    ;(prisma.department.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(prisma.department.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'd1',
      name: 'Engineering',
      managerId: 'u1',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const result = await updateDepartment('d1', { managerId: 'u1' })

    expect(prisma.department.update).toHaveBeenCalledWith({ where: { id: 'd1' }, data: { managerId: 'u1' } })
    expect(result.managerId).toBe('u1')
  })

  it('throws 400 when managerId belongs to a non-MANAGER user', async () => {
    ;(prisma.department.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'd1',
      name: 'Engineering',
      managerId: null,
      active: true,
    })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u1', role: 'EMPLOYEE', active: true })

    await expect(updateDepartment('d1', { managerId: 'u1' })).rejects.toMatchObject({
      message: 'managerId must belong to an active user with role MANAGER',
      status: 400,
    })
    expect(prisma.department.update).not.toHaveBeenCalled()
  })

  it('throws 400 when managerId belongs to an inactive MANAGER', async () => {
    ;(prisma.department.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'd1',
      name: 'Engineering',
      managerId: null,
      active: true,
    })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u1', role: 'MANAGER', active: false })

    await expect(updateDepartment('d1', { managerId: 'u1' })).rejects.toMatchObject({
      message: 'managerId must belong to an active user with role MANAGER',
      status: 400,
    })
    expect(prisma.department.update).not.toHaveBeenCalled()
  })

  it('throws 409 when the manager already manages another department', async () => {
    ;(prisma.department.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'd1',
      name: 'Engineering',
      managerId: null,
      active: true,
    })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u1', role: 'MANAGER', active: true })
    ;(prisma.department.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'd2', managerId: 'u1' })

    await expect(updateDepartment('d1', { managerId: 'u1' })).rejects.toMatchObject({
      message: 'User already manages another department',
      status: 409,
    })
    expect(prisma.department.update).not.toHaveBeenCalled()
  })

  it('throws 409 when renaming to a name that already exists', async () => {
    ;(prisma.department.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: 'd1', name: 'Engineering', managerId: null, active: true })
      .mockResolvedValueOnce({ id: 'd2', name: 'Sales' })

    await expect(updateDepartment('d1', { name: 'Sales' })).rejects.toMatchObject({
      message: 'Department name already exists',
      status: 409,
    })
    expect(prisma.department.update).not.toHaveBeenCalled()
  })

  it('does not skip the duplicate-name check when name is an empty string', async () => {
    ;(prisma.department.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: 'd1', name: 'Engineering', managerId: null, active: true })
      .mockResolvedValueOnce({ id: 'd2', name: '' })

    await expect(updateDepartment('d1', { name: '' })).rejects.toMatchObject({
      message: 'Department name already exists',
      status: 409,
    })
    expect(prisma.department.update).not.toHaveBeenCalled()
  })

  it('throws 404 when the department does not exist', async () => {
    ;(prisma.department.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    await expect(updateDepartment('missing', { name: 'X' })).rejects.toMatchObject({
      message: 'Department not found',
      status: 404,
    })
  })

  it('deactivates a department without touching its employees', async () => {
    ;(prisma.department.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'd1',
      name: 'Engineering',
      managerId: null,
      active: true,
    })
    ;(prisma.department.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'd1',
      name: 'Engineering',
      managerId: null,
      active: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const result = await updateDepartment('d1', { active: false })

    expect(prisma.department.update).toHaveBeenCalledWith({ where: { id: 'd1' }, data: { active: false } })
    expect(result.active).toBe(false)
  })
})

describe('listDepartments()', () => {
  beforeEach(() => vi.clearAllMocks())

  it('includes inactive departments for ADMIN role', async () => {
    ;(prisma.department.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(prisma.department.count as ReturnType<typeof vi.fn>).mockResolvedValue(0)

    await listDepartments('ADMIN', 1, 20)

    expect(prisma.department.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    )
    expect(prisma.department.count).toHaveBeenCalledWith({ where: {} })
  })

  it('filters to active-only departments for MANAGER role', async () => {
    ;(prisma.department.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(prisma.department.count as ReturnType<typeof vi.fn>).mockResolvedValue(0)

    await listDepartments('MANAGER', 1, 20)

    expect(prisma.department.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true } })
    )
    expect(prisma.department.count).toHaveBeenCalledWith({ where: { active: true } })
  })

  it('filters to active-only departments for EMPLOYEE role', async () => {
    ;(prisma.department.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(prisma.department.count as ReturnType<typeof vi.fn>).mockResolvedValue(0)

    await listDepartments('EMPLOYEE', 1, 20)

    expect(prisma.department.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true } })
    )
  })

  it('applies pagination skip/take based on page and limit', async () => {
    ;(prisma.department.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(prisma.department.count as ReturnType<typeof vi.fn>).mockResolvedValue(0)

    await listDepartments('ADMIN', 3, 10)

    expect(prisma.department.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    )
  })
})

describe('listAvailableManagers()', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns only active MANAGER users with id, name, email', async () => {
    ;(prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'u1', name: 'Alice', email: 'alice@example.com' },
    ])

    const result = await listAvailableManagers()

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { role: 'MANAGER', active: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    })
    expect(result).toEqual([{ id: 'u1', name: 'Alice', email: 'alice@example.com' }])
  })
})
