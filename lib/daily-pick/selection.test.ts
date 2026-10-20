import { describe, expect, it, vi } from 'vitest'

import {
  selectDailyPick,
  type DailyPickSelectionInput,
} from './selection'
import { EmptyActiveCatalogError } from './errors'

function input(overrides: Partial<DailyPickSelectionInput> = {}): DailyPickSelectionInput {
  return {
    activeAlbumIds: ['a', 'b', 'c'],
    latestCycle: null,
    selectedAlbumIdsInLatestCycle: [],
    recentAlbumIdsOldestFirst: [],
    random: () => 0,
    ...overrides,
  }
}

describe('selectDailyPick', () => {
  it('starts cycle 1 when no recommendations exist', () => {
    expect(selectDailyPick(input({ random: () => 0.5 }))).toEqual({
      albumId: 'b',
      cycle: 1,
    })
  })

  it('continues an incomplete cycle', () => {
    expect(selectDailyPick(input({
      latestCycle: 2,
      selectedAlbumIdsInLatestCycle: ['a'],
    }))).toEqual({ albumId: 'b', cycle: 2 })
  })

  it('starts the next cycle after all active albums have been selected', () => {
    expect(selectDailyPick(input({
      latestCycle: 2,
      selectedAlbumIdsInLatestCycle: ['a', 'b', 'c'],
    }))).toEqual({ albumId: 'a', cycle: 3 })
  })

  it('never repeats an album within a cycle, even when it is the only recent candidate', () => {
    expect(selectDailyPick(input({
      latestCycle: 4,
      selectedAlbumIdsInLatestCycle: ['a', 'b'],
      recentAlbumIdsOldestFirst: ['c'],
    }))).toEqual({ albumId: 'c', cycle: 4 })
  })

  it('avoids the previous five recommendations when another album is available', () => {
    expect(selectDailyPick(input({
      activeAlbumIds: ['a', 'b', 'c', 'd', 'e', 'f'],
      recentAlbumIdsOldestFirst: ['a', 'b', 'c', 'd', 'e'],
    }))).toEqual({ albumId: 'f', cycle: 1 })
  })

  it('relaxes the oldest recent day first and stops when a candidate appears', () => {
    expect(selectDailyPick(input({
      recentAlbumIdsOldestFirst: ['a', 'b', 'c'],
      random: () => 0.99,
    }))).toEqual({ albumId: 'a', cycle: 1 })
  })

  it('applies recent exclusions when starting a new cycle', () => {
    expect(selectDailyPick(input({
      activeAlbumIds: ['a', 'b', 'c'],
      latestCycle: 3,
      selectedAlbumIdsInLatestCycle: ['a', 'b', 'c'],
      recentAlbumIdsOldestFirst: ['a', 'b'],
    }))).toEqual({
      albumId: 'c',
      cycle: 4,
    })
  })

  it('recommends the sole active album again in a new cycle', () => {
    expect(selectDailyPick(input({
      activeAlbumIds: ['a'],
      latestCycle: 1,
      selectedAlbumIdsInLatestCycle: ['a'],
      recentAlbumIdsOldestFirst: ['a'],
    }))).toEqual({ albumId: 'a', cycle: 2 })
  })

  it('ignores archived albums excluded from the active catalog', () => {
    expect(selectDailyPick(input({
      activeAlbumIds: ['c'],
      latestCycle: 3,
      selectedAlbumIdsInLatestCycle: ['a', 'b'],
    }))).toEqual({
      albumId: 'c',
      cycle: 3,
    })
  })

  it('handles a catalog smaller than five days, keeping the most recent occurrence excluded', () => {
    expect(selectDailyPick(input({
      activeAlbumIds: ['a', 'b'],
      recentAlbumIdsOldestFirst: ['a', 'b', 'a', 'b', 'a'],
    }))).toEqual({ albumId: 'b', cycle: 1 })
  })

  it('selects a newly added or restored album in the current cycle', () => {
    expect(selectDailyPick(input({
      latestCycle: 7,
      selectedAlbumIdsInLatestCycle: ['a', 'b'],
      recentAlbumIdsOldestFirst: ['a', 'b'],
    }))).toEqual({ albumId: 'c', cycle: 7 })
  })

  it('throws a domain error for an empty active catalog', () => {
    expect(() => selectDailyPick(input({ activeAlbumIds: [] })))
      .toThrow(EmptyActiveCatalogError)
  })

  it.each([
    { value: 0, albumId: 'a' },
    { value: 1 / 3, albumId: 'b' },
    { value: 2 / 3, albumId: 'c' },
    { value: 0.999, albumId: 'c' },
  ])('maps injected random value $value to candidate $albumId', ({ value, albumId }) => {
    const random = vi.fn(() => value)

    expect(selectDailyPick(input({ random }))).toEqual({ albumId, cycle: 1 })
    expect(random).toHaveBeenCalledOnce()
  })

  it('does not give duplicate active IDs extra weight', () => {
    expect(selectDailyPick(input({
      activeAlbumIds: ['a', 'a', 'b'],
      random: () => 0.5,
    }))).toEqual({ albumId: 'b', cycle: 1 })
  })

  it('does not mutate any input arrays', () => {
    const activeAlbumIds = Object.freeze(['a', 'b'])
    const selectedAlbumIdsInLatestCycle = Object.freeze(['a'])
    const recentAlbumIdsOldestFirst = Object.freeze(['b'])

    expect(selectDailyPick(input({
      activeAlbumIds,
      latestCycle: 1,
      selectedAlbumIdsInLatestCycle,
      recentAlbumIdsOldestFirst,
    }))).toEqual({ albumId: 'b', cycle: 1 })

    expect(activeAlbumIds).toEqual(['a', 'b'])
    expect(selectedAlbumIdsInLatestCycle).toEqual(['a'])
    expect(recentAlbumIdsOldestFirst).toEqual(['b'])
  })

  it('rejects an invalid cycle or random value', () => {
    expect(() => selectDailyPick(input({ latestCycle: 0 }))).toThrow(RangeError)
    expect(() => selectDailyPick(input({ random: () => 1 }))).toThrow(RangeError)
  })
})
