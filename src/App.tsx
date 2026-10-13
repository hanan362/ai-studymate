import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactElement } from "react";
import { useApp } from "./hooks/useApp";
import { isConfigured } from "./lib/supabase";
import { Spinner } from "./components/ui";
import Layout from "./components/Layout";
import Welcome from "./pages/Welcome";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Tutor from "./pages/Tutor";
import Notes from "./pages/Notes";
import Quiz from "./pages/Quiz";
import Flashcards from "./pages/Flashcards";
import Planner from "./pages/Planner";
import Assignment from "./pages/Assignment";
import Analytics from "./pages/Analytics";
import SettingsPage from "./pages/Settings";

function SetupNotice() {
  return (
    <div className="mx-auto flex min-h-screen max-w-xl items-center px-4">
      <div className="card w-full">
        <h1 className="text-xl font-bold">Almost there — connect Supabase</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Copy <code>.env.example</code> to <code>.env</code>, fill in <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then restart the dev server. See the README for the
          full setup (database schema, storage, and the AI function).
        </p>
      </div>
    </div>
  );
}

function Protected({ children }: { children: ReactElement }) {
  const { user, profile, loading } = useApp();
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Loading your workspace…" />
      </div>
    );
  if (!user) return <Navigate to="/auth" replace />;
  if (profile && !profile.onboarded) return <Navigate to="/onboarding" replace />;
  return children;
}

export default function App() {
  const { user, loading } = useApp();
  if (!isConfigured) return <SetupNotice />;
  return (
    <Routes>
      <Route path="/" element={!loading && user ? <Navigate to="/app" replace /> : <Welcome />} />
      <Route path="/auth" element={!loading && user ? <Navigate to="/app" replace /> : <Auth />} />
      <Route path="/onboarding" element={user ? <Onboarding /> : <Navigate to="/auth" replace />} />
      <Route
        path="/app"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="tutor" element={<Tutor />} />
        <Route path="notes" element={<Notes />} />
        <Route path="quiz" element={<Quiz />} />
        <Route path="flashcards" element={<Flashcards />} />
        <Route path="planner" element={<Planner />} />
        <Route path="assignment" element={<Assignment />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
