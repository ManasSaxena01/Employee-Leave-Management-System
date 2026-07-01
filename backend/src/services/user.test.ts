import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../prisma/client.js', () => {
  const prismaMock = {
    $transaction: vi.fn().mockImplementation((cb: (tx: typeof prismaMock) => Promise<unknown>) => cb(prismaMock)),
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    department: {
      findUnique: vi.fn(),
    },
    refreshToken: {
      deleteMany: vi.fn(),
    },
  }
  return { prisma: prismaMock }
})

vi.mock('dotenv/config', () => ({}))

vi.mock('./leaveBalance.js', () => ({
  provisionBalancesForNewUser: vi.fn(),
}))

import { prisma } from '../prisma/client.js'
import { provisionBalancesForNewUser } from './leaveBalance.js'
import { createUser, updateUser, listUsers, listAvailableManagers, getUser } from './user.js'

const mockUser = {
  id: 'u1',
  email: 'alice@demo.com',
  name: 'Alice',
  role: 'EMPLOYEE' as const,
  active: true,
  departmentId: null,
  managerId: null,
  contactEmail: null,
  phone: null,
  photoPath: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('createUser()', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path: creates user and provisions balances', async () => {
    ;(prisma.department.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'd1',
      active: true,
    })
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(null) // email uniqueness check (now first, before bcrypt)
      .mockResolvedValueOnce({ id: 'm1', active: true, role: 'MANAGER' }) // managerId check (inside tx)
    ;(prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser)
    ;(provisionBalancesForNewUser as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const result = await createUser({
      email: 'alice@demo.com',
      name: 'Alice',
      password: 'password123',
      role: 'EMPLOYEE',
      departmentId: 'd1',
      managerId: 'm1',
    })

    expect(prisma.user.create).toHaveBeenCalledOnce()
    expect(provisionBalancesForNewUser).toHaveBeenCalledWith(mockUser.id, expect.anything())
    expect(result).not.toHaveProperty('passwordHash')
    expect(result.email).toBe('alice@demo.com')
  })

  it('creates user without optional departmentId and managerId', async () => {
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null) // email uniqueness
    ;(prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser)
    ;(provisionBalancesForNewUser as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    await createUser({ email: 'alice@demo.com', name: 'Alice', password: 'pass', role: 'EMPLOYEE' })

    expect(prisma.department.findUnique).not.toHaveBeenCalled()
    expect(prisma.user.create).toHaveBeenCalledOnce()
    expect(provisionBalancesForNewUser).toHaveBeenCalledWith(mockUser.id, expect.anything())
  })

  it('throws 409 via pre-check when email already exists', async () => {
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser) // email found

    await expect(
      createUser({ email: 'alice@demo.com', name: 'Alice', password: 'pass', role: 'EMPLOYEE' })
    ).rejects.toMatchObject({ message: 'Email address already in use', status: 409 })
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('throws 409 via P2002 when create throws unique constraint error', async () => {
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null) // pre-check passes
    ;(prisma.user.create as ReturnType<typeof vi.fn>).mockRejectedValue({ code: 'P2002' })

    await expect(
      createUser({ email: 'alice@demo.com', name: 'Alice', password: 'pass', role: 'EMPLOYEE' })
    ).rejects.toMatchObject({ message: 'Email address already in use', status: 409 })
  })

  it('throws 400 when departmentId does not exist', async () => {
    ;(prisma.department.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    await expect(
      createUser({ email: 'a@b.com', name: 'A', password: 'pass', role: 'EMPLOYEE', departmentId: 'bad-dept' })
    ).rejects.toMatchObject({ message: 'departmentId must refer to an active department', status: 400 })
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('throws 400 when departmentId refers to an inactive department', async () => {
    ;(prisma.department.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'd1', active: false })

    await expect(
      createUser({ email: 'a@b.com', name: 'A', password: 'pass', role: 'EMPLOYEE', departmentId: 'd1' })
    ).rejects.toMatchObject({ message: 'departmentId must refer to an active department', status: 400 })
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('throws 400 when managerId does not exist', async () => {
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null) // managerId not found

    await expect(
      createUser({ email: 'a@b.com', name: 'A', password: 'pass', role: 'EMPLOYEE', managerId: 'bad-mgr' })
    ).rejects.toMatchObject({ message: 'managerId must refer to an active user', status: 400 })
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('throws 400 when managerId refers to an inactive user', async () => {
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(null) // email check (now first)
      .mockResolvedValueOnce({ id: 'm1', active: false, role: 'MANAGER' }) // managerId inactive

    await expect(
      createUser({ email: 'a@b.com', name: 'A', password: 'pass', role: 'EMPLOYEE', managerId: 'm1' })
    ).rejects.toMatchObject({ message: 'managerId must refer to an active user', status: 400 })
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('throws 400 when managerId refers to a user with EMPLOYEE role', async () => {
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(null) // email check
      .mockResolvedValueOnce({ id: 'm1', active: true, role: 'EMPLOYEE' }) // managerId role check

    await expect(
      createUser({ email: 'a@b.com', name: 'A', password: 'pass', role: 'EMPLOYEE', managerId: 'm1' })
    ).rejects.toMatchObject({
      message: 'managerId must refer to a user with MANAGER or ADMIN role',
      status: 400,
    })
    expect(prisma.user.create).not.toHaveBeenCalled()
  })
})

describe('updateUser()', () => {
  beforeEach(() => vi.clearAllMocks())

  it('happy path: updates user fields', async () => {
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser)
    ;(prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({ ...mockUser, name: 'Alice Updated' })

    const result = await updateUser('u1', { name: 'Alice Updated' })

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { name: 'Alice Updated' },
      select: expect.any(Object),
    })
    expect(result.name).toBe('Alice Updated')
  })

  it('throws 404 when user not found', async () => {
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    await expect(updateUser('missing', { name: 'X' })).rejects.toMatchObject({
      message: 'Employee not found',
      status: 404,
    })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('deletes refresh tokens when active is set to false', async () => {
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser)
    ;(prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({ ...mockUser, active: false })
    ;(prisma.refreshToken.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 })

    await updateUser('u1', { active: false })

    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } })
  })

  it('does NOT delete refresh tokens when active is set to true', async () => {
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ ...mockUser, active: false })
    ;(prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser)

    await updateUser('u1', { active: true })

    expect(prisma.refreshToken.deleteMany).not.toHaveBeenCalled()
  })

  it('does NOT delete refresh tokens when active field is not in updates', async () => {
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser)
    ;(prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({ ...mockUser, name: 'Bob' })

    await updateUser('u1', { name: 'Bob' })

    expect(prisma.refreshToken.deleteMany).not.toHaveBeenCalled()
  })

  it('throws 400 when departmentId refers to a non-existent department', async () => {
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser)
    ;(prisma.department.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    await expect(updateUser('u1', { departmentId: 'bad' })).rejects.toMatchObject({
      message: 'departmentId must refer to an active department',
      status: 400,
    })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('throws 400 when managerId refers to an inactive user', async () => {
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockUser) // existence check (outside tx)
      .mockResolvedValueOnce(mockUser) // re-read inside transaction
      .mockResolvedValueOnce({ id: 'm1', active: false }) // managerId check inside tx

    await expect(updateUser('u1', { managerId: 'm1' })).rejects.toMatchObject({
      message: 'managerId must refer to an active user',
      status: 400,
    })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('allows setting departmentId to null (removes department)', async () => {
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser)
    ;(prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({ ...mockUser, departmentId: null })

    await updateUser('u1', { departmentId: null })

    expect(prisma.department.findUnique).not.toHaveBeenCalled()
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { departmentId: null } })
    )
  })

  it('throws 400 when managerId refers to a user with EMPLOYEE role', async () => {
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockUser) // existence check (outside tx)
      .mockResolvedValueOnce(mockUser) // re-read inside transaction
      .mockResolvedValueOnce({ id: 'm1', active: true, role: 'EMPLOYEE' }) // managerId role check inside tx

    await expect(updateUser('u1', { managerId: 'm1' })).rejects.toMatchObject({
      message: 'managerId must refer to a user with MANAGER or ADMIN role',
      status: 400,
    })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('throws 400 when changing role to EMPLOYEE and user has active direct reports', async () => {
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockUser,
      role: 'MANAGER',
    })
    ;(prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(3)

    await expect(updateUser('u1', { role: 'EMPLOYEE' })).rejects.toMatchObject({
      message: 'Cannot change role to EMPLOYEE — user has active direct reports. Reassign their reports first.',
      status: 400,
    })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })
})

