import { releaseKindEnum } from "@/src/db/schema";
import { z } from "zod";

export const importAlbumSchema = z.object({
  spotifyInput: z
    .string()
    .trim()
    .min(1, 'Enter a Spotify album URL or ID')
    .max(500, 'Spotify album input is too long'),

  releaseKind: z.enum(releaseKindEnum.enumValues, {
    error: 'Select a valid release kind',
  }),
})

export type ImportAlbumFields = z.infer<
  typeof importAlbumSchema
>

export const previewAlbumSchema = importAlbumSchema.pick({
  spotifyInput: true
})