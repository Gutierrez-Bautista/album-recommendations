import { EmptyActiveCatalogError } from "./errors"

export interface DailyPickSelectionInput {
  readonly activeAlbumIds: readonly string[]
  readonly latestCycle: number | null
  readonly selectedAlbumIdsInLatestCycle: readonly string[]
  readonly recentAlbumIdsOldestFirst: readonly string[]
  /** Returns a uniformly distributed number in [0, 1). */
  readonly random?: () => number
}

export interface DailyPickSelection {
  albumId: string
  cycle: number
}

function selectUniformly(
  candidates: readonly string[],
  random: () => number,
): string {
  const value = random()

  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError('random must return a number in [0, 1)')
  }

  return candidates[Math.floor(value * candidates.length)]
}

export function selectDailyPick({
  activeAlbumIds,
  latestCycle,
  selectedAlbumIdsInLatestCycle,
  recentAlbumIdsOldestFirst,
  random = Math.random,
}: DailyPickSelectionInput): DailyPickSelection {
  // Duplicate IDs must not give an album extra chances in the random draw.
  const activeIds = [...new Set(activeAlbumIds)]

  if (activeIds.length === 0) {
    throw new EmptyActiveCatalogError()
  }

  if (
    latestCycle !== null &&
    (!Number.isSafeInteger(latestCycle) || latestCycle < 1)
  ) {
    throw new RangeError('latestCycle must be a positive integer or null')
  }

  const selectedInCycle = new Set(selectedAlbumIdsInLatestCycle)
  const remainingInCycle = activeIds.filter((id) => !selectedInCycle.has(id))
  const startNewCycle = latestCycle === null || remainingInCycle.length === 0
  const cycle = latestCycle === null ? 1 : startNewCycle ? latestCycle + 1 : latestCycle
  const cycleCandidates = startNewCycle ? activeIds : remainingInCycle

  // Remove the oldest day from the exclusion window only when no candidate remains.
  let eligibleCandidates: string[] = []
  for (
    let firstExcludedDay = 0;
    firstExcludedDay <= recentAlbumIdsOldestFirst.length;
    firstExcludedDay++
  ) {
    const recentlySelected = new Set(recentAlbumIdsOldestFirst.slice(firstExcludedDay))
    eligibleCandidates = cycleCandidates.filter((id) => !recentlySelected.has(id))

    if (eligibleCandidates.length > 0) {
      break
    }
  }

  return {
    albumId: selectUniformly(eligibleCandidates, random),
    cycle,
  }
}
