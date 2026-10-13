import { NavLink, Outlet } from "react-router-dom";
import { BarChart3, BookOpenCheck, CalendarDays, FileText, GraduationCap, Layers, LayoutDashboard, MessageCircle, Moon, PenLine, Settings, Sun } from "lucide-react";
import { useApp } from "../hooks/useApp";

const NAV = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/tutor", label: "AI Tutor", icon: MessageCircle },
  { to: "/app/notes", label: "Notes", icon: FileText },
  { to: "/app/quiz", label: "Quizzes", icon: BookOpenCheck },
  { to: "/app/flashcards", label: "Flashcards", icon: Layers },
  { to: "/app/planner", label: "Planner", icon: CalendarDays },
  { to: "/app/assignment", label: "Assignments", icon: PenLine },
  { to: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

// Shown in the mobile bottom bar (the rest live in the "More" scroll)
const link = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
    isActive ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200" : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
  }`;

export default function Layout() {
  const { theme, toggleTheme, profile } = useApp();
  return (
    <div className="min-h-screen lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:p-2 focus:text-brand-700">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <GraduationCap className="h-5 w-5" aria-hidden />
          </div>
          <span className="text-lg font-bold">AI StudyMate</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto" aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={link}>
              <n.icon className="h-5 w-5" aria-hidden />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
          <span className="truncate text-sm font-medium">{profile?.full_name || "Student"}</span>
          <button onClick={toggleTheme} className="rounded-lg p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 lg:hidden">
          <div className="flex items-center gap-2 font-bold">
            <GraduationCap className="h-5 w-5 text-brand-600" aria-hidden /> AI StudyMate
          </div>
          <button onClick={toggleTheme} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Toggle dark mode">
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </header>

        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-28 lg:px-8 lg:pb-10">
          <Outlet />
        </main>

        {/* Mobile bottom navigation (scrolls horizontally to fit every screen) */}
        <nav aria-label="Main mobile" className="fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t border-slate-200 bg-white/95 px-2 py-1.5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 lg:hidden">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex min-w-[4.5rem] flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[11px] font-medium ${isActive ? "text-brand-600 dark:text-brand-300" : "text-slate-500 dark:text-slate-400"}`
              }
            >
              <n.icon className="h-5 w-5" aria-hidden />
              {n.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
