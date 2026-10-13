import { Link } from "react-router-dom";
import { BookOpenCheck, CalendarDays, Dna, FileText, GraduationCap, Layers, MessageCircle, Moon, Sun } from "lucide-react";
import { useApp } from "../hooks/useApp";

const FEATURES = [
  { icon: FileText, title: "AI Notes", text: "Upload a PDF or lecture notes and get short, detailed or exam-ready notes." },
  { icon: MessageCircle, title: "Personal Tutor", text: "Step-by-step explanations in English or Roman Urdu, with guiding questions." },
  { icon: BookOpenCheck, title: "Smart MCQs", text: "Practice questions from your own notes with explanations and weak-topic tracking." },
  { icon: Layers, title: "Flashcards", text: "Flip cards that bring your difficult cards back more often." },
  { icon: CalendarDays, title: "Study Planner", text: "A realistic timetable around your exams that re-plans when you miss a task." },
  { icon: Dna, title: "My Study DNA", text: "Learns from your study activity — never from personal traits — and suggests what to do next." },
];

export default function Welcome() {
  const { theme, toggleTheme } = useApp();
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 lg:px-8">
        <div className="flex items-center gap-2 text-lg font-bold">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <GraduationCap className="h-5 w-5" aria-hidden />
          </div>
          AI StudyMate
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="rounded-lg p-2 hover:bg-slate-200 dark:hover:bg-slate-800" aria-label="Toggle dark mode">
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <Link to="/auth" className="btn-primary">
            Get started
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 lg:px-8">
        <section className="py-14 text-center lg:py-24">
          <span className="chip">Built for university students</span>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-extrabold tracking-tight lg:text-6xl">
            Study smarter with your <span className="text-brand-600">personal AI learning assistant</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
            Turn lecture notes into summaries, quizzes and flashcards, get explanations in English or Roman Urdu, and follow a study plan that adapts to you.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/auth?mode=signup" className="btn-primary !px-6 !py-3 text-base">
              Create free account
            </Link>
            <Link to="/auth" className="btn-secondary !px-6 !py-3 text-base">
              I already have an account
            </Link>
          </div>
        </section>

        <section aria-label="Features" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-200">
                <f.icon className="h-5 w-5" aria-hidden />
              </div>
              <h2 className="font-semibold">{f.title}</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{f.text}</p>
            </div>
          ))}
        </section>

        <p className="mt-10 text-center text-xs text-slate-500">
          AI can make mistakes. Always check important answers against your course material. AI StudyMate tracks study progress only — it never measures intelligence.
        </p>
      </main>
    </div>
  );
}
