import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Dna, Sparkles } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useApp } from "../hooks/useApp";
import { useStats } from "../hooks/useStats";
import { callAI } from "../lib/ai";
import { EmptyState, ErrorBanner, PageHeader, ProgressBar, Spinner } from "../components/ui";
import { errMsg, pct } from "../lib/utils";
import type { Recommendation } from "../types";

const ACTION_LINK: Record<Recommendation["action"], string> = {
  tutor: "/app/tutor",
  notes: "/app/notes",
  quiz: "/app/quiz",
  flashcards: "/app/flashcards",
  planner: "/app/planner",
};

export default function Analytics() {
  const { theme, prefs } = useApp();
  const nav = useNavigate();
  const stats = useStats();
  const [recs, setRecs] = useState<Recommendation[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showData, setShowData] = useState(false);

  const axis = theme === "dark" ? "#94a3b8" : "#64748b";
  const chartData = stats.topics
    .filter((t) => t.attempts > 0)
    .map((t) => ({ topic: t.topic, accuracy: pct(t.correct, t.attempts), attempts: t.attempts }))
    .sort((a, b) => a.accuracy - b.accuracy);

  const totalAnswered = stats.topics.reduce((s, t) => s + t.attempts, 0);
  const totalCorrect = stats.topics.reduce((s, t) => s + t.correct, 0);
  const tasksDone = stats.allTasks.filter((t) => t.status === "done").length;
  const totalMinutes = stats.sessions.reduce((s, x) => s + x.minutes, 0);

  // Deterministic, data-driven next step (rule-based; clearly not an AI answer)
  const nextStep = (() => {
    if (stats.weakTopics[0]) return { label: `Revise "${stats.weakTopics[0].topic}"`, why: `Your accuracy on this topic is ${stats.weakTopics[0].accuracy}% across ${stats.weakTopics[0].attempts} answers.`, to: "/app/tutor" };
    if (stats.cardRatings.difficult > 0) return { label: "Review your difficult flashcards", why: `${stats.cardRatings.difficult} card(s) are marked difficult.`, to: "/app/flashcards" };
    if (stats.quizCount === 0) return { label: "Take your first quiz", why: "A quiz lets us find which topics need more practice.", to: "/app/quiz" };
    return { label: "Keep going with a new quiz", why: "No weak areas detected yet.", to: "/app/quiz" };
  })();

  const getRecs = async () => {
    setBusy(true);
    setError(null);
    try {
      const { recommendations } = await callAI<{ recommendations: Recommendation[] }>("recommend", {
        language: prefs?.language ?? "english",
        stats: {
          topicAccuracy: stats.topics.map((t) => ({ topic: t.topic, attempts: t.attempts, accuracy: pct(t.correct, t.attempts) })),
          flashcards: stats.cardRatings,
          quizAttempts: stats.quizCount,
          tasksCompleted: tasksDone,
          minutesLast60Days: totalMinutes,
          streakDays: stats.streak,
        },
      });
      setRecs(recommendations);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!confirm("Reset your learning history? Quiz results, topic performance, study sessions, tutor chats and flashcard ratings will be cleared. Your documents and account stay.")) return;
    const { error } = await supabase.rpc("reset_learning_history");
    if (error) return setError(error.message);
    setRecs(null);
    await stats.reload();
  };

  if (stats.loading) return <Spinner label="Crunching your progress…" />;

  const noData = stats.topics.length === 0 && stats.sessions.length === 0;

  return (
    <>
      <PageHeader title="Learning analytics" subtitle="Your demonstrated learning progress. This is not a measure of intelligence." />
      <div className="space-y-4">
        <ErrorBanner message={error} onClose={() => setError(null)} />

        {noData && <EmptyState icon={<Dna className="h-6 w-6" />} title="No learning data yet" text="Take quizzes, review flashcards and complete study tasks — your analytics and Study DNA build up from that activity." action={<Link to="/app/quiz" className="btn-primary">Take a quiz</Link>} />}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card"><div className="text-sm text-slate-500">Overall quiz accuracy</div><div className="mt-1 text-3xl font-bold">{pct(totalCorrect, totalAnswered)}%</div><div className="text-xs text-slate-500">{totalAnswered} answers</div></div>
          <div className="card"><div className="text-sm text-slate-500">Study streak</div><div className="mt-1 text-3xl font-bold">{stats.streak}d</div></div>
          <div className="card"><div className="text-sm text-slate-500">Tasks completed</div><div className="mt-1 text-3xl font-bold">{tasksDone}</div></div>
          <div className="card"><div className="text-sm text-slate-500">Minutes (60 days)</div><div className="mt-1 text-3xl font-bold">{totalMinutes}</div></div>
        </div>

        {chartData.length > 0 && (
          <section className="card" aria-labelledby="acc">
            <h2 id="acc" className="mb-3 font-semibold">Accuracy by topic</h2>
            <div style={{ height: Math.max(160, chartData.length * 38) }} role="img" aria-label="Horizontal bar chart of quiz accuracy per topic">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme === "dark" ? "#1e293b" : "#e2e8f0"} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: axis, fontSize: 12 }} axisLine={false} tickLine={false} unit="%" />
                  <YAxis type="category" dataKey="topic" width={120} tick={{ fill: axis, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => [`${v}%`, "Accuracy"]} />
                  <Bar dataKey="accuracy" radius={[0, 6, 6, 0]}>
                    {chartData.map((d) => <Cell key={d.topic} fill={d.accuracy < 60 ? "#ef4444" : d.accuracy < 80 ? "#f59e0b" : "#10b981"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-slate-500">Red: under 60% · Amber: 60–79% · Green: 80%+</p>
          </section>
        )}

        <section className="card" aria-labelledby="weakA">
          <h2 id="weakA" className="mb-3 font-semibold">Weakness detection</h2>
          {stats.weakTopics.length === 0 ? (
            <p className="text-sm text-slate-500">No repeated mistakes detected yet. Weak topics appear once you've answered at least 2 questions on a topic with under 60% accuracy.</p>
          ) : (
            <ul className="space-y-4">
              {stats.weakTopics.map((t) => (
                <li key={t.topic}>
                  <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{t.topic}</span><span>{t.accuracy}% · {t.attempts} answers</span></div>
                  <ProgressBar value={t.accuracy} tone="red" />
                  <div className="mt-2 flex flex-wrap gap-2 text-sm">
                    <Link to="/app/tutor" className="chip">Ask the tutor</Link>
                    <Link to="/app/notes" className="chip">Review notes</Link>
                    <Link to="/app/flashcards" className="chip">Flashcards</Link>
                    <Link to="/app/quiz" className="chip">Retry quiz</Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card border-brand-200 dark:border-brand-900" aria-labelledby="dna">
          <div className="mb-1 flex items-center gap-2"><Dna className="h-5 w-5 text-brand-600" aria-hidden /><h2 id="dna" className="font-semibold">My Study DNA</h2></div>
          <p className="text-sm text-slate-500">Built only from your study activity: difficult topics, quiz results, preferred language, completed sessions and revision needs. No sensitive personal traits are inferred.</p>

          {prefs?.study_dna_enabled === false ? (
            <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">Study DNA is turned off in Settings.</p>
          ) : (
            <>
              <div className="mt-4 rounded-xl bg-brand-50 p-4 dark:bg-brand-900/20">
                <div className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-200">Suggested next step (based on your data)</div>
                <div className="mt-1 font-semibold">{nextStep.label}</div>
                <p className="text-sm text-slate-600 dark:text-slate-300">{nextStep.why}</p>
                <button className="btn-primary mt-3" onClick={() => nav(nextStep.to)}>Go</button>
              </div>

              <div className="mt-4">
                <button className="btn-secondary" onClick={getRecs} disabled={busy || noData}><Sparkles className="h-4 w-4" aria-hidden /> Get AI coach recommendations</button>
                {noData && <p className="mt-1 text-xs text-slate-500">Study a little first so there's something to analyse.</p>}
                {busy && <div className="mt-3"><Spinner label="Analysing your study activity…" /></div>}
                {recs && (
                  <ol className="mt-3 space-y-2">
                    {recs.map((r, i) => (
                      <li key={i} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                        <div className="flex items-start justify-between gap-3">
                          <div><div className="text-sm font-semibold">{r.title}</div><p className="text-sm text-slate-600 dark:text-slate-400">{r.reason}</p></div>
                          <Link to={ACTION_LINK[r.action] ?? "/app"} className="btn-secondary !py-1.5">Open</Link>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </>
          )}

          <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button className="btn-secondary" onClick={() => setShowData((s) => !s)}>{showData ? "Hide" : "View"} my learning data</button>
            <button className="btn-secondary !text-red-600" onClick={reset}>Reset learning history</button>
            <Link to="/app/settings" className="btn-secondary">Delete all my data…</Link>
          </div>
          {showData && (
            <div className="mt-3 overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800">
              <p className="mb-2 font-semibold">Preferred language: {prefs?.language === "roman_urdu" ? "Roman Urdu" : "English"} · Flashcards — difficult: {stats.cardRatings.difficult}, need practice: {stats.cardRatings.practice}, easy: {stats.cardRatings.easy}</p>
              <table className="w-full text-left">
                <thead><tr><th className="pr-4">Topic</th><th className="pr-4">Answers</th><th>Correct</th></tr></thead>
                <tbody>{stats.topics.map((t) => <tr key={t.topic}><td className="pr-4">{t.topic}</td><td className="pr-4">{t.attempts}</td><td>{t.correct}</td></tr>)}</tbody>
              </table>
              {stats.topics.length === 0 && <p>No topic data stored.</p>}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
