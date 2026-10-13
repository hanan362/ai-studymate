import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BookOpenCheck, CheckCircle2, Circle, Flame, MessageCircle, Target, Upload } from "lucide-react";
import { useApp } from "../hooks/useApp";
import { useStats } from "../hooks/useStats";
import { supabase } from "../lib/supabase";
import { EmptyState, ProgressBar, Spinner } from "../components/ui";
import { greeting } from "../lib/utils";
import { useEffect, useState } from "react";

export default function Dashboard() {
  const { profile, theme } = useApp();
  const stats = useStats();
  const [recentDoc, setRecentDoc] = useState<{ id: string; title: string } | null>(null);
  const [todayDone, setTodayDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.from("documents").select("id,title").order("created_at", { ascending: false }).limit(1).maybeSingle().then(({ data }) => setRecentDoc(data));
  }, []);

  const tasks = stats.todayTasks.map((t) => (todayDone.has(t.id) ? { ...t, status: "done" as const } : t));
  const toggle = async (id: string, status: string) => {
    const next = status === "done" ? "pending" : "done";
    const { error } = await supabase.from("study_tasks").update({ status: next, completed_at: next === "done" ? new Date().toISOString() : null }).eq("id", id);
    if (error) return;
    setTodayDone((s) => {
      const n = new Set(s);
      next === "done" ? n.add(id) : n.delete(id);
      return n;
    });
  };

  const completed = stats.allTasks.filter((t) => t.status === "done").length;
  const axis = theme === "dark" ? "#94a3b8" : "#64748b";
  const first = (profile?.full_name ?? "").split(" ")[0] || "there";
  const isNew = !stats.loading && stats.sessions.length === 0 && stats.topics.length === 0;

  if (stats.loading) return <Spinner label="Loading your dashboard…" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{greeting()}, {first} 👋</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Here's your study overview.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link to="/app/notes" className="card flex items-center gap-3 transition hover:border-brand-400"><Upload className="h-5 w-5 text-brand-600" aria-hidden /><span className="font-semibold">Upload notes</span></Link>
        <Link to="/app/tutor" className="card flex items-center gap-3 transition hover:border-brand-400"><MessageCircle className="h-5 w-5 text-brand-600" aria-hidden /><span className="font-semibold">Ask AI tutor</span></Link>
        <Link to="/app/quiz" className="card flex items-center gap-3 transition hover:border-brand-400"><BookOpenCheck className="h-5 w-5 text-brand-600" aria-hidden /><span className="font-semibold">Generate MCQs</span></Link>
      </div>

      {isNew && (
        <EmptyState
          icon={<Target className="h-6 w-6" />}
          title="Let's get your first session going"
          text="Upload some notes (or add the sample document on the Notes page), then generate a summary, quiz or flashcards. Your progress will appear here."
          action={<Link to="/app/notes" className="btn-primary">Go to Notes</Link>}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <div className="flex items-center gap-2 text-sm text-slate-500"><Flame className="h-4 w-4 text-orange-500" aria-hidden /> Study streak</div>
          <div className="mt-1 text-3xl font-bold">{stats.streak} <span className="text-base font-medium text-slate-500">day{stats.streak === 1 ? "" : "s"}</span></div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-sm text-slate-500"><CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden /> Tasks completed</div>
          <div className="mt-1 text-3xl font-bold">{completed}</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-500">Quizzes taken</div>
          <div className="mt-1 text-3xl font-bold">{stats.quizCount}</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-500">Minutes this week</div>
          <div className="mt-1 text-3xl font-bold">{stats.weekly.reduce((s, d) => s + d.minutes, 0)}</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card" aria-labelledby="today">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="today" className="font-semibold">Today's study plan</h2>
            <Link to="/app/planner" className="text-sm font-medium text-brand-600 hover:underline">Open planner</Link>
          </div>
          {tasks.length === 0 ? (
            <p className="text-sm text-slate-500">No tasks scheduled for today. <Link to="/app/planner" className="font-semibold text-brand-600 hover:underline">Create a study plan</Link>.</p>
          ) : (
            <ul className="space-y-2">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3">
                  <button onClick={() => toggle(t.id, t.status)} aria-label={t.status === "done" ? "Mark as not done" : "Mark as done"}>
                    {t.status === "done" ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Circle className="h-5 w-5 text-slate-400" />}
                  </button>
                  <div className="flex-1 text-sm"><span className={t.status === "done" ? "text-slate-400 line-through" : ""}>{t.title}</span><div className="text-xs text-slate-500">{t.subject} · {t.duration_min} min</div></div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" aria-labelledby="cont">
          <h2 id="cont" className="mb-3 font-semibold">Continue learning</h2>
          {recentDoc ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-600 dark:text-slate-400">Latest document: <strong>{recentDoc.title}</strong></p>
              <div className="flex flex-wrap gap-2">
                <Link to="/app/notes" className="btn-secondary">Notes</Link>
                <Link to="/app/quiz" className="btn-secondary">Quiz</Link>
                <Link to="/app/flashcards" className="btn-secondary">Flashcards</Link>
              </div>
            </div>
          ) : <p className="text-sm text-slate-500">Nothing yet — upload your first document to begin.</p>}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card" aria-labelledby="weekly">
          <h2 id="weekly" className="mb-3 font-semibold">Weekly learning progress</h2>
          <div className="h-52" role="img" aria-label="Bar chart of minutes studied in the last 7 days">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.weekly}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === "dark" ? "#1e293b" : "#e2e8f0"} />
                <XAxis dataKey="day" tick={{ fill: axis, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: axis, fontSize: 12 }} axisLine={false} tickLine={false} width={32} />
                <Tooltip formatter={(v) => [`${v} min`, "Studied"]} />
                <Bar dataKey="minutes" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card" aria-labelledby="weak">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="weak" className="font-semibold">Weak topics &amp; revision</h2>
            <Link to="/app/analytics" className="text-sm font-medium text-brand-600 hover:underline">Details</Link>
          </div>
          {stats.weakTopics.length === 0 ? (
            <p className="text-sm text-slate-500">{stats.topics.length === 0 ? "Take a quiz and we'll show the topics worth revising." : "No weak topics right now — nice work!"}</p>
          ) : (
            <ul className="space-y-3">
              {stats.weakTopics.slice(0, 4).map((t) => (
                <li key={t.topic}>
                  <div className="mb-1 flex justify-between text-sm"><span>{t.topic}</span><span>{t.accuracy}%</span></div>
                  <ProgressBar value={t.accuracy} tone="red" />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
