const ARGENTINA_UTC_OFFSET_HOURS = 3

function pad(value: number) {
  return String(value).padStart(2, '0')
}

export function formatArgentinaDateInput(date: Date): string {
  const argentinaDate = new Date(date.getTime() - ARGENTINA_UTC_OFFSET_HOURS * 60 * 60 * 1000)

  return `${argentinaDate.getUTCFullYear()}-${pad(argentinaDate.getUTCMonth() + 1)}-${pad(argentinaDate.getUTCDate())}`
}

export function argentinaDateInputToIsoStart(dateInput: string): string {
  const [year, month, day] = dateInput.split('-').map(Number)

  return new Date(Date.UTC(year, month - 1, day, ARGENTINA_UTC_OFFSET_HOURS, 0, 0, 0)).toISOString()
}
