import { useMemo, useState } from "react";
import { Button, EmptyState } from "@/components/ui";
import { PageLoading } from "@/components/PageLoading";
import { STATUS_PRIORITY, useStatusCard } from "@/components/status/status-context";
import { isProfileEmpty } from "./api";
import { useProfile } from "./hooks";
import {
  AboutSection,
  GoalSection,
  WeekSection,
  type SaveReport,
  type SectionId,
} from "./sections";

/**
 * H1 to H3: the athlete profile (P44), edited section by section. Everything is optional and nothing
 * here blocks the rest of the app. The shell shows the page title. A failed save shows a "Not saved"
 * card at the bottom of the page (P12, P31); the values stay in the open form.
 */
export function ProfilePage() {
  const profile = useProfile();
  const [notSaved, setNotSaved] = useState<{ section: SectionId; message: string } | null>(null);

  const report = useMemo<SaveReport>(
    () => ({
      fail: (section, message) => {
        setNotSaved({ section, message });
      },
      clear: (section) => {
        setNotSaved((current) => (current?.section === section ? null : current));
      },
    }),
    [],
  );

  useStatusCard(
    "profile-not-saved",
    STATUS_PRIORITY.error,
    notSaved
      ? {
          tone: "error",
          message: (
            <>
              <span className="block font-semibold">Not saved</span>
              <span className="block">{notSaved.message}</span>
            </>
          ),
          onDismiss: () => {
            setNotSaved(null);
          },
        }
      : null,
  );

  if (profile.isPending) return <PageLoading />;

  if (profile.isError) {
    return (
      <div className="flex max-w-[560px] flex-col items-start gap-3">
        <EmptyState>The profile could not be loaded.</EmptyState>
        <Button
          variant="secondary"
          onClick={() => {
            void profile.refetch();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  const data = profile.data;

  return (
    <div className="flex max-w-[560px] flex-col gap-4 lg:max-w-[1000px]">
      {isProfileEmpty(data) ? (
        <div className="rounded-2xl bg-subtle px-4 py-3">
          <h2 className="text-[15px] font-semibold">Your profile is empty</h2>
          <p className="mt-1 text-[15px] text-muted">
            Everything here is optional. The app works without it. Add what helps.
          </p>
        </div>
      ) : null}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-4">
          <AboutSection profile={data} report={report} />
          <WeekSection profile={data} report={report} />
        </div>
        <GoalSection profile={data} report={report} />
      </div>
    </div>
  );
}
