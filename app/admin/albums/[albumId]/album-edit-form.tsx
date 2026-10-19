'use client'

import { InfoPopover } from '@/components/info-popover'
import type { getTagCategoriesWithTags } from '@/lib/catalog/queries/tags'
import { useActionState, useEffect, useRef, useState } from 'react'
import { updateAlbumAction, type UpdateAlbumState } from './actions'
import type { UpdateAlbumFields } from './validations'

type TagCategory = Awaited<ReturnType<typeof getTagCategoriesWithTags>>[number]

type Props = {
  albumId: string
  initialReleaseKind: UpdateAlbumFields['releaseKind'] | null
  initialTagIds: string[]
  categories: TagCategory[]
}

const initialState: UpdateAlbumState = { status: 'idle' }

const selectedColorByCategoryKey: Record<string, string> = {
  genre: 'border-sky-400/50 bg-sky-400/15 text-sky-100',
  mood: 'border-amber-400/50 bg-amber-400/15 text-amber-100',
  context: 'border-teal-400/50 bg-teal-400/15 text-teal-100',
  sonic_trait: 'border-violet-400/50 bg-violet-400/15 text-violet-100',
  language: 'border-orange-400/50 bg-orange-400/15 text-orange-100',
  custom: 'border-indigo-400/50 bg-indigo-400/15 text-indigo-100',
}

const fallbackSelectedColor = 'border-slate-400/50 bg-slate-400/15 text-slate-100'

type Selection = {
  releaseKind: string
  tagIds: ReadonlySet<string>
}

export function hasUnsavedAlbumChanges(current: Selection, saved: Selection): boolean {
  return current.releaseKind !== saved.releaseKind ||
    current.tagIds.size !== saved.tagIds.size ||
    [...current.tagIds].some((tagId) => !saved.tagIds.has(tagId))
}

