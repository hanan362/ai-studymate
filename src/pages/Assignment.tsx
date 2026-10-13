import { useState } from "react";
import { PenLine, Save } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useApp, logSession } from "../hooks/useApp";
import { callAI } from "../lib/ai";
import { CopyButton, ErrorBanner, Markdown, PageHeader, Segmented, Spinner } from "../components/ui";
import { errMsg, SUBJECTS } from "../lib/utils";
import type { Lang } from "../types";

export default function Assignment() {
  const { user, prefs } = useApp();
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [question, setQuestion] = useState("");
  const [lang, setLang] = useState<Lang>(prefs?.language ?? "english");
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const run = async () => {
    if (question.trim().length < 10) return setError("Paste the assignment question (at least a sentence).");
    if (!user) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const { reply } = await callAI<{ reply: string }>("assignment", { question: question.trim(), subject, language: lang });
      setResult(reply);
      void logSession(user.id, "assignment", 10);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!user || !result) return;
    const { error } = await supabase.from("saved_outputs").insert({ user_id: user.id, kind: "assignment", title: question.trim().slice(0, 80), content: result });
    if (error) return setError(error.message);
    setSaved(true);
  };

  return (
    <>
      <PageHeader title="Assignment helper" subtitle="Understand the question, plan your answer, then write it in your own words." />
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          This tool gives guidance and outlines — not a finished submission. Output is unverified and may contain mistakes, and it never provides references: find and check any sources yourself.
        </div>
        <div className="card space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="as">Subject</label>
              <select id="as" className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>
                {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <span className="label">Language</span>
              <Segmented label="Language" value={lang} onChange={setLang} options={[{ value: "english", label: "English" }, { value: "roman_urdu", label: "Roman Urdu" }]} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="aq">Assignment question</label>
            <textarea id="aq" className="input min-h-[140px]" maxLength={4000} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Paste your assignment question here…" />
          </div>
          <button className="btn-primary" onClick={run} disabled={busy}><PenLine className="h-4 w-4" aria-hidden /> {result ? "Regenerate" : "Help me understand"}</button>
          {busy && <Spinner label="Preparing guidance…" />}
        </div>
        <ErrorBanner message={error} onClose={() => setError(null)} />
        {result && (
          <div className="card">
            <div className="mb-3 flex gap-2">
              <CopyButton text={result} />
              <button className="btn-secondary !px-3 !py-1.5" onClick={save} disabled={saved}><Save className="h-4 w-4" aria-hidden /> {saved ? "Saved" : "Save"}</button>
            </div>
            <Markdown>{result}</Markdown>
          </div>
        )}
      </div>
    </>
  );
}
