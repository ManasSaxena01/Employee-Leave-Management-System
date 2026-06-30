import { Prisma } from '@prisma/client'
import { prisma } from '../prisma/client.js'
import { provisionBalancesForNewLeaveType } from './leaveBalance.js'

export interface LeaveTypeResult {
  id: string
  name: string
  defaultQuota: number
  documentRequired: boolean
  active: boolean
  createdAt: Date
  updatedAt: Date
}

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
}

export async function listLeaveTypes(
  role: string,
  page: number,
  limit: number
): Promise<{ data: LeaveTypeResult[]; total: number }> {
  const where = role === 'ADMIN' ? {} : { active: true }
  const [data, total] = await Promise.all([
    prisma.leaveType.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { name: 'asc' } }),
    prisma.leaveType.count({ where }),
  ])
  return { data, total }
}

export async function createLeaveType(input: {
  name: string
  defaultQuota: number
  documentRequired: boolean
}): Promise<LeaveTypeResult> {
  const existing = await prisma.leaveType.findUnique({ where: { name: input.name } })
  if (existing) {
    throw Object.assign(new Error('Leave type name already exists'), { status: 409 })
  }

  let leaveType: LeaveTypeResult
  try {
    leaveType = await prisma.leaveType.create({ data: input })
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw Object.assign(new Error('Leave type name already exists'), { status: 409 })
    }
    throw err
  }

  await provisionBalancesForNewLeaveType(leaveType.id, leaveType.defaultQuota)

  return leaveType
}

export async function updateLeaveType(
  id: string,
  updates: { name?: string; defaultQuota?: number; documentRequired?: boolean; active?: boolean }
): Promise<LeaveTypeResult> {
  const leaveType = await prisma.leaveType.findUnique({ where: { id } })
  if (!leaveType) {
    throw Object.assign(new Error('Leave type not found'), { status: 404 })
  }

  if (updates.name !== undefined && updates.name !== leaveType.name) {
    const nameTaken = await prisma.leaveType.findUnique({ where: { name: updates.name } })
    if (nameTaken) {
      throw Object.assign(new Error('Leave type name already exists'), { status: 409 })
    }
  }

  try {
    return await prisma.leaveType.update({ where: { id }, data: updates })
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw Object.assign(new Error('Leave type name already exists'), { status: 409 })
    }
    throw err
  }
}
