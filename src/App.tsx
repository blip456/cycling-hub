import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router";
import { AppShell } from "@/components/AppShell";
import { PageLoading } from "@/components/PageLoading";
import { useAuth } from "@/lib/auth/auth-context";
import { RedirectIfSignedIn, RequireAuth } from "@/lib/auth/guards";
import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/auth/ResetPasswordPage";
import { SignInPage } from "@/pages/auth/SignInPage";
import { ConfigErrorPage } from "@/pages/ConfigErrorPage";
import { ImportDetailPage } from "@/pages/ImportDetailPage";
import { ImportHistoryPage } from "@/pages/ImportHistoryPage";
import { ImportPage } from "@/pages/ImportPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { RideDetailPage } from "@/pages/RideDetailPage";
import { RidesPage } from "@/pages/RidesPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { WhatsNewPage } from "@/pages/WhatsNewPage";
import { WhatsNextPage } from "@/pages/WhatsNextPage";

// Sprint 3 pages are loaded on demand, so the first load stays small. Each stream owns its folder and
// its page component; the routes below end in /* so each page handles its own sub-routes.
const WeightPage = lazy(() =>
  import("@/features/weight/WeightPage").then((m) => ({ default: m.WeightPage })),
);
const ProfilePage = lazy(() =>
  import("@/features/profile/ProfilePage").then((m) => ({ default: m.ProfilePage })),
);
const BaselinePage = lazy(() =>
  import("@/features/baseline/BaselinePage").then((m) => ({ default: m.BaselinePage })),
);

/** All routes. There is deliberately no sign-up route (A1). */
export function App() {
  const { status, configError } = useAuth();
  if (status === "misconfigured")
    return <ConfigErrorPage message={configError ?? "Supabase is not configured."} />;

  return (
    <Routes>
      <Route
        path="/sign-in"
        element={
          <RedirectIfSignedIn>
            <SignInPage />
          </RedirectIfSignedIn>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <RedirectIfSignedIn>
            <ForgotPasswordPage />
          </RedirectIfSignedIn>
        }
      />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/rides" replace />} />
        <Route path="/rides" element={<RidesPage />} />
        <Route path="/rides/:id" element={<RideDetailPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/import/history" element={<ImportHistoryPage />} />
        <Route path="/import/history/:id" element={<ImportDetailPage />} />
        {/* Sprint 3: lazy pages; the streams do not edit these lines (P48). */}
        <Route
          path="/weight/*"
          element={
            <Suspense fallback={<PageLoading />}>
              <WeightPage />
            </Suspense>
          }
        />
        <Route
          path="/profile/*"
          element={
            <Suspense fallback={<PageLoading />}>
              <ProfilePage />
            </Suspense>
          }
        />
        <Route
          path="/baseline/*"
          element={
            <Suspense fallback={<PageLoading />}>
              <BaselinePage />
            </Suspense>
          }
        />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/whats-new" element={<WhatsNewPage />} />
        <Route path="/settings/whats-next" element={<WhatsNextPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
