import db from '@/src/db';
import { tagCategories, tags } from '@/src/db/schema/'
import { sql } from 'drizzle-orm';

type TagSeed = {
  name: string,
  slug: string,
  parentSlug?: string
}

type CategorySeed = {
  key: string,
  name: string,
  description: string,
  tags: TagSeed[]
}

const seedData: CategorySeed[] = [
  {
    key: "genre",
    name: "Genre",
    description: "Musical genre or subgenre",
    tags: [
      { name: "Rock", slug: "rock" },
      { name: "Alternative rock", slug: "alternative-rock", parentSlug: "rock" },
      { name: "Progressive rock", slug: "progressive-rock", parentSlug: "rock" },
      { name: "J-rock", slug: "j-rock", parentSlug: "rock" },

      { name: "Pop", slug: "pop" },
      { name: "Indie pop", slug: "indie-pop", parentSlug: "pop" },
      { name: "Synth-pop", slug: "synth-pop", parentSlug: "pop" },
      { name: "J-pop", slug: "j-pop", parentSlug: "pop" },
      { name: "K-pop", slug: "k-pop", parentSlug: "pop" },

      { name: "Hip-hop", slug: "hip-hop" },
      { name: "Trap", slug: "trap", parentSlug: "hip-hop" },
      { name: "Boom bap", slug: "boom-bap", parentSlug: "hip-hop" },
      {
        name: "Alternative hip-hop",
        slug: "alternative-hip-hop",
        parentSlug: "hip-hop",
      },

      { name: "Electronic", slug: "electronic" },
      { name: "House", slug: "house", parentSlug: "electronic" },
      { name: "Techno", slug: "techno", parentSlug: "electronic" },
      { name: "Ambient", slug: "ambient", parentSlug: "electronic" },

      { name: "R&B", slug: "r-and-b" },
      { name: "Metal", slug: "metal" },
      { name: "Punk", slug: "punk" },
      { name: "Jazz", slug: "jazz" },
      { name: "Classical", slug: "classical" },
      { name: "Folk", slug: "folk" },
      { name: "Blues", slug: "blues" },
      { name: "Country", slug: "country" },
      { name: "Reggae", slug: "reggae" },

      { name: "Latin", slug: "latin" },
      { name: "Reggaeton", slug: "reggaeton", parentSlug: "latin" },

      { name: "Soundtrack", slug: "soundtrack" },
    ]
  },
  {
    key: "mood",
    name: "Mood",
    description: "Emotional tone or atmosphere",
    tags: [
      { name: "Energetic", slug: "energetic" },
      { name: "Calm", slug: "calm" },
      { name: "Joyful", slug: "joyful" },
      { name: "Melancholic", slug: "melancholic" },
      { name: "Dark", slug: "dark" },
      { name: "Aggressive", slug: "aggressive" },
      { name: "Dreamy", slug: "dreamy" },
      { name: "Introspective", slug: "introspective" },
      { name: "Nostalgic", slug: "nostalgic" },
    ],
  },
  {
    key: "context",
    name: "Listening context",
    description: "Activities or situations suitable for the album",
    tags: [
      { name: "Focus", slug: "focus" },
      { name: "Workout", slug: "workout" },
      { name: "Gaming", slug: "gaming" },
      { name: "Party", slug: "party" },
      { name: "Commute", slug: "commute" },
      { name: "Relaxing", slug: "relaxing" },
      { name: "Background listening", slug: "background-listening" },
      { name: "Sleep", slug: "sleep" },
      { name: "Late night", slug: "late-night" },
    ],
  },
  {
    key: "sonic_trait",
    name: "Sonic trait",
    description: "Noticeable sound, instrumentation, or production characteristics",
    tags: [
      { name: "Acoustic", slug: "acoustic" },
      { name: "Instrumental", slug: "instrumental" },
      { name: "Vocal-forward", slug: "vocal-forward" },
      { name: "Lo-fi", slug: "lo-fi" },
      { name: "Orchestral", slug: "orchestral" },
      { name: "Minimalist", slug: "minimalist" },
      { name: "Layered", slug: "layered" },
      { name: "Raw", slug: "raw" },
      { name: "Polished", slug: "polished" },
      { name: "Synth-driven", slug: "synth-driven" },
      { name: "Sample-based", slug: "sample-based" },
    ],
  },
  {
    key: "language",
    name: "Language",
    description: "Predominant language of the album",
    tags: [
      { name: "English", slug: "english" },
      { name: "Spanish", slug: "spanish" },
      { name: "Japanese", slug: "japanese" },
      { name: "Korean", slug: "korean" },
    ],
  },
  {
    key: "custom",
    name: "Custom",
    description: "Labels that don't belong to another category.",
    tags: []
  },
]

