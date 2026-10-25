import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { DailyPickDetails } from '@/lib/daily-pick/queries'
import { dailyPickFixture } from '@/tests/fixtures/daily-pick'

// Radix portals are closed during SSR; expose their content for presentation assertions.
vi.mock('@/components/info-popover', () => ({
  InfoPopover: ({ label, triggerLabel, children, className }: {
    label: import('react').ReactNode,
    triggerLabel?: string,
    children: import('react').ReactNode,
    className?: string,
  }) => createElement('div', {},
    createElement('button', { type: 'button', 'aria-label': triggerLabel, className }, label),
    createElement('aside', {}, children),
  ),
}))

import { DailyPickAlbum } from './daily-pick-album'

function renderAlbum(overrides: Partial<DailyPickDetails['album']> = {}) {
  return renderToStaticMarkup(createElement(DailyPickAlbum, {
    album: { ...dailyPickFixture.album, ...overrides },
  }))
}

describe('DailyPickAlbum', () => {
  it('shows the album, artists in order, fallback artwork, and a safe Spotify action', () => {
    const markup = renderAlbum()
    expect(markup).toContain('Example Album')
    expect(markup).toContain('First Artist, Second Artist')
    expect(markup).toContain('/album-placeholder.svg')
    expect(markup).toContain('object-contain!')
    expect(markup).toContain('https://open.spotify.com/album/1xhO0GSoezdPJcSuNe1ySv')
    expect(markup).toContain('target="_blank" rel="noopener noreferrer"')
    expect(markup).toContain('Open in Spotify')
    expect(markup).toContain('/spotify-logo-black.svg')
    expect(markup).toContain('12 tracks')
    expect(markup).toContain('48 min')
    expect(markup).toContain('March 15, 2024')
  })

  it('only shows the manual classification when both types match', () => {
    const markup = renderAlbum({ releaseKind: 'album' })
    expect(markup).toContain('Daily Album release kind: Album')
    expect(markup).not.toContain('Spotify: Album')
    expect(markup).not.toContain('About release classifications')
  })

  it('explains independent classifications when they differ', () => {
    const markup = renderAlbum()
    expect(markup).toContain('Daily Album release kind: EP')
    expect(markup).toContain('Spotify: Album')
    expect(markup).toContain('manually curated')
    expect(markup).toContain('separate EP album type')
  })

  it('attributes the fallback classification to Spotify if manual classification is missing', () => {
    const markup = renderAlbum({ releaseKind: null, spotifyAlbumType: 'single' })
    expect(markup).toContain('Spotify: Single')
    expect(markup).not.toContain('Daily Album release kind:')
  })

  it('uses singular track and omits missing duration rather than showing zero', () => {
    const markup = renderAlbum({ totalTracks: 1, durationMs: null })
    expect(markup).toContain('1 track<')
    expect(markup).not.toContain('1 tracks')
    expect(markup).not.toContain('0 min')
    expect(markup).not.toContain('Unavailable')
  })

  it.each([true, false])('explains Spotify explicit marking when explicit=%s', (explicit) => {
    const markup = renderAlbum({ hasSpotifyMarkedExplicitTracks: explicit })
    expect(markup).toContain(explicit ? '>E</button>' : '>NE</button>')
    expect(markup).toContain(explicit ? 'At least one track was marked explicit by Spotify.' : 'No track was marked explicit by Spotify.')
    expect(markup).toContain('does not guarantee the content is suitable for every audience')
  })

  it('flattens chips in presentation order with source descriptions, stable unknowns and tag order', () => {
    const groups = [
      { key: 'unknown-first', name: 'Unknown first', description: null },
      { key: 'context', name: 'Context', description: 'Real context description' },
      { key: 'custom', name: 'Custom', description: null },
      { key: 'sonic_trait', name: 'Sonic trait', description: null },
      { key: 'genre', name: 'Genre', description: null },
      { key: 'unknown-second', name: 'Unknown second', description: null },
      { key: 'mood', name: 'Mood', description: null },
      { key: 'language', name: 'Language', description: null },
    ].map((category) => ({
      ...category, id: category.key,
      tags: [{ id: `${category.key}-1`, name: `${category.key} first chip` }, { id: `${category.key}-2`, name: `${category.key} second chip` }],
    }))
    const markup = renderAlbum({ tagCategories: groups })
    const chips = [...markup.matchAll(/>([^<>]+ chip)<\/button>/g)].map(([, name]) => name)
    expect(chips).toEqual(['genre', 'language', 'mood', 'context', 'sonic_trait', 'custom', 'unknown-first', 'unknown-second']
      .flatMap((key) => [`${key} first chip`, `${key} second chip`]))
    expect(markup).toContain('Real context description')
    expect(markup).not.toContain('>null<')
    expect(markup).not.toContain('type="checkbox"')
    expect(markup).not.toContain('✓')
    expect(markup).not.toContain('<h4')
    expect(markup).toContain('flex flex-wrap gap-2')
    expect(markup).toContain('border-slate-400/50 bg-slate-400/15 text-slate-100')
    expect(markup).toContain('border-sky-400/50 bg-sky-400/15 text-sky-100')
  })

  it('does not render chips for categories without tags', () => {
    const markup = renderAlbum({ tagCategories: [{ ...dailyPickFixture.album.tagCategories[0], tags: [] }] })
    expect(markup).toContain('No tags for this album yet.')
    expect(markup).not.toContain('About Mood tags')
  })
})
