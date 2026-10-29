import { Route, Routes, useLocation } from "react-router";
import { TabNav, type TabItem } from "@/components/TabNav";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { CalendarPage } from "./pages/CalendarPage";
import { ChangesPage } from "./pages/ChangesPage";
import { IntakePage } from "./pages/IntakePage";
import { OverviewPage } from "./pages/OverviewPage";
import { SessionPage } from "./pages/SessionPage";
import { SummaryPage } from "./pages/SummaryPage";
import { WeekPage } from "./pages/WeekPage";

const tabs: readonly TabItem[] = [
  { to: "/plan", label: "Week", end: true },
  { to: "/plan/overview", label: "Overview" },
];

/**
 * T4 to T7: the Plan page with the tabs Week (default) and Overview (P68). The shell shows the page
 * title. The tabs belong to the two tab pages; the flows below them (intake, session, changes, summary,
 * calendar) are sub-pages with Back on the phone (nav-items.ts) and no tabs.
 */
export function PlanPage() {
  const { pathname } = useLocation();
  const onTab = tabs.some((tab) => tab.to === pathname.replace(/(.)\/$/, "$1"));
  return (
    <>
      {onTab ? <TabNav label="Plan" tabs={tabs} /> : null}
      <Routes>
        <Route index element={<WeekPage />} />
        <Route path="overview" element={<OverviewPage />} />
        <Route path="new" element={<IntakePage />} />
        <Route path="session/:id" element={<SessionPage />} />
        <Route path="changes" element={<ChangesPage />} />
        <Route path="summary" element={<SummaryPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
