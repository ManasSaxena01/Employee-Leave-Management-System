import { prisma } from '../prisma/client.js'

// Prisma unique-constraint violation code; thrown when a concurrent request
// wins a check-then-act race past our pre-checks below.
function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002'
}

export interface DepartmentResult {
  id: string
  name: string
  managerId: string | null
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export async function listDepartments(
  role: string,
  page: number,
  limit: number
): Promise<{ data: DepartmentResult[]; total: number }> {
  const where = role === 'ADMIN' ? {} : { active: true }
  const [data, total] = await Promise.all([
    prisma.department.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { name: 'asc' } }),
    prisma.department.count({ where }),
  ])
  return { data, total }
}

export async function createDepartment(name: string): Promise<DepartmentResult> {
  const existing = await prisma.department.findUnique({ where: { name } })
  if (existing) {
    throw Object.assign(new Error('Department name already exists'), { status: 409 })
  }
  try {
    return await prisma.department.create({ data: { name } })
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw Object.assign(new Error('Department name already exists'), { status: 409 })
    }
    throw err
  }
}

export async function updateDepartment(
  id: string,
  updates: { name?: string; active?: boolean; managerId?: string | null }
): Promise<DepartmentResult> {
  const department = await prisma.department.findUnique({ where: { id } })
  if (!department) {
    throw Object.assign(new Error('Department not found'), { status: 404 })
  }

  if (updates.managerId !== undefined && updates.managerId !== null) {
    const manager = await prisma.user.findUnique({ where: { id: updates.managerId } })
    if (!manager || manager.role !== 'MANAGER' || !manager.active) {
      throw Object.assign(new Error('managerId must belong to an active user with role MANAGER'), { status: 400 })
    }
    const conflict = await prisma.department.findFirst({
      where: { managerId: updates.managerId, NOT: { id } },
    })
    if (conflict) {
      throw Object.assign(new Error('User already manages another department'), { status: 409 })
    }
  }

  if (updates.name !== undefined && updates.name !== department.name) {
    const nameTaken = await prisma.department.findUnique({ where: { name: updates.name } })
    if (nameTaken) {
      throw Object.assign(new Error('Department name already exists'), { status: 409 })
    }
  }

  try {
    return await prisma.department.update({ where: { id }, data: updates })
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      const target = (err as { meta?: { target?: string[] } }).meta?.target ?? []
      const message = target.includes('manager_id')
        ? 'User already manages another department'
        : 'Department name already exists'
      throw Object.assign(new Error(message), { status: 409 })
    }
    throw err
  }
}

// Guardrail 4: minimal manager-picker source until Epic 3 ships a real employee list.
export async function listAvailableManagers(): Promise<Array<{ id: string; name: string; email: string }>> {
  return prisma.user.findMany({
    where: { role: 'MANAGER', active: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  })
}
