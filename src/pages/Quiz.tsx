import { useEffect, useState } from "react";
import { BookOpenCheck, CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useApp, logSession } from "../hooks/useApp";
import { useDocuments } from "../hooks/useDocuments";
import { callAI } from "../lib/ai";
import DocPicker from "../components/DocPicker";
import { EmptyState, ErrorBanner, PageHeader, ProgressBar, Segmented, Spinner } from "../components/ui";
import { errMsg, fmtDate, pct } from "../lib/utils";
import type { Difficulty, Lang, Quiz as QuizT, QuizQuestion } from "../types";

type Phase = "setup" | "taking" | "result";

export default function Quiz() {
  const { user, prefs } = useApp();
  const { docs } = useDocuments();
  const [phase, setPhase] = useState<Phase>("setup");
  const [docId, setDocId] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate");
  const [count, setCount] = useState(8);
  const [lang, setLang] = useState<Lang>("english");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quizzes, setQuizzes] = useState<QuizT[]>([]);

  const [quiz, setQuiz] = useState<QuizT | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<{ q: QuizQuestion; selected: number }[]>([]);
  const [isRetry, setIsRetry] = useState(false);
  const [saved, setSaved] = useState<"saving" | "saved" | "failed">("saving");

  useEffect(() => {
    if (prefs) setLang(prefs.language);
  }, [prefs]);

  const loadQuizzes = async () => {
    const { data } = await supabase.from("quizzes").select("*").order("created_at", { ascending: false }).limit(10);
    setQuizzes((data ?? []) as QuizT[]);
  };
  useEffect(() => {
    void loadQuizzes();
  }, []);

  const startWith = (q: QuizT, qs: QuizQuestion[], retry = false) => {
    setQuiz(q);
    setQuestions(qs);
    setIdx(0);
    setPicked(null);
    setAnswers([]);
    setIsRetry(retry);
    setPhase("taking");
  };

  const generate = async () => {
    const doc = docs.find((d) => d.id === docId);
    if (!doc || !user) return setError("Choose a document first.");
    setBusy(true);
    setError(null);
    try {
      const { questions: qs } = await callAI<{ questions: { topic: string; question: string; options: string[]; correct_index: number; explanation: string }[] }>("mcqs", {
        text: doc.extracted_text,
        difficulty,
        count,
        language: lang,
      });
      const { data: q, error: e1 } = await supabase
        .from("quizzes")
        .insert({ user_id: user.id, document_id: doc.id, title: `${doc.title} — ${difficulty}`, difficulty })
        .select("*")
        .single();
      if (e1) throw new Error(e1.message);
      const rows = qs.map((x, i) => ({ quiz_id: q.id, user_id: user.id, position: i, topic: x.topic || "General", question: x.question, options: x.options, correct_index: x.correct_index, explanation: x.explanation ?? "" }));
      const { data: saved, error: e2 } = await supabase.from("quiz_questions").insert(rows).select("*");
      if (e2) throw new Error(e2.message);
      startWith(q as QuizT, (saved as QuizQuestion[]).sort((a, b) => a.position - b.position));
      void loadQuizzes();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const openExisting = async (q: QuizT) => {
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.from("quiz_questions").select("*").eq("quiz_id", q.id).order("position");
    setBusy(false);
    if (error || !data?.length) return setError(error?.message ?? "This quiz has no questions.");
    startWith(q, data as QuizQuestion[]);
  };

  const current = questions[idx];

  const submitAnswer = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    setAnswers((a) => [...a, { q: current, selected: i }]);
  };

  const finish = async (final: { q: QuizQuestion; selected: number }[]) => {
    setPhase("result");
    setSaved("saving");
    if (!user || !quiz) return;
    try {
      const score = final.filter((a) => a.selected === a.q.correct_index).length;
      const { data: attempt, error: e1 } = await supabase
        .from("quiz_attempts")
        .insert({ user_id: user.id, quiz_id: quiz.id, score, total: final.length, is_retry: isRetry })
        .select("id")
        .single();
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("attempt_answers").insert(
        final.map((a) => ({ attempt_id: attempt.id, user_id: user.id, question_id: a.q.id, selected_index: a.selected, is_correct: a.selected === a.q.correct_index, topic: a.q.topic })),
      );
      if (e2) throw e2;
      await Promise.all(final.map((a) => supabase.rpc("record_topic_result", { p_topic: a.q.topic, p_correct: a.selected === a.q.correct_index })));
      void logSession(user.id, "quiz", Math.max(5, final.length));
      setSaved("saved");
    } catch {
      setSaved("failed");
    }
  };

  const next = () => {
    if (idx + 1 >= questions.length) return void finish(answers);
    setIdx(idx + 1);
    setPicked(null);
  };

  // ───────── Setup ─────────
  if (phase === "setup")
    return (
      <>
        <PageHeader title="Quizzes" subtitle="Generate multiple-choice questions from your notes." />
        <div className="space-y-4">
          <ErrorBanner message={error} onClose={() => setError(null)} />
          <div className="card space-y-4">
            <div>
              <label className="label" htmlFor="doc">Notes</label>
              <DocPicker docs={docs} value={docId} onChange={setDocId} />
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <span className="label">Difficulty</span>
                <Segmented label="Difficulty" value={difficulty} onChange={setDifficulty} options={[{ value: "beginner", label: "Beginner" }, { value: "intermediate", label: "Intermediate" }, { value: "advanced", label: "Advanced" }]} />
              </div>
              <div>
                <label className="label" htmlFor="count">Questions</label>
                <select id="count" className="input" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                  {[5, 8, 10, 15].map((n) => <option key={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <span className="label">Language</span>
                <Segmented label="Language" value={lang} onChange={setLang} options={[{ value: "english", label: "English" }, { value: "roman_urdu", label: "Roman Urdu" }]} />
              </div>
            </div>
            <button className="btn-primary" onClick={generate} disabled={busy || !docId}>
              <BookOpenCheck className="h-4 w-4" aria-hidden /> Generate quiz
            </button>
            {busy && <Spinner label="AI is writing your questions…" />}
          </div>

          <div className="card">
            <h2 className="mb-3 font-semibold">Recent quizzes</h2>
            {quizzes.length === 0 ? (
              <EmptyState icon={<BookOpenCheck className="h-6 w-6" />} title="No quizzes yet" text="Generate your first quiz from an uploaded document." action={<Link to="/app/notes" className="btn-secondary">Go to Notes</Link>} />
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {quizzes.map((q) => (
                  <li key={q.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{q.title}</div>
                      <div className="text-xs text-slate-500">{fmtDate(q.created_at)}</div>
                    </div>
                    <button className="btn-secondary !py-1.5" onClick={() => openExisting(q)}>Retake</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </>
    );

  // ───────── Taking ─────────
  if (phase === "taking" && current)
    return (
      <>
        <PageHeader title={quiz?.title ?? "Quiz"} subtitle={`${isRetry ? "Retry · " : ""}Question ${idx + 1} of ${questions.length}`} />
        <div className="mb-4"><ProgressBar value={((idx + (picked !== null ? 1 : 0)) / questions.length) * 100} /></div>
        <div className="card space-y-4">
          <span className="chip">{current.topic}</span>
          <h2 className="text-lg font-semibold">{current.question}</h2>
          <div className="space-y-2" role="radiogroup" aria-label="Answer options">
            {current.options.map((opt, i) => {
              const answered = picked !== null;
              const isCorrect = i === current.correct_index;
              const isPicked = i === picked;
              let cls = "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800";
              if (answered && isCorrect) cls = "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30";
              else if (answered && isPicked) cls = "border-red-500 bg-red-50 dark:bg-red-950/30";
              return (
                <button key={i} role="radio" aria-checked={isPicked} disabled={answered} onClick={() => submitAnswer(i)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm transition ${cls}`}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold dark:bg-slate-800">{String.fromCharCode(65 + i)}</span>
                  <span className="flex-1">{opt}</span>
                  {answered && isCorrect && <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-label="Correct answer" />}
                  {answered && isPicked && !isCorrect && <XCircle className="h-5 w-5 text-red-600" aria-label="Your answer (incorrect)" />}
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800" role="status">
              <p className="font-semibold">{picked === current.correct_index ? "Correct!" : `Incorrect — the right answer is ${String.fromCharCode(65 + current.correct_index)}.`}</p>
              <p className="mt-1 text-slate-600 dark:text-slate-300">{current.explanation || "No explanation provided."}</p>
            </div>
          )}
          <div className="flex justify-end">
            <button className="btn-primary" onClick={next} disabled={picked === null}>{idx + 1 >= questions.length ? "Finish quiz" : "Next question"}</button>
          </div>
        </div>
      </>
    );

  // ───────── Result ─────────
  const score = answers.filter((a) => a.selected === a.q.correct_index).length;
  const wrong = answers.filter((a) => a.selected !== a.q.correct_index);
  const byTopic = new Map<string, { c: number; t: number }>();
  answers.forEach((a) => {
    const e = byTopic.get(a.q.topic) ?? { c: 0, t: 0 };
    e.t += 1;
    if (a.selected === a.q.correct_index) e.c += 1;
    byTopic.set(a.q.topic, e);
  });
  const weakTopics = [...byTopic.entries()].filter(([, v]) => v.c / v.t < 0.6);

  return (
    <>
      <PageHeader title="Quiz results" subtitle={quiz?.title} />
      <div className="space-y-4">
        <div className="card text-center">
          <div className="text-5xl font-extrabold text-brand-600">{pct(score, answers.length)}%</div>
          <p className="mt-1 text-slate-600 dark:text-slate-400">You answered {score} of {answers.length} correctly.</p>
          <p className="mt-2 text-xs text-slate-500" role="status">
            {saved === "saving" ? "Saving your progress…" : saved === "saved" ? "Progress saved." : "Couldn't save progress — check your connection."}
          </p>
        </div>

        <div className="card">
          <h2 className="mb-3 font-semibold">By topic</h2>
          <div className="space-y-3">
            {[...byTopic.entries()].map(([topic, v]) => (
              <div key={topic}>
                <div className="mb-1 flex justify-between text-sm"><span>{topic}</span><span>{v.c}/{v.t}</span></div>
                <ProgressBar value={pct(v.c, v.t)} tone={v.c / v.t < 0.6 ? "red" : "green"} />
              </div>
            ))}
          </div>
          {weakTopics.length > 0 && (
            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              Topics to revisit: <strong>{weakTopics.map(([t]) => t).join(", ")}</strong>. Try the AI Tutor or flashcards for these.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {wrong.length > 0 && (
            <button className="btn-primary" onClick={() => quiz && startWith(quiz, wrong.map((w) => w.q), true)}>
              <RotateCcw className="h-4 w-4" aria-hidden /> Retry {wrong.length} incorrect
            </button>
          )}
          <button className="btn-secondary" onClick={() => setPhase("setup")}>Back to quizzes</button>
        </div>
      </div>
    </>
  );
}
