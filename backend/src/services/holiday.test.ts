import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../prisma/client.js', () => ({
  prisma: {
    companyHoliday: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock('dotenv/config', () => ({}))

import { prisma } from '../prisma/client.js'
import { createHoliday, updateHoliday, deleteHoliday, listHolidays } from './holiday.js'

const mockHoliday = {
  id: 'h1',
  date: new Date('2026-01-01T00:00:00.000Z'),
  name: "New Year's Day",
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('createHoliday()', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a holiday and returns date as YYYY-MM-DD string', async () => {
    ;(prisma.companyHoliday.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(prisma.companyHoliday.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockHoliday)

    const result = await createHoliday({ date: '2026-01-01', name: "New Year's Day" })

    expect(prisma.companyHoliday.create).toHaveBeenCalledWith({
      data: { date: new Date('2026-01-01T00:00:00.000Z'), name: "New Year's Day" },
    })
    expect(result.date).toBe('2026-01-01')
    expect(result.name).toBe("New Year's Day")
  })

  it('throws 409 when findFirst detects a duplicate date (pre-check path)', async () => {
    ;(prisma.companyHoliday.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockHoliday)

    await expect(createHoliday({ date: '2026-01-01', name: 'Duplicate' })).rejects.toMatchObject({
      message: 'A holiday already exists on this date',
      status: 409,
    })
    expect(prisma.companyHoliday.create).not.toHaveBeenCalled()
  })

  it('throws 409 when a concurrent P2002 unique-constraint error occurs (race-condition path)', async () => {
    ;(prisma.companyHoliday.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(prisma.companyHoliday.create as ReturnType<typeof vi.fn>).mockRejectedValue({ code: 'P2002' })

    await expect(createHoliday({ date: '2026-01-01', name: 'Race' })).rejects.toMatchObject({
      message: 'A holiday already exists on this date',
      status: 409,
    })
  })
})

describe('updateHoliday()', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates the date when the new date is unique', async () => {
    const existingDate = new Date('2026-01-01T00:00:00.000Z')
    ;(prisma.companyHoliday.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockHoliday,
      date: existingDate,
    })
    ;(prisma.companyHoliday.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(prisma.companyHoliday.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockHoliday,
      date: new Date('2026-01-02T00:00:00.000Z'),
    })

    const result = await updateHoliday('h1', { date: '2026-01-02' })

    expect(prisma.companyHoliday.findFirst).toHaveBeenCalledWith({
      where: { date: new Date('2026-01-02T00:00:00.000Z') },
    })
    expect(result.date).toBe('2026-01-02')
  })

  it('updates name only without triggering a duplicate date check', async () => {
    ;(prisma.companyHoliday.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockHoliday)
    ;(prisma.companyHoliday.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockHoliday,
      name: 'Updated Name',
    })

    const result = await updateHoliday('h1', { name: 'Updated Name' })

    expect(prisma.companyHoliday.findFirst).not.toHaveBeenCalled()
    expect(result.name).toBe('Updated Name')
  })

  it('throws 404 when the holiday does not exist', async () => {
    ;(prisma.companyHoliday.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    await expect(updateHoliday('missing', { name: 'X' })).rejects.toMatchObject({
      message: 'Company holiday not found',
      status: 404,
    })
  })

  it('throws 409 when the new date conflicts with another holiday (pre-check)', async () => {
    ;(prisma.companyHoliday.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockHoliday)
    ;(prisma.companyHoliday.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'h2',
      date: new Date('2026-03-01T00:00:00.000Z'),
    })

    await expect(updateHoliday('h1', { date: '2026-03-01' })).rejects.toMatchObject({
      message: 'A holiday already exists on this date',
      status: 409,
    })
    expect(prisma.companyHoliday.update).not.toHaveBeenCalled()
  })

  it('throws 409 when P2002 is thrown during update (race-condition path)', async () => {
    ;(prisma.companyHoliday.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockHoliday)
    ;(prisma.companyHoliday.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(prisma.companyHoliday.update as ReturnType<typeof vi.fn>).mockRejectedValue({ code: 'P2002' })

    await expect(updateHoliday('h1', { date: '2026-03-01' })).rejects.toMatchObject({
      message: 'A holiday already exists on this date',
      status: 409,
    })
  })

  it('does NOT call findFirst for duplicate check when the date is unchanged', async () => {
    ;(prisma.companyHoliday.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockHoliday)
    ;(prisma.companyHoliday.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockHoliday,
      name: 'Same date, new name',
    })

    await updateHoliday('h1', { date: '2026-01-01', name: 'Same date, new name' })

    expect(prisma.companyHoliday.findFirst).not.toHaveBeenCalled()
  })
})

describe('deleteHoliday()', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes the holiday when it exists', async () => {
    ;(prisma.companyHoliday.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockHoliday)
    ;(prisma.companyHoliday.delete as ReturnType<typeof vi.fn>).mockResolvedValue(mockHoliday)

    await deleteHoliday('h1')

    expect(prisma.companyHoliday.delete).toHaveBeenCalledWith({ where: { id: 'h1' } })
  })

  it('throws 404 when the holiday does not exist', async () => {
    ;(prisma.companyHoliday.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    await expect(deleteHoliday('missing')).rejects.toMatchObject({
      message: 'Company holiday not found',
      status: 404,
    })
    expect(prisma.companyHoliday.delete).not.toHaveBeenCalled()
  })
})

describe('listHolidays()', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls findMany with orderBy date asc and correct skip/take for pagination', async () => {
    ;(prisma.companyHoliday.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockHoliday])
    ;(prisma.companyHoliday.count as ReturnType<typeof vi.fn>).mockResolvedValue(1)

    const result = await listHolidays(2, 10)

    expect(prisma.companyHoliday.findMany).toHaveBeenCalledWith({
      skip: 10,
      take: 10,
      orderBy: { date: 'asc' },
    })
    expect(result.total).toBe(1)
  })

  it('returns date fields as YYYY-MM-DD strings, not ISO datetimes', async () => {
    ;(prisma.companyHoliday.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockHoliday])
    ;(prisma.companyHoliday.count as ReturnType<typeof vi.fn>).mockResolvedValue(1)

    const { data } = await listHolidays(1, 20)

    expect(data[0].date).toBe('2026-01-01')
    expect(data[0].date).not.toContain('T')
  })
})
