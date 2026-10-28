// Generated before dev, build, lint, typecheck and tests by scripts/build-release-data.mjs (gitignored).
import changelogJson from "./generated/changelog.json";
import roadmapJson from "./generated/roadmap.json";
import { changelogFileSchema, roadmapFileSchema, type Release, type RoadmapItem } from "./schemas";

export type { ChangeType, Release, RoadmapItem } from "./schemas";

/** What's new (G2): releases from CHANGELOG.md, newest first. Empty before the first release. */
export const changelog: Release[] = changelogFileSchema.parse(changelogJson).releases;

/** What's next (G3): the backlog sprints that have not shipped, in backlog order. */
export const roadmap: RoadmapItem[] = roadmapFileSchema.parse(roadmapJson).items;