describe('listUsers()', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls findMany with correct skip, take, and orderBy name asc', async () => {
    ;(prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockUser])
    ;(prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(1)

    await listUsers(3, 10)

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10, orderBy: { name: 'asc' } })
    )
  })

  it('returned items do not include passwordHash field', async () => {
    ;(prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockUser])
    ;(prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(1)

    const { data } = await listUsers(1, 20)

    expect(data[0]).not.toHaveProperty('passwordHash')
    expect(data[0]).toHaveProperty('id')
  })

  it('returns total count alongside data', async () => {
    ;(prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockUser])
    ;(prisma.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(42)

    const { total } = await listUsers(1, 20)

    expect(total).toBe(42)
  })
})

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

describe('getUser()', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns user when found', async () => {
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser)

    const result = await getUser('u1')

    expect(result.id).toBe('u1')
    expect(result).not.toHaveProperty('passwordHash')
  })

  it('throws 404 when user not found', async () => {
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    await expect(getUser('missing')).rejects.toMatchObject({ message: 'Employee not found', status: 404 })
  })
})

describe('listAvailableManagers()', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queries for active ADMIN and MANAGER role users ordered by name', async () => {
    ;(prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'u1', name: 'Alice Admin', email: 'alice@demo.com' },
      { id: 'u2', name: 'Bob Manager', email: 'bob@demo.com' },
    ])

    const result = await listAvailableManagers()

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { role: { in: ['ADMIN', 'MANAGER'] }, active: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    })
    expect(result).toHaveLength(2)
  })
})
