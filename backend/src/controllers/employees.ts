import type { Request, Response, NextFunction } from 'express'
import { listUsers, getUser, createUser, updateUser, listAvailableManagers, VALID_ROLES } from '../services/user.js'
import type { UserRole } from '../services/user.js'
import { getBalancesForUser, updateBalance } from '../services/leaveBalance.js'

function isValidRole(value: unknown): value is UserRole {
  return VALID_ROLES.includes(value as UserRole)
}

export async function listEmployeesController(req: Request, res: Response, next: NextFunction) {
  try {
    const pageParam = Number(req.query['page'])
    const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1
    const limitParam = Number(req.query['limit'])
    const limit = Number.isInteger(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 20

    const search =
      typeof req.query['search'] === 'string' ? req.query['search'].trim() || undefined : undefined
    const departmentId =
      typeof req.query['departmentId'] === 'string' ? req.query['departmentId'] : undefined

    const { data, total } = await listUsers(page, limit, { search, departmentId })
    res.status(200).json({ success: true, data, meta: { page, limit, total } })
  } catch (err) {
    next(err)
  }
}

export async function getEmployeeController(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string }
    const user = await getUser(id)
    res.status(200).json({ success: true, data: user })
  } catch (err) {
    next(err)
  }
}

export async function createEmployeeController(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, name, password, role, departmentId, managerId } = req.body as Record<string, unknown>

    if (!email || typeof email !== 'string' || email.trim() === '') {
      res.status(400).json({ success: false, error: 'email is required' })
      return
    }
    if (!name || typeof name !== 'string' || name.trim() === '') {
      res.status(400).json({ success: false, error: 'name is required' })
      return
    }
    if (!password || typeof password !== 'string' || password.trim() === '') {
      res.status(400).json({ success: false, error: 'password is required' })
      return
    }
    if (password.length < 8) {
      res.status(400).json({ success: false, error: 'password must be at least 8 characters' })
      return
    }
    if (!isValidRole(role)) {
      res.status(400).json({ success: false, error: 'role must be one of: ADMIN, MANAGER, EMPLOYEE' })
      return
    }
    if (departmentId !== undefined && departmentId !== null && typeof departmentId !== 'string') {
      res.status(400).json({ success: false, error: 'departmentId must be a string or null' })
      return
    }
    if (managerId !== undefined && managerId !== null && typeof managerId !== 'string') {
      res.status(400).json({ success: false, error: 'managerId must be a string or null' })
      return
    }

    const user = await createUser({
      email: (email as string).trim().toLowerCase(),
      name: (name as string).trim(),
      password: password as string,
      role,
      departmentId: departmentId as string | undefined,
      managerId: managerId as string | undefined,
    })
    res.status(201).json({ success: true, data: user })
  } catch (err) {
    next(err)
  }
}

export async function updateEmployeeController(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string }
    const { name, role, departmentId, managerId, active } = req.body as Record<string, unknown>

    if (name !== undefined && (typeof name !== 'string' || (name as string).trim() === '')) {
      res.status(400).json({ success: false, error: 'name must be a non-empty string' })
      return
    }
    if (role !== undefined && !isValidRole(role)) {
      res.status(400).json({ success: false, error: 'role must be one of: ADMIN, MANAGER, EMPLOYEE' })
      return
    }
    if (departmentId !== undefined && departmentId !== null && typeof departmentId !== 'string') {
      res.status(400).json({ success: false, error: 'departmentId must be a string or null' })
      return
    }
    if (managerId !== undefined && managerId !== null && typeof managerId !== 'string') {
      res.status(400).json({ success: false, error: 'managerId must be a string or null' })
      return
    }
    if (active !== undefined && typeof active !== 'boolean') {
      res.status(400).json({ success: false, error: 'active must be a boolean' })
      return
    }

    const updates: Parameters<typeof updateUser>[1] = {}
    if (name !== undefined) updates.name = (name as string).trim()
    if (role !== undefined) updates.role = role as UserRole
    if (departmentId !== undefined) updates.departmentId = (departmentId as string | null) || null
    if (managerId !== undefined) updates.managerId = (managerId as string | null) || null
    if (active !== undefined) updates.active = active as boolean

    const user = await updateUser(id, updates)
    res.status(200).json({ success: true, data: user })
  } catch (err) {
    next(err)
  }
}

export async function listAvailableManagersController(_req: Request, res: Response, next: NextFunction) {
  try {
    const managers = await listAvailableManagers()
    res.status(200).json({ success: true, data: managers })
  } catch (err) {
    next(err)
  }
}

export async function getEmployeeBalancesController(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string }
    const balances = await getBalancesForUser(id)
    res.status(200).json({ success: true, data: balances })
  } catch (err) {
    next(err)
  }
}

export async function updateEmployeeBalanceController(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, leaveTypeId } = req.params as { id: string; leaveTypeId: string }
    const { balance } = req.body as { balance?: unknown }

    if (balance === undefined || balance === null || typeof balance !== 'number' || !Number.isInteger(balance)) {
      res.status(400).json({ success: false, error: 'balance must be an integer' })
      return
    }

    const updated = await updateBalance(id, leaveTypeId, balance)
    res.status(200).json({ success: true, data: updated })
  } catch (err) {
    next(err)
  }
}
