import { describe, expect, it } from 'vitest'

import {
  fallbackSelectedColor,
  getTagCategoryColor,
  sortTagCategories,
  TAG_CATEGORY_ORDER,
} from './tag-presentation'

describe('tag presentation', () => {
  it.each([
    ['genre', 'border-sky-400/50 bg-sky-400/15 text-sky-100'],
    ['language', 'border-orange-400/50 bg-orange-400/15 text-orange-100'],
    ['mood', 'border-amber-400/50 bg-amber-400/15 text-amber-100'],
    ['context', 'border-teal-400/50 bg-teal-400/15 text-teal-100'],
    ['sonic_trait', 'border-violet-400/50 bg-violet-400/15 text-violet-100'],
    ['custom', 'border-indigo-400/50 bg-indigo-400/15 text-indigo-100'],
  ])('preserves the existing selected color for %s', (key, color) => {
    expect(getTagCategoryColor(key)).toBe(color)
  })

  it.each(['unknown', '', 'Genre', 'constructor', 'toString', '__proto__'])(
    'uses the fallback for the unknown key %s',
    (key) => expect(getTagCategoryColor(key)).toBe(fallbackSelectedColor),
  )

  it('orders known categories first, keeping unknown categories and tags in their received order', () => {
    const categories = [
      { key: 'unknown-b', tags: ['second', 'first'] },
      { key: 'custom', tags: [] },
      { key: 'mood', tags: ['energetic'] },
      { key: 'unknown-a', tags: [] },
      { key: 'sonic_trait', tags: [] },
      { key: 'context', tags: [] },
      { key: 'language', tags: [] },
      { key: 'genre', tags: ['rock', 'alternative'] },
    ]
    const original = [...categories]
    const sorted = sortTagCategories(categories)

    expect(sorted.map(({ key }) => key)).toEqual([
      'genre', 'language', 'mood', 'context', 'sonic_trait', 'custom', 'unknown-b', 'unknown-a',
    ])
    expect(TAG_CATEGORY_ORDER).toEqual(['genre', 'language', 'mood', 'context', 'sonic_trait', 'custom'])
    expect(sorted[0]).toBe(categories[7])
    expect(sorted[0].tags).toEqual(['rock', 'alternative'])
    expect(sorted[6].tags).toEqual(['second', 'first'])
    expect(categories).toEqual(original)
  })

  it('accepts no categories', () => {
    expect(sortTagCategories([])).toEqual([])
  })
})
