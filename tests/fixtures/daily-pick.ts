import type { DailyPickDetails } from '@/lib/daily-pick/queries'

export const dailyPickFixture = {
  pickDate: '2026-10-25',
  album: {
    id: 'album-id',
    spotifyId: '1xhO0GSoezdPJcSuNe1ySv',
    name: 'Example Album',
    coverUrl: null,
    spotifyAlbumType: 'album',
    releaseKind: 'ep',
    releaseDateRaw: '2024-03-15',
    totalTracks: 12,
    durationMs: 2_880_000,
    hasSpotifyMarkedExplicitTracks: true,
    artists: [
      { id: 'first-artist', name: 'First Artist' },
      { id: 'second-artist', name: 'Second Artist' },
    ],
    tagCategories: [{
      id: 'mood-category',
      key: 'mood',
      name: 'Mood',
      description: 'Emotional tone or atmosphere',
      tags: [{ id: 'energetic', name: 'Energetic' }],
    }],
  },
} satisfies DailyPickDetails
