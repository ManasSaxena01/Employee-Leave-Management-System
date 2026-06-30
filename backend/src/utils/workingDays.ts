export function calculateWorkingDays(
  startDate: Date,
  endDate: Date,
  holidays: Date[]
): number {
  const holidaySet = new Set(holidays.map(toYMD))
  let count = 0
  const current = new Date(startDate)

  while (current <= endDate) {
    const day = current.getDay()  // 0=Sun, 6=Sat
    if (day !== 0 && day !== 6 && !holidaySet.has(toYMD(current))) {
      count++
    }
    current.setDate(current.getDate() + 1)
  }

  return count
}

function toYMD(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
