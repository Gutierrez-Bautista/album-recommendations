'use server'

import { requireAdmin } from "@/lib/auth-guards"
import { type UpdateAlbumFields, updateFormSchema } from "./validations"
import * as z from "zod"
import { updateAlbum } from "@/lib/catalog/update-album"
import { AlbumNotFoundError, TagsNotFoundError } from "@/lib/catalog/errors"

type AlbumUpdateFieldErrors = Partial<
  Record<keyof UpdateAlbumFields, string[]>
>

export type UpdateAlbumState = {
  status: 'idle',
} | {
  status: 'error',
  message: string,
} | {
  status: 'success',
  message: string,
} | {
  status: 'validation-error',
  fieldErrors: AlbumUpdateFieldErrors
}

function manageUpdateErrors(error: unknown): UpdateAlbumState {
  if (error instanceof AlbumNotFoundError) {
    return {
      status: 'error',
      message: `Album not found. Please reload the page.`
    }
  }

  if (error instanceof TagsNotFoundError) {
    return {
      status: 'error',
      message: 'Some selected tags were not found. Please reload the page.',
    }
  }

  console.error('Unexpected album update action error', error)

  return {
    status: 'error',
    message: 'An unexpected error occurred. Try again later.'
  }
}

export async function updateAlbumAction(
  _prevState: UpdateAlbumState,
  formData: FormData
): Promise<UpdateAlbumState> {
  await requireAdmin()

  const validationResult = updateFormSchema.safeParse({
    albumId: formData.get('albumId'),
    releaseKind: formData.get('releaseKind'),
    tagIds: formData.getAll('tagIds')
  })

  if (!validationResult.success) {
    return {
      status: 'validation-error',
      fieldErrors: z.flattenError(validationResult.error).fieldErrors,
    }
  }

  try {
    await updateAlbum(validationResult.data)

    return {
      status: 'success',
      message: 'Album updated successfully.'
    }
  } catch (error) {
    return manageUpdateErrors(error)
  }
}