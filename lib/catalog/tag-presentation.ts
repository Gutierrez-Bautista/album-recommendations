export const TAG_CATEGORY_ORDER = [
  'genre',
  'language',
  'mood',
  'context',
  'sonic_trait',
  'custom',
] as const

export const selectedColorByCategoryKey: Readonly<Record<string, string>> = {
  genre: 'border-sky-400/50 bg-sky-400/15 text-sky-100',
  mood: 'border-amber-400/50 bg-amber-400/15 text-amber-100',
  context: 'border-teal-400/50 bg-teal-400/15 text-teal-100',
  sonic_trait: 'border-violet-400/50 bg-violet-400/15 text-violet-100',
  language: 'border-orange-400/50 bg-orange-400/15 text-orange-100',
  custom: 'border-indigo-400/50 bg-indigo-400/15 text-indigo-100',
}

export const fallbackSelectedColor = 'border-slate-400/50 bg-slate-400/15 text-slate-100'

export function getTagCategoryColor(key: string): string {
  return Object.hasOwn(selectedColorByCategoryKey, key)
    ? selectedColorByCategoryKey[key]
    : fallbackSelectedColor
}

// This is a presentation order; catalog query ordering remains unchanged.
export function sortTagCategories<T extends { key: string }>(categories: readonly T[]): T[] {
  const rankByKey = new Map<string, number>(
    TAG_CATEGORY_ORDER.map((key, index) => [key, index]),
  )

  return [...categories].sort((left, right) =>
    (rankByKey.get(left.key) ?? TAG_CATEGORY_ORDER.length) -
    (rankByKey.get(right.key) ?? TAG_CATEGORY_ORDER.length),
  )
}
