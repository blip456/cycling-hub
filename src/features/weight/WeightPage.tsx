import { Route, Routes } from "react-router";
import { TabNav, type TabItem } from "@/components/TabNav";
import { NotFoundPage } from "@/pages/NotFoundPage";
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
  return (
    <>
      <TabNav label="Weight" tabs={tabs} />
      <Routes>
        <Route index element={<LogTab />} />
        <Route path="trend" element={<TrendTab />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
