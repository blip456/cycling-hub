import { Route, Routes, useLocation } from "react-router";
import { TabNav, type TabItem } from "@/components/TabNav";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { SessionActionsProvider } from "./components/SessionActions";
import { TodayCard } from "./components/TodayCard";
import { usePlanData } from "./data";
import { CalendarPage } from "./pages/CalendarPage";
import { ChangesPage } from "./pages/ChangesPage";
import { IntakePage } from "./pages/IntakePage";
import { PlanMenu } from "./manage/PlanMenu";
import { OverviewPage } from "./pages/OverviewPage";
import { SessionPage } from "./pages/SessionPage";
import { SummaryPage } from "./pages/SummaryPage";
import { WeekPage } from "./pages/WeekPage";

const tabs: readonly TabItem[] = [
  { to: "/plan", label: "Week", end: true },
  { to: "/plan/overview", label: "Overview" },
];

function PlanRoutes() {
  const { pathname } = useLocation();
  const { plan } = usePlanData();
  const onTab = tabs.some((tab) => tab.to === pathname.replace(/(.)\/$/, "$1"));
  // The tabs and today's card belong to a plan: with no plan the page shows the empty state alone (T1.0, T3).
  const withPlan = onTab && plan !== null;
  return (
    <>
      {withPlan ? <TodayCard /> : null}
      {withPlan ? (
        <TabNav label="Plan" tabs={tabs} trailing={plan ? <PlanMenu plan={plan} /> : null} />
      ) : null}
      <Routes>
        <Route index element={<WeekPage />} />
        <Route path="overview" element={<OverviewPage />} />
        <Route path="new" element={<IntakePage />} />
        <Route path="edit" element={<IntakePage edit />} />
        <Route path="session/:id" element={<SessionPage />} />
        <Route path="changes" element={<ChangesPage />} />
        <Route path="summary" element={<SummaryPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}

/**
 * T4 to T8: the Plan page with the tabs Week (default) and Overview (P68), today's session card above the
 * tabs, and the session actions (mark done, move, skip, Undo) for every page below it. The shell shows the
 * page title. The flows below the tabs (intake, session, changes, summary, calendar) are sub-pages with
 * Back on the phone (nav-items.ts) and no tabs.
 */
export function PlanPage() {
  return (
    <SessionActionsProvider>
      <PlanRoutes />
    </SessionActionsProvider>
  );
}
