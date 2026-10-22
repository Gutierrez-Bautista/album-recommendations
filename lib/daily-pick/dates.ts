import { InvalidPickDateError } from './errors'

export function validatePickDate(pickDate: string): void {
  if (pickDate.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(pickDate)) {
    throw new InvalidPickDateError(pickDate)
  }

  const date = new Date(`${pickDate}T00:00:00.000Z`)

  // PostgreSQL has no year zero; the UTC round trip rejects normalized dates.
  if (
    pickDate.startsWith('0000') ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== pickDate
  ) {
    throw new InvalidPickDateError(pickDate)
  }
}

// Callers only advance validated dates that precede another valid calendar date.
export function nextPickDate(pickDate: string): string {
  const date = new Date(`${pickDate}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}
