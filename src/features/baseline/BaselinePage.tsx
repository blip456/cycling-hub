import { Route, Routes, useLocation } from "react-router";
import { TabNav, type TabItem } from "@/components/TabNav";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { BaselineTab } from "./BaselineTab";
import { HistoryTab } from "./HistoryTab";
import { ResultPage } from "./ResultPage";
import { SessionPage } from "./SessionPage";
import { SuggestionPage } from "./SuggestionPage";
import { TestWeekPage } from "./TestWeekPage";
import { UpdatePage } from "./UpdatePage";
import { ValuesPage } from "./ValuesPage";
import { ZonesTab } from "./ZonesTab";

const tabs: readonly TabItem[] = [
  { to: "/baseline", label: "Baseline", end: true },
  { to: "/baseline/zones", label: "Zones" },
  { to: "/baseline/history", label: "History" },
];

/** Z1 to Z10: Baseline with the tabs Baseline, Zones and History (P48). The shell shows the page title. */
export function BaselinePage() {
  // The tabs belong to the three tab pages; the flows below them (update, suggestion, test week) are
  // sub-pages with Back on the phone (nav-items.ts) and no tabs.
  const { pathname } = useLocation();
  const onTab = tabs.some((tab) => tab.to === pathname.replace(/(.)\/$/, "$1"));
  return (
    <>
      {onTab ? <TabNav label="Baseline" tabs={tabs} /> : null}
      <Routes>
        <Route index element={<BaselineTab />} />
        <Route path="update" element={<UpdatePage />} />
        <Route path="suggestion" element={<SuggestionPage />} />
        <Route path="values" element={<ValuesPage />} />
        <Route path="test-week" element={<TestWeekPage />} />
        <Route path="test-week/:position" element={<SessionPage />} />
        <Route path="test-week/:position/result" element={<ResultPage />} />
        <Route path="zones" element={<ZonesTab />} />
        <Route path="history" element={<HistoryTab />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
