export function formatAlbumDuration(durationMs: number | null): string | null {
  if (durationMs === null) return null

  const totalMinutes = Math.floor(durationMs / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return hours === 0 ? `${minutes} min` : `${hours} hr ${minutes} min`
}

export function formatAlbumReleaseDate(raw: string): string {
  if (/^\d{4}$/.test(raw)) return raw
  if (!/^\d{4}-\d{2}(?:-\d{2})?$/.test(raw)) return raw || 'Release date unavailable'

  const [year, month, day] = raw.split('-').map(Number)
  const date = new Date(`${raw.length === 7 ? `${raw}-01` : raw}T00:00:00Z`)
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== (day ?? 1)
  ) return raw

  // Formatting in UTC preserves a calendar date without shifting its day.
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    ...(day === undefined ? {} : { day: 'numeric' }),
    timeZone: 'UTC',
  }).format(date)
}
