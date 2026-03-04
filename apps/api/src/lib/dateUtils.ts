type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY'

export function computeNextDueDate(base: Date, frequency: Frequency): Date {
  const d = new Date(base)
  if (frequency === 'DAILY')   d.setDate(d.getDate() + 1)
  if (frequency === 'WEEKLY')  d.setDate(d.getDate() + 7)
  if (frequency === 'MONTHLY') d.setMonth(d.getMonth() + 1)
  return d
}

export function computeDueDates(startDate: Date, count: number, frequency: Frequency): Date[] {
  const dates: Date[] = []
  for (let i = 1; i <= count; i++) {
    const d = new Date(startDate)
    if (frequency === 'DAILY')   d.setDate(d.getDate() + i)
    if (frequency === 'WEEKLY')  d.setDate(d.getDate() + i * 7)
    if (frequency === 'MONTHLY') d.setMonth(d.getMonth() + i)
    dates.push(d)
  }
  return dates
}
