import type { Request, Response, NextFunction } from 'express'
import {
  listDepartments,
  createDepartment,
  updateDepartment,
  listAvailableManagers,
} from '../services/department.js'

export async function listDepartmentsController(req: Request, res: Response, next: NextFunction) {
  try {
    const pageParam = Number(req.query['page'])
    const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1
    const limitParam = Number(req.query['limit'])
    const limit = Number.isInteger(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 20
    const role = req.user?.role ?? ''

    const { data, total } = await listDepartments(role, page, limit)

    res.status(200).json({ success: true, data, meta: { page, limit, total } })
  } catch (err) {
    next(err)
  }
}

export async function createDepartmentController(req: Request, res: Response, next: NextFunction) {
  try {
    const { name } = req.body as { name?: string }

    if (!name || typeof name !== 'string') {
      res.status(400).json({ success: false, error: 'name is required' })
      return
    }

    const department = await createDepartment(name)

    res.status(201).json({ success: true, data: department })
  } catch (err) {
    next(err)
  }
}

export async function updateDepartmentController(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string }
    const { name, active, managerId } = req.body as { name?: unknown; active?: unknown; managerId?: unknown }

    if (managerId !== undefined && managerId !== null && typeof managerId !== 'string') {
      res.status(400).json({ success: false, error: 'managerId must be a string or null' })
      return
    }
    if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
      res.status(400).json({ success: false, error: 'name must be a non-empty string' })
      return
    }
    if (active !== undefined && typeof active !== 'boolean') {
      res.status(400).json({ success: false, error: 'active must be a boolean' })
      return
    }

    const updates: { name?: string; active?: boolean; managerId?: string | null } = {}
    if (name !== undefined) updates.name = name
    if (active !== undefined) updates.active = active
    if (managerId !== undefined) updates.managerId = managerId

    const department = await updateDepartment(id, updates)

    res.status(200).json({ success: true, data: department })
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
