import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  tagCategories,
  tags,
} from '@/src/db/schema'

const {
  selectMock,
  categoryFromMock,
  categoryOrderByMock,
  tagFromMock,
  tagOrderByMock,
} = vi.hoisted(() => ({
  selectMock: vi.fn(),
  categoryFromMock: vi.fn(),
  categoryOrderByMock: vi.fn(),
  tagFromMock: vi.fn(),
  tagOrderByMock: vi.fn(),
}))

vi.mock('@/src/db', () => ({
  default: {
    select: selectMock,
  },
}))

import {
  getTagCategoriesWithTags,
} from './tags'

const persistedCategories = [
  {
    id: 'custom-category-id',
    key: 'custom',
    name: 'Custom',
    description: 'Custom labels',
  },
  {
    id: 'genre-category-id',
    key: 'genre',
    name: 'Genre',
    description: 'Musical genre or subgenre',
  },
  {
    id: 'mood-category-id',
    key: 'mood',
    name: 'Mood',
    description: 'Emotional tone or atmosphere',
  },
]

const persistedTags = [
  {
    id: 'alternative-rock-tag-id',
    categoryId: 'genre-category-id',
    parentId: 'rock-tag-id',
    name: 'Alternative rock',
    slug: 'alternative-rock',
  },
  {
    id: 'energetic-tag-id',
    categoryId: 'mood-category-id',
    parentId: null,
    name: 'Energetic',
    slug: 'energetic',
  },
  {
    id: 'rock-tag-id',
    categoryId: 'genre-category-id',
    parentId: null,
    name: 'Rock',
    slug: 'rock',
  },
]

describe('getTagCategoriesWithTags', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    categoryOrderByMock.mockResolvedValue(
      persistedCategories,
    )
    categoryFromMock.mockReturnValue({
      orderBy: categoryOrderByMock,
    })

    tagOrderByMock.mockResolvedValue(
      persistedTags,
    )
    tagFromMock.mockReturnValue({
      orderBy: tagOrderByMock,
    })

    selectMock
      .mockReturnValueOnce({
        from: categoryFromMock,
      })
      .mockReturnValueOnce({
        from: tagFromMock,
      })
  })

  it('groups tags under their categories', async () => {
    await expect(
      getTagCategoriesWithTags(),
    ).resolves.toEqual([
      {
        ...persistedCategories[0],
        tags: [],
      },
      {
        ...persistedCategories[1],
        tags: [
          {
            id: 'alternative-rock-tag-id',
            parentId: 'rock-tag-id',
            name: 'Alternative rock',
            slug: 'alternative-rock',
          },
          {
            id: 'rock-tag-id',
            parentId: null,
            name: 'Rock',
            slug: 'rock',
          },
        ],
      },
      {
        ...persistedCategories[2],
        tags: [
          {
            id: 'energetic-tag-id',
            parentId: null,
            name: 'Energetic',
            slug: 'energetic',
          },
        ],
      },
    ])
  })

  it('queries categories and tags with deterministic ordering', async () => {
    await getTagCategoriesWithTags()

    expect(selectMock).toHaveBeenNthCalledWith(1, {
      id: tagCategories.id,
      key: tagCategories.key,
      name: tagCategories.name,
      description: tagCategories.description,
    })
    expect(categoryFromMock).toHaveBeenCalledWith(
      tagCategories,
    )
    expect(
      categoryOrderByMock,
    ).toHaveBeenCalledWith(
      tagCategories.name,
    )

    expect(selectMock).toHaveBeenNthCalledWith(2, {
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      parentId: tags.parentId,
      categoryId: tags.categoryId,
    })
    expect(tagFromMock).toHaveBeenCalledWith(tags)
    expect(tagOrderByMock).toHaveBeenCalledWith(
      tags.name,
    )
  })

  it('returns every category with an empty tags array when no tags exist', async () => {
    tagOrderByMock.mockResolvedValue([])

    const result =
      await getTagCategoriesWithTags()

    expect(result).toEqual(
      persistedCategories.map((category) => ({
        ...category,
        tags: [],
      })),
    )
  })

  it('returns an empty array when no categories exist', async () => {
    categoryOrderByMock.mockResolvedValue([])

    await expect(
      getTagCategoriesWithTags(),
    ).resolves.toEqual([])
  })
})