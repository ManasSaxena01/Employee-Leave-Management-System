import type { Request, Response, NextFunction } from 'express'
import { listHolidays, createHoliday, updateHoliday, deleteHoliday } from '../services/holiday.js'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

// JS Date rolls over invalid day-of-month values (e.g. Feb 30 → Mar 1), so
// isNaN alone is not sufficient — verify the parsed components round-trip.
function isValidCalendarDate(dateStr: string): boolean {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, day))
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
}

export async function listCompanyHolidaysController(req: Request, res: Response, next: NextFunction) {
  try {
    const pageParam = Number(req.query['page'])
    const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1
    const limitParam = Number(req.query['limit'])
    const limit = Number.isInteger(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 20

    const { data, total } = await listHolidays(page, limit)
    res.status(200).json({ success: true, data, meta: { page, limit, total } })
  } catch (err) {
    next(err)
  }
}

export async function createCompanyHolidayController(req: Request, res: Response, next: NextFunction) {
  try {
    const { date, name } = req.body as { date?: unknown; name?: unknown }

    if (typeof date !== 'string' || !DATE_REGEX.test(date) || !isValidCalendarDate(date)) {
      res.status(400).json({ success: false, error: 'date must be a valid YYYY-MM-DD string' })
      return
    }
    if (!name || typeof name !== 'string' || name.trim() === '') {
      res.status(400).json({ success: false, error: 'name is required' })
      return
    }

    const holiday = await createHoliday({ date, name: name.trim() })
    res.status(201).json({ success: true, data: holiday })
  } catch (err) {
    next(err)
  }
}

export async function updateCompanyHolidayController(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string }
    const { date, name } = req.body as { date?: unknown; name?: unknown }

    if (date !== undefined) {
      if (typeof date !== 'string' || !DATE_REGEX.test(date) || !isValidCalendarDate(date)) {
        res.status(400).json({ success: false, error: 'date must be a valid YYYY-MM-DD string' })
        return
      }
    }
    if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
      res.status(400).json({ success: false, error: 'name must be a non-empty string' })
      return
    }

    const updates: { date?: string; name?: string } = {}
    if (date !== undefined) updates.date = date as string
    if (name !== undefined) updates.name = (name as string).trim()

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, error: 'At least one of date or name must be provided' })
      return
    }

    const holiday = await updateHoliday(id, updates)
    res.status(200).json({ success: true, data: holiday })
  } catch (err) {
    next(err)
  }
}

export async function deleteCompanyHolidayController(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string }
    await deleteHoliday(id)
    res.status(200).json({ success: true, data: null })
  } catch (err) {
    next(err)
  }
}
