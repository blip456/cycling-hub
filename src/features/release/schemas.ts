import { z } from "zod";

/** Shapes of the JSON that scripts/build-release-data.mjs writes (checked in its tests). */
export const changeTypeSchema = z.enum(["feature", "fix", "technical"]);
export type ChangeType = z.infer<typeof changeTypeSchema>;

const releaseSchema = z.object({
  version: z.string(),
  date: z.string().nullable(),
  entries: z.array(z.object({ type: changeTypeSchema, text: z.string() })),
});
export type Release = z.infer<typeof releaseSchema>;

export const changelogFileSchema = z.object({ releases: z.array(releaseSchema) });

const roadmapItemSchema = z.object({
  version: z.string(),
  title: z.string(),
  sprint: z.number().int(),
  status: z.enum(["planned", "in progress", "shipped"]),
  tagline: z.string(),
});
export type RoadmapItem = z.infer<typeof roadmapItemSchema>;

export const roadmapFileSchema = z.object({ items: z.array(roadmapItemSchema) });
