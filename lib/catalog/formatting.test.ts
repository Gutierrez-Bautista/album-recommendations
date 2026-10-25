import { describe, expect, it } from 'vitest'
import { formatAlbumDuration, formatAlbumReleaseDate } from './formatting'

describe('formatAlbumDuration', () => {
  it.each([
    [48 * 60_000, '48 min'],
    [72 * 60_000, '1 hr 12 min'],
    [60 * 60_000, '1 hr 0 min'],
    [59_999, '0 min'],
    [null, null],
  ])('formats %s without inventing a missing duration', (input, expected) => {
    expect(formatAlbumDuration(input)).toBe(expected)
  })
})

describe('formatAlbumReleaseDate', () => {
  it.each([
    ['2024', '2024'],
    ['2024-03', 'March 2024'],
    ['2024-03-15', 'March 15, 2024'],
    ['2024-02-29', 'February 29, 2024'],
    ['2023-02-29', '2023-02-29'],
    ['2024-13', '2024-13'],
    ['', 'Release date unavailable'],
  ])('preserves the available calendar precision of %s', (raw, expected) => {
    expect(formatAlbumReleaseDate(raw)).toBe(expected)
  })
})
