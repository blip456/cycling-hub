import { useAdaptationView } from "./hooks";
import type { Signal, SignalTone } from "../adapt";

const TONE_WORD: Record<SignalTone, string> = {
  good: "Working",
  watch: "To look at",
  neutral: "Not yet",
};

function SignalItem({ signal }: { signal: Signal }) {
  return (
    <li className="text-body">
      <span className="font-semibold">{TONE_WORD[signal.tone]}.</span> {signal.text}
    </li>
  );
}

/**
 * "How your plan is working": what the rides so far say about the plan (ride feedback). The word in front of
 * each line carries the tone, not a colour. Nothing is shown before the first evaluation of the visit.
 */
export function FeedbackCard() {
  const view = useAdaptationView();
  const signals = view?.effectiveness.signals ?? [];
  if (signals.length === 0) return null;
  return (
    <section aria-labelledby="plan-feedback" className="rounded-lg bg-surface p-4">
      <h3 id="plan-feedback" className="text-caption text-muted">
        How your plan is working
      </h3>
      <ul className="mt-2 flex flex-col gap-2">
        {signals.map((signal) => (
          <SignalItem key={`${signal.code}-${signal.kind ?? ""}`} signal={signal} />
        ))}
      </ul>
      <p className="mt-3 text-caption text-muted">
        Based on your hard sessions and full weeks so far. A hard session ridden for less than 80 %
        of its time makes that build wait one step.
      </p>
    </section>
  );
}
