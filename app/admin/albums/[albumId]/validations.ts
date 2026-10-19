import { releaseKindEnum } from '@/src/db/schema'
import { z } from 'zod'

export const updateFormSchema = z.object({
  albumId: z.uuid({ error: 'invalid album ID, reload the page' }),
  releaseKind: z.enum(releaseKindEnum.enumValues, {
    error: 'select a valid release kind'
  }),
  tagIds: z.array(z.uuid({ error: 'invalid tag selection, please reload the page' }))
})

export type UpdateAlbumFields = z.infer<typeof updateFormSchema>

