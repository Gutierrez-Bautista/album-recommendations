import { createElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { InfoPopover } from './info-popover'

function renderPopover(props: ComponentProps<typeof InfoPopover>) {
  return renderToStaticMarkup(createElement(InfoPopover, props))
}

describe('InfoPopover', () => {
  it('preserves the existing label and decorative info icon by default', () => {
    const markup = renderPopover({
      label: 'About genre',
      contentLabel: 'About genre tags',
      className: 'custom-focus-class',
      children: 'Musical genre or subgenre',
    })

    expect(markup).toContain('About genre')
    expect(markup).toContain('src="/info.svg"')
    expect(markup).toContain('aria-hidden="true"')
    expect(markup).toContain('type="button"')
    expect(markup).toContain('aria-haspopup="dialog"')
    expect(markup).toContain('custom-focus-class')
  })

  it('supports a standalone E trigger with a descriptive accessible name', () => {
    const markup = renderPopover({
      label: 'E',
      contentLabel: 'Spotify explicit indication',
      triggerLabel: 'Explicit: about Spotify explicit indication',
      showIcon: false,
      children: 'At least one track was marked explicit by Spotify.',
    })

    expect(markup).toContain('aria-label="Explicit: about Spotify explicit indication"')
    expect(markup).toContain('>E</button>')
    expect(markup).not.toContain('<img')
    expect(markup).not.toContain('/info.svg')
  })

  it('keeps tag text as the accessible name when no override is needed', () => {
    const markup = renderPopover({
      label: 'Energetic',
      contentLabel: 'Mood category',
      showIcon: false,
      children: 'Mood',
    })

    expect(markup).toContain('>Energetic</button>')
    expect(markup).not.toContain('aria-label=')
  })
})
