import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { DailyPickCountdown } from './daily-pick-countdown'

describe('DailyPickCountdown server render', () => {
  it('renders a stable placeholder without reading browser time or announcing seconds', () => {
    const onDateChange = vi.fn()
    const first = renderToStaticMarkup(createElement(DailyPickCountdown, { onDateChange }))
    const second = renderToStaticMarkup(createElement(DailyPickCountdown, { onDateChange }))

    expect(first).toBe(second)
    expect(first).toContain('Next album in')
    expect(first).toContain('--:--:--')
    expect(first).not.toContain('aria-live')
    expect(first).not.toContain('role="status"')
    expect(onDateChange).not.toHaveBeenCalled()
  })
})