function requireMapValue(
  map: Map<string, string>,
  key: string,
  entity: string,
): string {
  const value = map.get(key);

  if (!value) {
    throw new Error(`${entity} not found: ${key}`);
  }

  return value;
}

async function seedCategories() {
  return db
    .insert(tagCategories)
    .values(
      seedData.map((category) => ({
        key: category.key,
        name: category.name,
        description: category.description,
      })),
    )
    .onConflictDoUpdate({
      target: tagCategories.key,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
      },
    })
    .returning({
      id: tagCategories.id,
      key: tagCategories.key,
    });
}

async function seedTags(
  categoryIds: Map<string, string>,
): Promise<number> {
  /*
   * Los tags raíz deben insertarse primero porque sus IDs son necesarios
   * para asignar parentId a los subgéneros.
   */
  const rootValues = seedData.flatMap((category) => {
    const categoryId = requireMapValue(
      categoryIds,
      category.key,
      "Tag category",
    );

    return category.tags
      .filter((tag) => !tag.parentSlug)
      .map((tag) => ({
        categoryId,
        name: tag.name,
        slug: tag.slug,
        parentId: null,
      }));
  });

  const rootTags = await db
    .insert(tags)
    .values(rootValues)
    .onConflictDoUpdate({
      target: [tags.categoryId, tags.slug],
      set: {
        name: sql`excluded.name`,
        parentId: null,
      },
    })
    .returning({
      id: tags.id,
      categoryId: tags.categoryId,
      slug: tags.slug,
    });

  const rootTagIds = new Map(
    rootTags.map((tag) => [
      `${tag.categoryId}:${tag.slug}`,
      tag.id,
    ]),
  );

  const childValues = seedData.flatMap((category) => {
    const categoryId = requireMapValue(
      categoryIds,
      category.key,
      "Tag category",
    );

    return category.tags
      .filter(
        (tag): tag is TagSeed & { parentSlug: string } =>
          tag.parentSlug !== undefined,
      )
      .map((tag) => ({
        categoryId,
        name: tag.name,
        slug: tag.slug,
        parentId: requireMapValue(
          rootTagIds,
          `${categoryId}:${tag.parentSlug}`,
          "Parent tag",
        ),
      }));
  });

  if (childValues.length === 0) {
    return rootTags.length;
  }

  const childTags = await db
    .insert(tags)
    .values(childValues)
    .onConflictDoUpdate({
      target: [tags.categoryId, tags.slug],
      set: {
        name: sql`excluded.name`,
        parentId: sql`excluded.parent_id`,
      },
    })
    .returning({
      id: tags.id,
    });

  return rootTags.length + childTags.length;
}

async function main() {
  console.log("Starting database seed...");

  const categories = await seedCategories();

  const categoryIds = new Map(
    categories.map((category) => [
      category.key,
      category.id,
    ]),
  );

  const tagCount = await seedTags(categoryIds);

  console.log(`Seeded ${categories.length} tag categories.`);
  console.log(`Seeded ${tagCount} tags.`);
  console.log("Database seed completed.");
}

main().catch((error: unknown) => {
  console.error("Database seed failed:", error);
  process.exitCode = 1;
});