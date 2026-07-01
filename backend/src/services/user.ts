import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { prisma } from '../prisma/client.js'
import { provisionBalancesForNewUser } from './leaveBalance.js'

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002'
}

export const VALID_ROLES = ['ADMIN', 'MANAGER', 'EMPLOYEE'] as const
export type UserRole = (typeof VALID_ROLES)[number]

export interface UserResult {
  id: string
  email: string
  name: string
  role: UserRole
  active: boolean
  departmentId: string | null
  managerId: string | null
  contactEmail: string | null
  phone: string | null
  photoPath: string | null
  createdAt: Date
  updatedAt: Date
}

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  active: true,
  departmentId: true,
  managerId: true,
  contactEmail: true,
  phone: true,
  photoPath: true,
  createdAt: true,
  updatedAt: true,
} as const

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

export async function getUser(id: string): Promise<UserResult> {
  const user = await prisma.user.findUnique({ where: { id }, select: USER_SELECT })
  if (!user) {
    throw Object.assign(new Error('Employee not found'), { status: 404 })
  }
  return user as UserResult
}

export async function createUser(input: {
  email: string
  name: string
  password: string
  role: UserRole
  departmentId?: string
  managerId?: string
}): Promise<UserResult> {
  const departmentId = input.departmentId || undefined
  const managerId = input.managerId || undefined

  // Fast-fail before the expensive bcrypt hash
  const existing = await prisma.user.findUnique({ where: { email: input.email } })
  if (existing) {
    throw Object.assign(new Error('Email address already in use'), { status: 409 })
  }

  const passwordHash = await bcrypt.hash(input.password, 10)

  try {
    // AD-15: wrap user creation and balance provisioning in a single transaction.
    // Dept/manager checks run inside the transaction to close the TOCTOU window
    // that bcrypt (~100 ms) creates between the pre-validation reads and the INSERT.
    return await prisma.$transaction(async (tx) => {
      if (departmentId !== undefined) {
        const dept = await tx.department.findUnique({ where: { id: departmentId } })
        if (!dept || !dept.active) {
          throw Object.assign(new Error('departmentId must refer to an active department'), { status: 400 })
        }
      }
      if (managerId !== undefined) {
        const mgr = await tx.user.findUnique({ where: { id: managerId } })
        if (!mgr || !mgr.active) {
          throw Object.assign(new Error('managerId must refer to an active user'), { status: 400 })
        }
        if (mgr.role !== 'ADMIN' && mgr.role !== 'MANAGER') {
          throw Object.assign(
            new Error('managerId must refer to a user with MANAGER or ADMIN role'),
            { status: 400 }
          )
        }
      }

      const user = (await tx.user.create({
        data: {
          email: input.email,
          name: input.name,
          passwordHash,
          role: input.role,
          departmentId: departmentId ?? null,
          managerId: managerId ?? null,
        },
        select: USER_SELECT,
      })) as UserResult
      await provisionBalancesForNewUser(user.id, tx)
      return user
    })
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw Object.assign(new Error('Email address already in use'), { status: 409 })
    }
    throw err
  }
}

export async function updateUser(
  id: string,
  updates: {
    name?: string
    role?: UserRole
    departmentId?: string | null
    managerId?: string | null
    active?: boolean
  }
): Promise<UserResult> {
  // Fast existence check before the transaction for an early 404.
  const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } })
  if (!exists) {
    throw Object.assign(new Error('Employee not found'), { status: 404 })
  }

  // Self-manager check requires no DB read.
  if (updates.managerId !== undefined && updates.managerId !== null && updates.managerId === id) {
    throw Object.assign(new Error('A user cannot be their own manager'), { status: 400 })
  }

  // All other validation and the update run inside a single serializable transaction so
  // every guard reads a consistent, locked snapshot — no TOCTOU windows.
  const updated = await prisma.$transaction(
    async (tx) => {
      const user = await tx.user.findUnique({ where: { id } })
      if (!user) throw Object.assign(new Error('Employee not found'), { status: 404 })

      if (updates.departmentId !== undefined && updates.departmentId !== null) {
        const dept = await tx.department.findUnique({ where: { id: updates.departmentId } })
        if (!dept || !dept.active) {
          throw Object.assign(new Error('departmentId must refer to an active department'), { status: 400 })
        }
      }
      if (updates.managerId !== undefined && updates.managerId !== null) {
        const mgr = await tx.user.findUnique({ where: { id: updates.managerId } })
        if (!mgr || !mgr.active) {
          throw Object.assign(new Error('managerId must refer to an active user'), { status: 400 })
        }
        if (mgr.role !== 'ADMIN' && mgr.role !== 'MANAGER') {
          throw Object.assign(
            new Error('managerId must refer to a user with MANAGER or ADMIN role'),
            { status: 400 }
          )
        }
      }

      // Block role downgrade to EMPLOYEE when this user has active direct reports.
      if (updates.role === 'EMPLOYEE' && user.role !== 'EMPLOYEE') {
        const subordinateCount = await tx.user.count({ where: { managerId: id, active: true } })
        if (subordinateCount > 0) {
          throw Object.assign(
            new Error('Cannot change role to EMPLOYEE — user has active direct reports. Reassign their reports first.'),
            { status: 400 }
          )
        }
      }

      if (
        user.role === 'ADMIN' &&
        (updates.active === false || (updates.role !== undefined && updates.role !== 'ADMIN'))
      ) {
        const otherAdminCount = await tx.user.count({
          where: { role: 'ADMIN', active: true, NOT: { id } },
        })
        if (otherAdminCount === 0) {
          throw Object.assign(new Error('Cannot remove the last active admin'), { status: 400 })
        }
      }

      return (await tx.user.update({
        where: { id },
        data: updates,
        select: USER_SELECT,
      })) as UserResult
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  )

  // Invalidate active sessions immediately when deactivating
  if (updates.active === false) {
    await prisma.refreshToken.deleteMany({ where: { userId: id } })
  }

  return updated
}

export async function listAvailableManagers(): Promise<Array<{ id: string; name: string; email: string }>> {
  return prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'MANAGER'] }, active: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  })
}
