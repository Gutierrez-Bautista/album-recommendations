import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { actionStateMock } = vi.hoisted(() => ({ actionStateMock: vi.fn() }))

vi.mock('react', async (importOriginal: () => Promise<typeof import('react')>) => {
  const actual = await importOriginal()
  return { ...actual, useActionState: actionStateMock }
})

vi.mock('./actions', () => ({
  updateAlbumAction: async () => ({ status: 'idle' }),
}))
vi.mock('@/components/info-popover', () => ({
  InfoPopover: ({ children }: { children: string }) => children,
}))

import AlbumEditForm, { hasUnsavedAlbumChanges } from './album-edit-form'

const genreTagIds = Array.from({ length: 29 }, (_, index) =>
  `550e8400-e29b-41d4-a716-${index.toString(16).padStart(12, '0')}`,
)
const moodTagId = '3d813cbb-47fb-4cfe-b7c6-3b466b873f20'

const categories = [
  {
    id: 'genre-category-id',
    key: 'genre',
    name: 'Genre',
    description: 'Musical genre or subgenre',
    tags: genreTagIds.map((id, index) => ({
      id,
      name: `Genre ${index + 1}`,
      slug: `genre-${index + 1}`,
      parentId: null,
    })),
  },
  {
    id: 'mood-category-id',
    key: 'mood',
    name: 'Mood',
    description: 'Emotional tone or atmosphere',
    tags: [{ id: moodTagId, name: 'Energetic', slug: 'energetic', parentId: null }],
  },
  {
    id: 'custom-category-id',
    key: 'custom',
    name: 'Custom',
    description: null,
    tags: [],
  },
]

function renderForm(
  initialReleaseKind: 'ep' | null,
  initialTagIds: string[],
  formCategories = categories,
) {
  return renderToStaticMarkup(createElement(AlbumEditForm, {
    albumId: '21d1ec88-21bb-42e9-a1e3-3c0f8ea3e2e1',
    initialReleaseKind,
    initialTagIds,
    categories: formCategories,
  }))
}

function tagInputs(markup: string) {
  return [...markup.matchAll(/<input[^>]*type="checkbox"[^>]*>/g)].map(([input]) => input)
}

beforeEach(() => {
  actionStateMock.mockReturnValue([{ status: 'idle' }, () => undefined, false])
})

describe('AlbumEditForm', () => {
  it('shows all available pills, hides empty categories, and checks current selections', () => {
    const markup = renderForm('ep', [genreTagIds[0], moodTagId])
    const inputs = tagInputs(markup)

    expect(markup).toContain('Genre')
    expect(markup).toContain('Mood')
    expect(markup).not.toContain('Custom')
    expect(markup).not.toContain('No tags in this category yet.')
    expect(markup).toContain('Musical genre or subgenre')
    expect(markup).toContain('Emotional tone or atmosphere')
    expect(markup).toContain('flex flex-wrap gap-2')
    expect(markup).toContain('Genre 29')
    expect(markup).toContain('<option value="ep" selected="">EP</option>')
    expect(inputs).toHaveLength(30)
    expect(inputs.find((input) => input.includes(`value="${genreTagIds[0]}"`))).toContain('checked=""')
    expect(inputs.find((input) => input.includes(`value="${moodTagId}"`))).toContain('checked=""')
    expect(inputs.find((input) => input.includes(`value="${genreTagIds[1]}"`))).not.toContain('checked=""')
    expect(inputs.every((input) => input.includes('name="tagIds"'))).toBe(true)
    expect(markup).toContain('peer-focus-visible:outline-2')
    expect(markup).toContain('sticky bottom-0')
    expect(markup).toContain('env(safe-area-inset-bottom)')
  })

  it('starts with no selected tags and requires a choice for an unclassified album', () => {
    const markup = renderForm(null, [])

    expect(tagInputs(markup).every((input) => !input.includes('checked=""'))).toBe(true)
    expect(markup).toContain('<option value="" disabled="" selected="">Select a release kind</option>')
    expect(markup).toContain('You can leave every tag unselected.')
    expect(markup).toContain('No changes to save')
    expect(markup).toContain('type="submit" disabled=""')
  })

  it('shows an empty state if no category has available tags', () => {
    const markup = renderForm('ep', [], [categories[2]])

    expect(markup).toContain('No tags are available.')
    expect(markup).not.toContain('Custom')
    expect(tagInputs(markup)).toHaveLength(0)
  })

  it('shows field errors next to the affected controls', () => {
    actionStateMock.mockReturnValueOnce([{
      status: 'validation-error',
      fieldErrors: {
        releaseKind: ['Select a valid release kind'],
        tagIds: ['Invalid tag selection'],
      },
    }, () => undefined, false])

    const markup = renderForm('ep', [])

    expect(markup).toContain('id="releaseKind-error" role="alert"')
    expect(markup).toContain('id="tagIds-error" role="alert"')
    expect(markup).toContain('aria-describedby="tagIds-error"')
  })

  it('disables submission and controls while saving', () => {
    actionStateMock.mockReturnValueOnce([{ status: 'idle' }, () => undefined, true])

    const markup = renderForm('ep', [])

    expect(markup).toContain('Saving…')
    expect(markup).toContain('name="releaseKind" disabled=""')
    expect(tagInputs(markup).every((input) => input.includes('disabled=""'))).toBe(true)
    expect(markup).toContain('type="submit" disabled=""')
  })

  it('announces successful updates', () => {
    actionStateMock.mockReturnValueOnce([{
      status: 'success',
      message: 'Album updated successfully.',
    }, () => undefined, false])

    const markup = renderForm('ep', [])

    expect(markup).toContain('role="status"')
    expect(markup).toContain('Album updated successfully.')
  })
})

describe('hasUnsavedAlbumChanges', () => {
  const saved = {
    releaseKind: 'ep',
    tagIds: new Set([genreTagIds[0], moodTagId]),
  }

  it('ignores tag order and recognizes a reverted selection', () => {
    expect(hasUnsavedAlbumChanges({
      releaseKind: 'ep',
      tagIds: new Set([moodTagId, genreTagIds[0]]),
    }, saved)).toBe(false)
  })

  it('detects a release kind change, added tag, or removal of every tag', () => {
    expect(hasUnsavedAlbumChanges({
      releaseKind: 'album',
      tagIds: saved.tagIds,
    }, saved)).toBe(true)
    expect(hasUnsavedAlbumChanges({
      releaseKind: 'ep',
      tagIds: new Set([...saved.tagIds, genreTagIds[1]]),
    }, saved)).toBe(true)
    expect(hasUnsavedAlbumChanges({
      releaseKind: 'ep',
      tagIds: new Set(),
    }, saved)).toBe(true)
  })
})