export default function AlbumEditForm({
  albumId,
  initialReleaseKind,
  initialTagIds,
  categories,
}: Props) {
  const [releaseKind, setReleaseKind] = useState(initialReleaseKind ?? '')
  const [selectedTagIds, setSelectedTagIds] = useState(() => new Set(initialTagIds))
  const [savedSelection, setSavedSelection] = useState<Selection>(() => ({
    releaseKind: initialReleaseKind ?? '',
    tagIds: new Set(initialTagIds),
  }))
  const submittedSelection = useRef<Selection | null>(null)
  const [state, action, isPending] = useActionState(updateAlbumAction, initialState)
  const hasUnsavedChanges = hasUnsavedAlbumChanges(
    { releaseKind, tagIds: selectedTagIds },
    savedSelection,
  )
  const visibleCategories = categories.filter((category) => category.tags.length > 0)

  useEffect(() => {
    if (state.status === 'idle') return

    if (state.status === 'success' && submittedSelection.current) {
      setSavedSelection(submittedSelection.current)
    }
    submittedSelection.current = null
  }, [state])

  const fieldErrors = state.status === 'validation-error' ? state.fieldErrors : {}
  const releaseKindError = fieldErrors.releaseKind?.[0]
  const tagIdsError = fieldErrors.tagIds?.[0]
  const albumIdError = fieldErrors.albumId?.[0]

  function setTagSelected(tagId: string, checked: boolean) {
    setSelectedTagIds((previous) => {
      const next = new Set(previous)
      if (checked) next.add(tagId)
      else next.delete(tagId)
      return next
    })
  }

  return (
    <form
      action={action}
      onSubmit={() => {
        submittedSelection.current = { releaseKind, tagIds: new Set(selectedTagIds) }
      }}
      className="mt-6"
    >
      <input type="hidden" name="albumId" value={albumId} />

      <div>
        <div className="flex items-center gap-2">
          <label htmlFor="releaseKind" className="font-medium">Release kind</label>
          <InfoPopover
            label={<span className="sr-only">About release kind</span>}
            contentLabel="About release kind"
            className="scroll-mb-40 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            This is Daily Album&apos;s manually chosen classification. Spotify&apos;s album type is separate and does not determine whether this release is an EP.
          </InfoPopover>
        </div>
        <select
          id="releaseKind"
          name="releaseKind"
          value={releaseKind}
          onChange={(event) => setReleaseKind(event.currentTarget.value)}
          disabled={isPending}
          required
          aria-invalid={Boolean(releaseKindError)}
          aria-describedby={releaseKindError ? 'releaseKind-error' : undefined}
          className="mt-2 w-full scroll-mb-40 rounded-md border border-white/10 bg-zinc-700 px-3 py-2 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--app-primary-light) disabled:opacity-60"
        >
          <option value="" disabled>Select a release kind</option>
          <option value="album">Album</option>
          <option value="single">Single</option>
          <option value="ep">EP</option>
          <option value="compilation">Compilation</option>
        </select>
        {releaseKindError && <p id="releaseKind-error" role="alert" className="mt-2 text-sm text-red-400">{releaseKindError}</p>}
      </div>

      <div className="mt-8 border-t border-white/10 pt-6">
        <h3 className="text-lg font-semibold">Tags</h3>
        <p className="mt-1 text-sm text-zinc-400">Select any tags that apply. You can leave every tag unselected.</p>

        {visibleCategories.length === 0 && (
          <p className="mt-5 text-sm text-zinc-400">No tags are available.</p>
        )}

        <div className="mt-5 space-y-6">
          {visibleCategories.map((category) => {
            const selectedColor = selectedColorByCategoryKey[category.key] ?? fallbackSelectedColor

            return (
              <fieldset key={category.id} className="min-w-0">
                <legend className="w-full text-base font-semibold">
                  <span className="inline-flex items-center gap-2">
                    {category.name}
                    {category.description && (
                      <InfoPopover
                        label={<span className="sr-only">About {category.name}</span>}
                        contentLabel={`About ${category.name} tags`}
                        className="scroll-mb-40 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                      >
                        {category.description}
                      </InfoPopover>
                    )}
                  </span>
                </legend>

                <div className="mt-3 flex flex-wrap gap-2">
                  {category.tags.map((tag) => {
                    const selected = selectedTagIds.has(tag.id)

                    return (
                      <label key={tag.id} className="relative max-w-full cursor-pointer">
                        <input
                          type="checkbox"
                          name="tagIds"
                          value={tag.id}
                          checked={selected}
                          onChange={(event) => setTagSelected(tag.id, event.currentTarget.checked)}
                          disabled={isPending}
                          aria-invalid={Boolean(tagIdsError)}
                          aria-describedby={tagIdsError ? 'tagIds-error' : undefined}
                          className="peer sr-only scroll-mb-40"
                        />
                        <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors wrap-anywhere peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-white peer-disabled:opacity-60 ${selected ? selectedColor : 'border-white/15 bg-zinc-900 text-zinc-200 hover:border-white/30 hover:bg-zinc-700'}`}>
                          {selected && <span aria-hidden="true" className="text-base leading-none">✓</span>}
                          {tag.name}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>
            )
          })}
        </div>

        {tagIdsError && <p id="tagIds-error" role="alert" className="mt-4 text-sm text-red-400">{tagIdsError}</p>}
      </div>

      <footer className="sticky bottom-0 z-10 mt-8 rounded-lg border border-white/10 bg-zinc-900/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-lg backdrop-blur-sm">
        {albumIdError && <p role="alert" className="mb-3 text-sm text-red-400">{albumIdError}</p>}
        {state.status === 'error' && <p role="alert" className="mb-3 text-sm text-red-400">{state.message}</p>}
        {state.status === 'success' && !isPending && !hasUnsavedChanges && (
          <p role="status" className="mb-3 text-sm text-emerald-300">{state.message}</p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p aria-live="polite" className="flex items-center gap-2 text-sm text-zinc-400">
            {hasUnsavedChanges && <span aria-hidden="true" className="size-1.5 rounded-full bg-amber-300" />}
            {hasUnsavedChanges ? 'Unsaved changes' : 'No changes to save'}
          </p>
          <button
            type="submit"
            disabled={isPending || !hasUnsavedChanges}
            className="w-full rounded-full bg-(--app-primary) px-6 py-2.5 font-semibold text-white transition hover:bg-(--app-primary-hover) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--app-primary-light) disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto cursor-pointer"
          >
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </footer>
    </form>
  )
}
