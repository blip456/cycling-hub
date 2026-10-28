import { Route, Routes } from "react-router";
import { TabNav, type TabItem } from "@/components/TabNav";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { BaselineTab } from "./BaselineTab";
import { HistoryTab } from "./HistoryTab";
import { ZonesTab } from "./ZonesTab";

// owned by baseline stream: this folder (src/features/baseline/) is yours, including the data hooks. The
// route /baseline/* and the menu item are already wired. Flows below the tabs (update baseline, FTP
// suggestion, manual entry, guided test week, session, result: Z1b to Z6) get their own <Route> here and a
// sub-page entry in src/components/nav-items.ts (Back on the phone).

const tabs: readonly TabItem[] = [
  { to: "/baseline", label: "Baseline", end: true },
  { to: "/baseline/zones", label: "Zones" },
  { to: "/baseline/history", label: "History" },
];

/** Z1 to Z10: Baseline with the tabs Baseline, Zones and History (P48). The shell shows the page title. */
export function BaselinePage() {
  return (
    <>
      <TabNav label="Baseline" tabs={tabs} />
      <Routes>
        <Route index element={<BaselineTab />} />
        <Route path="zones" element={<ZonesTab />} />
        <Route path="history" element={<HistoryTab />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
