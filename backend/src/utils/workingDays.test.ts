import { describe, it, expect } from 'vitest'
import { calculateWorkingDays } from './workingDays.js'

describe('calculateWorkingDays', () => {
  it('Case 1: Mon–Fri range with no holidays returns 5', () => {
    const start = new Date('2026-01-05')  // Monday
    const end = new Date('2026-01-09')    // Friday
    expect(calculateWorkingDays(start, end, [])).toBe(5)
  })

  it('Case 2: Mon–Fri range spanning one holiday returns 4', () => {
    const start = new Date('2026-12-21')    // Monday
    const end = new Date('2026-12-25')      // Friday
    const holidays = [new Date('2026-12-24')]  // Thursday (Christmas Eve)
    expect(calculateWorkingDays(start, end, holidays)).toBe(4)
  })

  it('Case 3: Single day that falls on a holiday returns 0', () => {
    const start = new Date('2026-12-25')    // Thursday (Christmas)
    const end = new Date('2026-12-25')
    const holidays = [new Date('2026-12-25')]
    expect(calculateWorkingDays(start, end, holidays)).toBe(0)
  })

  it('Weekend days are excluded', () => {
    const start = new Date('2026-01-10')  // Saturday
    const end = new Date('2026-01-11')    // Sunday
    expect(calculateWorkingDays(start, end, [])).toBe(0)
  })

  it('Full week with mid-week holiday returns 4', () => {
    const start = new Date('2026-01-05')  // Monday
    const end = new Date('2026-01-09')    // Friday
    const holidays = [new Date('2026-01-07')]  // Wednesday
    expect(calculateWorkingDays(start, end, holidays)).toBe(4)
  })
})
