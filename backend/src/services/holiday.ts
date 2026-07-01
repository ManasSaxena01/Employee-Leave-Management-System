import { prisma } from '../prisma/client.js'

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002'
}

function isNotFoundError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2025'
}

export interface HolidayResult {
  id: string
  date: string
  name: string
  createdAt: Date
  updatedAt: Date
}

function toResult(h: { id: string; date: Date; name: string; createdAt: Date; updatedAt: Date }): HolidayResult {
  return { ...h, date: h.date.toISOString().slice(0, 10) }
}

function parseDateUTC(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00.000Z')
}

export async function listHolidays(
  page: number,
  limit: number
): Promise<{ data: HolidayResult[]; total: number }> {
  const [rows, total] = await Promise.all([
    prisma.companyHoliday.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { date: 'asc' },
    }),
    prisma.companyHoliday.count(),
  ])
  return { data: rows.map(toResult), total }
}

export async function createHoliday(input: { date: string; name: string }): Promise<HolidayResult> {
  const parsedDate = parseDateUTC(input.date)

  const existing = await prisma.companyHoliday.findFirst({ where: { date: parsedDate } })
  if (existing) {
    throw Object.assign(new Error('A holiday already exists on this date'), { status: 409 })
  }

  try {
    const holiday = await prisma.companyHoliday.create({
      data: { date: parsedDate, name: input.name },
    })
    return toResult(holiday)
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw Object.assign(new Error('A holiday already exists on this date'), { status: 409 })
    }
    throw err
  }
}

export async function updateHoliday(
  id: string,
  updates: { date?: string; name?: string }
): Promise<HolidayResult> {
  const holiday = await prisma.companyHoliday.findUnique({ where: { id } })
  if (!holiday) {
    throw Object.assign(new Error('Company holiday not found'), { status: 404 })
  }

  const data: { date?: Date; name?: string } = {}

  if (updates.date !== undefined) {
    const parsedDate = parseDateUTC(updates.date)
    if (parsedDate.getTime() !== holiday.date.getTime()) {
      const conflict = await prisma.companyHoliday.findFirst({ where: { date: parsedDate } })
      if (conflict) {
        throw Object.assign(new Error('A holiday already exists on this date'), { status: 409 })
      }
    }
    data.date = parsedDate
  }
  if (updates.name !== undefined) data.name = updates.name

  try {
    const updated = await prisma.companyHoliday.update({ where: { id }, data })
    return toResult(updated)
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw Object.assign(new Error('A holiday already exists on this date'), { status: 409 })
    }
    if (isNotFoundError(err)) {
      throw Object.assign(new Error('Company holiday not found'), { status: 404 })
    }
    throw err
  }
}

export async function deleteHoliday(id: string): Promise<void> {
  const holiday = await prisma.companyHoliday.findUnique({ where: { id } })
  if (!holiday) {
    throw Object.assign(new Error('Company holiday not found'), { status: 404 })
  }
  try {
    await prisma.companyHoliday.delete({ where: { id } })
  } catch (err) {
    if (isNotFoundError(err)) {
      throw Object.assign(new Error('Company holiday not found'), { status: 404 })
    }
    throw err
  }
}
