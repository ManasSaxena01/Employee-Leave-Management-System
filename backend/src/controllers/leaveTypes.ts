import type { Request, Response, NextFunction } from 'express'
import { listLeaveTypes, createLeaveType, updateLeaveType } from '../services/leaveType.js'

export async function listLeaveTypesController(req: Request, res: Response, next: NextFunction) {
  try {
    const pageParam = Number(req.query['page'])
    const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1
    const limitParam = Number(req.query['limit'])
    const limit = Number.isInteger(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 20
    const role = req.user?.role ?? ''

    const { data, total } = await listLeaveTypes(role, page, limit)

    res.status(200).json({ success: true, data, meta: { page, limit, total } })
  } catch (err) {
    next(err)
  }
}

export async function createLeaveTypeController(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, defaultQuota, documentRequired } = req.body as {
      name?: unknown
      defaultQuota?: unknown
      documentRequired?: unknown
    }

    if (!name || typeof name !== 'string') {
      res.status(400).json({ success: false, error: 'name is required' })
      return
    }
    if (typeof defaultQuota !== 'number' || !Number.isInteger(defaultQuota) || defaultQuota <= 0) {
      res.status(400).json({ success: false, error: 'defaultQuota must be a positive integer' })
      return
    }
    if (typeof documentRequired !== 'boolean') {
      res.status(400).json({ success: false, error: 'documentRequired must be a boolean' })
      return
    }

    const leaveType = await createLeaveType({ name, defaultQuota, documentRequired })

    res.status(201).json({ success: true, data: leaveType })
  } catch (err) {
    next(err)
  }
}

export async function updateLeaveTypeController(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string }
    const { name, defaultQuota, documentRequired, active } = req.body as {
      name?: unknown
      defaultQuota?: unknown
      documentRequired?: unknown
      active?: unknown
    }

    if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
      res.status(400).json({ success: false, error: 'name must be a non-empty string' })
      return
    }
    if (
      defaultQuota !== undefined &&
      (typeof defaultQuota !== 'number' || !Number.isInteger(defaultQuota) || defaultQuota <= 0)
    ) {
      res.status(400).json({ success: false, error: 'defaultQuota must be a positive integer' })
      return
    }
    if (documentRequired !== undefined && typeof documentRequired !== 'boolean') {
      res.status(400).json({ success: false, error: 'documentRequired must be a boolean' })
      return
    }
    if (active !== undefined && typeof active !== 'boolean') {
      res.status(400).json({ success: false, error: 'active must be a boolean' })
      return
    }

    const updates: { name?: string; defaultQuota?: number; documentRequired?: boolean; active?: boolean } = {}
    if (name !== undefined) updates.name = name
    if (defaultQuota !== undefined) updates.defaultQuota = defaultQuota
    if (documentRequired !== undefined) updates.documentRequired = documentRequired
    if (active !== undefined) updates.active = active

    const leaveType = await updateLeaveType(id, updates)

    res.status(200).json({ success: true, data: leaveType })
  } catch (err) {
    next(err)
  }
}
