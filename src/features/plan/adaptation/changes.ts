/**
 * What a "Plan updated" notice stores in `plan_changes.changes` (jsonb), and how it is read back. The row
 * has `reason` (the notice text), `changes` and `undone_at`; everything an Undo needs lives in `changes`.
 */
import { z } from "zod";
import type { AdaptChange, UndoPlan } from "../adapt";
import type { ChangeReason, Intake } from "../engine";
import { intakeFromJson } from "../data/mapping";

export type ChangePayload = {
  version: 1;
  /** The notice text of the card (also in the row's `reason`). */
  message: string;
  reasons: ChangeReason[];
  /** The changed sessions with before, now and why (R4). */
  changes: AdaptChange[];
  /** The plan's fingerprint after this update; an Undo is only offered while the plan still has it. */
  fingerprint: string;
  /** The inverse diff and the fingerprints for Undo; null when nothing can be undone. */
  undo: UndoPlan | null;
  /** The inputs the plan was built from before this update, put back by Undo (`weeks` since edits). */
  before: { ftp: number; intake: Intake | null; weeks?: number };
};

/** One stored update as the screens read it. */
export type PlanChange = {
  id: string;
  planId: string;
  createdAt: string;
  undoneAt: string | null;
  message: string;
  payload: ChangePayload;
};

const payloadSchema = z.object({
  version: z.literal(1),
  message: z.string(),
  reasons: z.array(z.string()),
  changes: z.array(z.custom<AdaptChange>((v) => typeof v === "object" && v !== null)),
  fingerprint: z.string(),
  undo: z
    .object({
      description: z.string(),
      diff: z.object({
        insert: z.array(z.unknown()),
        update: z.array(z.unknown()),
        delete: z.array(z.unknown()),
      }),
      restoreFingerprint: z.string().nullable(),
      undoneFingerprint: z.string(),
    })
    .nullable(),
  before: z.object({ ftp: z.number(), intake: z.unknown(), weeks: z.number().optional() }),
});

/** The payload of a row, or null when the stored JSON is not in the expected shape (the row is then left out). */
export function payloadFromJson(json: unknown): ChangePayload | null {
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) return null;
  const v = parsed.data;
  return {
    version: 1,
    message: v.message,
    reasons: v.reasons as ChangeReason[],
    changes: v.changes,
    fingerprint: v.fingerprint,
    undo: v.undo as UndoPlan | null,
    before: {
      ftp: v.before.ftp,
      intake: intakeFromJson(v.before.intake),
      ...(v.before.weeks !== undefined ? { weeks: v.before.weeks } : {}),
    },
  };
}
