import type { Request, Response, NextFunction } from 'express'
import { submit } from '../services/leaveRequest.js'

export async function submitLeaveRequestController(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId
    const { leaveTypeId, startDate, endDate, reason } = req.body as Record<string, unknown>

    if (!leaveTypeId || typeof leaveTypeId !== 'string') {
      res.status(400).json({ success: false, error: 'leaveTypeId is required' })
      return
    }
    if (!startDate || typeof startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      res.status(400).json({ success: false, error: 'startDate must be YYYY-MM-DD' })
      return
    }
    if (!endDate || typeof endDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      res.status(400).json({ success: false, error: 'endDate must be YYYY-MM-DD' })
      return
    }
    if (startDate > endDate) {
      res.status(400).json({ success: false, error: 'startDate must not be after endDate' })
      return
    }
    if (!reason || typeof reason !== 'string' || (reason as string).trim() === '') {
      res.status(400).json({ success: false, error: 'reason is required' })
      return
    }

    const documentPath = req.file?.filename

    const result = await submit({
      userId,
      leaveTypeId,
      startDate,
      endDate,
      reason: (reason as string).trim(),
      documentPath,
    })

    res.status(201).json({
      success: true,
      data: {
        ...result.request,
        balanceWarning: result.balanceWarning,
        overlapWarning: result.overlapWarning,
        overlappingLeaves: result.overlappingLeaves,
      },
    })
  } catch (err) {
    next(err)
  }
}
