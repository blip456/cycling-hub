import { Route, Routes, useLocation } from "react-router";
import { TabNav, type TabItem } from "@/components/TabNav";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { GoalPage } from "./GoalPage";
import { LogTab } from "./LogTab";
import { TrendTab } from "./TrendTab";

// owned by weight stream: this folder (src/features/weight/) is yours, including the data hooks and the
// reminder card (WeightReminder.tsx). The route /weight/* and the menu item are already wired.

const tabs: readonly TabItem[] = [
  { to: "/weight", label: "Log", end: true },
  { to: "/weight/trend", label: "Trend" },
];

/** W1 to W5: the Weight page with the tabs Log and Trend (P48). The shell shows the page title. */
export function WeightPage() {
  const { pathname } = useLocation();
  // The weight goal (R2c) is a sub-page with Back on the phone and no tabs.
  const onTab = tabs.some((tab) => tab.to === pathname.replace(/(.)\/$/, "$1"));
  return (
    <>
      {onTab ? <TabNav label="Weight" tabs={tabs} /> : null}
      <Routes>
        <Route index element={<LogTab />} />
        <Route path="trend" element={<TrendTab />} />
        <Route path="goal" element={<GoalPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
