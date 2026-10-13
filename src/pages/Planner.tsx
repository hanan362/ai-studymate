import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Circle, Plus, RefreshCw, Trash2, XCircle } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useApp, logSession } from "../hooks/useApp";
import { callAI } from "../lib/ai";
import { EmptyState, ErrorBanner, PageHeader, ProgressBar, Spinner } from "../components/ui";
import { addDays, errMsg, pct, todayStr } from "../lib/utils";
import type { StudyTask } from "../types";

interface SubjectInput {
  name: string;
  examDate: string;
  difficult: string;
}

export default function Planner() {
  const { user } = useApp();
  const [subjects, setSubjects] = useState<SubjectInput[]>([{ name: "", examDate: addDays(todayStr(), 14), difficult: "" }]);
  const [hours, setHours] = useState(3);
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [planId, setPlanId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const today = todayStr();

  const load = useCallback(async () => {
    const { data: plan } = await supabase.from("study_plans").select("*").eq("active", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!plan) {
      setPlanId(null);
      setTasks([]);
      setLoading(false);
      return;
    }
    setPlanId(plan.id);
    const cfg = plan.config as { subjects?: SubjectInput[]; hours?: number };
    if (cfg.subjects?.length) setSubjects(cfg.subjects);
    if (cfg.hours) setHours(cfg.hours);
    const { data } = await supabase.from("study_tasks").select("*").eq("plan_id", plan.id).order("task_date");
    setTasks((data ?? []) as StudyTask[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const validate = (): string | null => {
    const filled = subjects.filter((s) => s.name.trim());
    if (!filled.length) return "Add at least one subject.";
    for (const s of filled) if (!s.examDate || s.examDate < today) return `Pick a future exam date for ${s.name}.`;
    if (hours < 0.5 || hours > 12) return "Study hours per day must be between 0.5 and 12.";
    return null;
  };

  const createPlan = async (missed: StudyTask[] = []) => {
    if (!user) return;
    const v = validate();
    if (v) return setError(v);
    setBusy(true);
    setError(null);
    try {
      const clean = subjects.filter((s) => s.name.trim());
      const lastExam = clean.map((s) => s.examDate).sort().pop()!;
      const days = Math.min(28, Math.max(3, Math.round((new Date(lastExam).getTime() - new Date(today).getTime()) / 86_400_000)));
      const { tasks: gen } = await callAI<{ tasks: { date: string; subject: string; title: string; kind: string; duration_min: number }[] }>("plan", {
        subjects: clean.map((s) => ({ name: s.name.trim(), exam_date: s.examDate, difficult_topics: s.difficult.split(",").map((x) => x.trim()).filter(Boolean) })),
        hoursPerDay: hours,
        days,
        today,
        missed: missed.map((m) => ({ subject: m.subject, title: m.title })),
      });
      // Keep completed tasks, replace the rest (used for both new plans and re-plans)
      if (planId) {
        await supabase.from("study_tasks").delete().eq("plan_id", planId).neq("status", "done");
        await supabase.from("study_plans").update({ config: { subjects: clean, hours } }).eq("id", planId);
      }
      let pid = planId;
      if (!pid) {
        const { data: plan, error } = await supabase.from("study_plans").insert({ user_id: user.id, title: "Study plan", config: { subjects: clean, hours } }).select("id").single();
        if (error) throw new Error(error.message);
        pid = plan.id;
      }
      const { error: e2 } = await supabase.from("study_tasks").insert(gen.map((t) => ({ plan_id: pid, user_id: user.id, subject: t.subject, title: t.title, kind: t.kind, task_date: t.date, duration_min: t.duration_min })));
      if (e2) throw new Error(e2.message);
      setShowForm(false);
      setNotice(missed.length ? "Your plan was revised to cover the missed tasks." : "Your study plan is ready.");
      await load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (t: StudyTask, status: StudyTask["status"]) => {
    const completed_at = status === "done" ? new Date().toISOString() : null;
    const { error } = await supabase.from("study_tasks").update({ status, completed_at }).eq("id", t.id);
    if (error) return setError(error.message);
    setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, status, completed_at } : x)));
    if (status === "done" && user) void logSession(user.id, "planner", t.duration_min);
  };

  const deletePlan = async () => {
    if (!planId || !confirm("Delete your current plan and all its tasks?")) return;
    await supabase.from("study_plans").delete().eq("id", planId);
    setTasks([]);
    setPlanId(null);
  };

  // Past pending tasks count as missed
  const overdue = useMemo(() => tasks.filter((t) => t.task_date < today && t.status !== "done"), [tasks, today]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(today, i)), [today]);
  const byDate = useMemo(() => {
    const m = new Map<string, StudyTask[]>();
    tasks.forEach((t) => m.set(t.task_date, [...(m.get(t.task_date) ?? []), t]));
    return m;
  }, [tasks]);
  const done = tasks.filter((t) => t.status === "done").length;

  const updateSubject = (i: number, patch: Partial<SubjectInput>) => setSubjects((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  if (loading) return <Spinner label="Loading planner…" />;

  return (
    <>
      <PageHeader
        title="Study planner"
        subtitle="A realistic timetable built around your exams."
        actions={tasks.length > 0 && !showForm ? <button className="btn-secondary" onClick={() => setShowForm(true)}><Plus className="h-4 w-4" aria-hidden /> New / edit plan</button> : undefined}
      />
      <div className="space-y-4">
        <ErrorBanner message={error} onClose={() => setError(null)} />
        {notice && <div role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{notice}</div>}

        {(tasks.length === 0 || showForm) && (
          <div className="card space-y-4">
            <h2 className="font-semibold">Tell us about your exams</h2>
            {subjects.map((s, i) => (
              <div key={i} className="grid gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800 sm:grid-cols-3">
                <div>
                  <label className="label" htmlFor={`sn${i}`}>Subject</label>
                  <input id={`sn${i}`} className="input" value={s.name} onChange={(e) => updateSubject(i, { name: e.target.value })} placeholder="e.g. Operating Systems" />
                </div>
                <div>
                  <label className="label" htmlFor={`sd${i}`}>Exam date</label>
                  <input id={`sd${i}`} type="date" min={today} className="input" value={s.examDate} onChange={(e) => updateSubject(i, { examDate: e.target.value })} />
                </div>
                <div>
                  <label className="label" htmlFor={`st${i}`}>Difficult topics (comma separated)</label>
                  <div className="flex gap-2">
                    <input id={`st${i}`} className="input" value={s.difficult} onChange={(e) => updateSubject(i, { difficult: e.target.value })} placeholder="deadlocks, paging" />
                    {subjects.length > 1 && (
                      <button className="btn-secondary !px-3" aria-label="Remove subject" onClick={() => setSubjects((x) => x.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-end gap-4">
              {subjects.length < 8 && <button className="btn-secondary" onClick={() => setSubjects((s) => [...s, { name: "", examDate: addDays(today, 14), difficult: "" }])}><Plus className="h-4 w-4" aria-hidden /> Add subject</button>}
              <div>
                <label className="label" htmlFor="hrs">Study hours per day</label>
                <input id="hrs" type="number" step="0.5" min={0.5} max={12} className="input w-32" value={hours} onChange={(e) => setHours(Number(e.target.value))} />
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary" onClick={() => createPlan()} disabled={busy}><CalendarDays className="h-4 w-4" aria-hidden /> {planId ? "Rebuild plan" : "Generate plan"}</button>
              {showForm && <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>}
            </div>
            {busy && <Spinner label="AI is building your timetable…" />}
          </div>
        )}

        {tasks.length === 0 && !showForm && (
          <EmptyState icon={<CalendarDays className="h-6 w-6" />} title="No plan yet" text="Enter your subjects and exam dates above to get a daily and weekly timetable." />
        )}

        {tasks.length > 0 && (
          <>
            <div className="card">
              <div className="mb-2 flex justify-between text-sm"><span className="font-medium">Overall progress</span><span>{done}/{tasks.length} tasks · {pct(done, tasks.length)}%</span></div>
              <ProgressBar value={pct(done, tasks.length)} tone="green" />
            </div>

            {overdue.length > 0 && (
              <div className="card border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
                <p className="font-semibold text-amber-900 dark:text-amber-200">You have {overdue.length} unfinished task{overdue.length > 1 ? "s" : ""} from earlier days.</p>
                <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">No problem — let AI revise your plan to fit them in.</p>
                <button className="btn-primary mt-3" onClick={() => createPlan(overdue)} disabled={busy}><RefreshCw className="h-4 w-4" aria-hidden /> Suggest a revised plan</button>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {weekDays.map((d) => {
                const list = byDate.get(d) ?? [];
                const mins = list.reduce((s, t) => s + t.duration_min, 0);
                return (
                  <section key={d} className={`card !p-4 ${d === today ? "ring-2 ring-brand-500" : ""}`} aria-label={d}>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold">{d === today ? "Today" : new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</h3>
                      <span className="text-xs text-slate-500">{mins} min</span>
                    </div>
                    {list.length === 0 ? <p className="text-xs text-slate-400">Rest day</p> : (
                      <ul className="space-y-2">
                        {list.map((t) => (
                          <li key={t.id} className="flex items-start gap-2">
                            <button onClick={() => setStatus(t, t.status === "done" ? "pending" : "done")} aria-label={t.status === "done" ? "Mark as not done" : "Mark as done"} className="mt-0.5">
                              {t.status === "done" ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Circle className="h-5 w-5 text-slate-400" />}
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm ${t.status === "done" ? "text-slate-400 line-through" : ""}`}>{t.title}</p>
                              <p className="text-xs text-slate-500">{t.subject} · {t.duration_min}m {t.kind === "revision" && "· revision"}</p>
                            </div>
                            {t.status === "pending" && t.task_date <= today && (
                              <button onClick={() => setStatus(t, "missed")} aria-label="Mark as missed" title="Mark as missed"><XCircle className="h-4 w-4 text-slate-300 hover:text-red-500" /></button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
            <button className="btn-secondary !text-red-600" onClick={deletePlan}><Trash2 className="h-4 w-4" aria-hidden /> Delete plan</button>
          </>
        )}
      </div>
    </>
  );
}
