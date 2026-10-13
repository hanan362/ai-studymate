import { useEffect, useRef, useState } from "react";
import { FileText, RefreshCw, Save, Trash2, Upload } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useApp, logSession } from "../hooks/useApp";
import { useDocuments } from "../hooks/useDocuments";
import { callAI } from "../lib/ai";
import { extractText, validateFile } from "../lib/extract";
import { CopyButton, EmptyState, ErrorBanner, Markdown, PageHeader, SampleBadge, Segmented, Spinner } from "../components/ui";
import { errMsg, fmtDate, SUBJECTS } from "../lib/utils";
import type { Lang, NoteStyle, SummaryRow } from "../types";

const SAMPLE_TEXT = `Binary Search
Binary search finds the position of a target value within a SORTED array. It compares the target with the middle element; if they are not equal, the half in which the target cannot lie is eliminated and the search continues on the remaining half. Time complexity is O(log n) and space complexity is O(1) for the iterative version. Binary search requires random access, so it works on arrays but not efficiently on linked lists. Example: searching 23 in [2, 5, 8, 12, 16, 23, 38, 56] checks 12, then 38, then 23.

Stacks and Queues
A stack is a LIFO (last in, first out) structure supporting push, pop and peek in O(1). A queue is FIFO (first in, first out) supporting enqueue and dequeue in O(1). Stacks are used for function calls, undo operations and expression evaluation; queues are used in scheduling, buffering and breadth-first search.

Big-O Notation
Big-O describes the upper bound of an algorithm's growth rate as input size n increases. Common classes in increasing order: O(1), O(log n), O(n), O(n log n), O(n^2), O(2^n). It ignores constants and lower-order terms.`;

export default function Notes() {
  const { user, prefs } = useApp();
  const { docs, loading, error: docErr, reload } = useDocuments();
  const [selected, setSelected] = useState<string>("");
  const [summaries, setSummaries] = useState<SummaryRow[]>([]);
  const [style, setStyle] = useState<NoteStyle>(prefs?.note_style ?? "detailed");
  const [lang, setLang] = useState<Lang>(prefs?.language ?? "english");
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [pasted, setPasted] = useState("");
  const [pastedTitle, setPastedTitle] = useState("");
  const [busy, setBusy] = useState<null | "upload" | "generate">(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (prefs) {
      setStyle(prefs.note_style);
      setLang(prefs.language);
    }
  }, [prefs]);

  useEffect(() => {
    if (!selected) return setSummaries([]);
    supabase
      .from("summaries")
      .select("*")
      .eq("document_id", selected)
      .order("created_at", { ascending: false })
      .then(({ data }) => setSummaries((data ?? []) as SummaryRow[]));
  }, [selected]);

  const doc = docs.find((d) => d.id === selected);

  const saveDocument = async (title: string, text: string, fileType: string, file?: File) => {
    if (!user) return;
    let filePath: string | null = null;
    if (file) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      filePath = `${user.id}/${Date.now()}_${safe}`;
      const { error } = await supabase.storage.from("documents").upload(filePath, file, { contentType: file.type || undefined });
      if (error) throw new Error(`Upload failed: ${error.message}`);
    }
    const { data, error } = await supabase
      .from("documents")
      .insert({ user_id: user.id, title, subject, file_path: filePath, file_type: fileType, size_bytes: file?.size ?? text.length, extracted_text: text })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await reload();
    setSelected(data.id);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const v = validateFile(file);
    if (v) return setError(v);
    setBusy("upload");
    try {
      const text = await extractText(file);
      if (text.length < 50) throw new Error("We couldn't find readable text in this file. Scanned/image-only PDFs aren't supported yet — try a text-based PDF or paste the text.");
      await saveDocument(file.name.replace(/\.[^.]+$/, ""), text, file.name.split(".").pop()!.toLowerCase(), file);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const savePasted = async () => {
    setError(null);
    if (pasted.trim().length < 50) return setError("Please paste at least a few sentences of notes.");
    if (pasted.length > 200_000) return setError("That's too much text. Please paste under 200,000 characters.");
    setBusy("upload");
    try {
      await saveDocument(pastedTitle.trim() || "Pasted notes", pasted.trim(), "pasted");
      setPasted("");
      setPastedTitle("");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const addSample = async () => {
    setBusy("upload");
    setError(null);
    try {
      await saveDocument("[Sample] Data Structures basics", SAMPLE_TEXT, "pasted");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const generate = async () => {
    if (!doc || !user) return;
    setBusy("generate");
    setError(null);
    setDraft(null);
    try {
      const { content } = await callAI<{ content: string }>("notes", { text: doc.extracted_text, style, language: lang });
      setDraft(content);
      void logSession(user.id, "notes", 10);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const saveDraft = async () => {
    if (!doc || !user || !draft) return;
    const { data, error } = await supabase
      .from("summaries")
      .insert({ user_id: user.id, document_id: doc.id, style, language: lang, content: draft })
      .select("*")
      .single();
    if (error) return setError(error.message);
    setSummaries((s) => [data as SummaryRow, ...s]);
    setDraft(null);
  };

  const removeDoc = async () => {
    if (!doc) return;
    if (!confirm(`Delete "${doc.title}" and its generated notes?`)) return;
    if (doc.file_path) await supabase.storage.from("documents").remove([doc.file_path]);
    const { error } = await supabase.from("documents").delete().eq("id", doc.id);
    if (error) return setError(error.message);
    setSelected("");
    await reload();
  };

  const removeSummary = async (id: string) => {
    await supabase.from("summaries").delete().eq("id", id);
    setSummaries((s) => s.filter((x) => x.id !== id));
  };

  return (
    <>
      <PageHeader title="Notes" subtitle="Upload lecture material and turn it into study notes." />
      <div className="space-y-4">
        <ErrorBanner message={error ?? docErr} onClose={() => setError(null)} />

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card">
            <h2 className="mb-3 font-semibold">Upload a file</h2>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-6 text-center hover:border-brand-400 dark:border-slate-700">
              <Upload className="h-6 w-6 text-brand-600" aria-hidden />
              <span className="text-sm font-medium">Choose a PDF, TXT or MD file (max 10 MB)</span>
              <input ref={fileRef} type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} disabled={busy !== null} />
            </label>
            <div className="mt-3">
              <label className="label" htmlFor="subj">Subject</label>
              <select id="subj" className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>
                {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            {busy === "upload" && <div className="mt-3"><Spinner label="Uploading and reading your file…" /></div>}
          </div>

          <div className="card">
            <h2 className="mb-3 font-semibold">…or paste lecture notes</h2>
            <input className="input mb-2" placeholder="Title (optional)" value={pastedTitle} onChange={(e) => setPastedTitle(e.target.value)} aria-label="Title" />
            <textarea className="input min-h-[120px]" placeholder="Paste your notes here…" value={pasted} onChange={(e) => setPasted(e.target.value)} aria-label="Notes text" />
            <button className="btn-primary mt-3" onClick={savePasted} disabled={busy !== null}>Save notes</button>
          </div>
        </div>

        <div className="card">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Your documents</h2>
            {docs.length === 0 && !loading && (
              <button className="btn-secondary" onClick={addSample} disabled={busy !== null}>Add a sample document</button>
            )}
          </div>
          {loading ? (
            <Spinner />
          ) : docs.length === 0 ? (
            <EmptyState icon={<FileText className="h-6 w-6" />} title="No documents yet" text="Upload a file, paste notes, or add a sample document to try things out." />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {docs.map((d) => (
                <li key={d.id}>
                  <button
                    onClick={() => setSelected(d.id)}
                    className={`w-full rounded-xl border p-3 text-left transition ${selected === d.id ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20" : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{d.title}</span>
                      {d.title.startsWith("[Sample]") && <SampleBadge />}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">{d.subject ?? "General"} · {d.file_type.toUpperCase()} · {fmtDate(d.created_at)}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {doc && (
          <div className="card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Generate notes from “{doc.title}”</h2>
              <button className="btn-secondary !text-red-600" onClick={removeDoc}><Trash2 className="h-4 w-4" aria-hidden /> Delete document</button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Segmented label="Note style" value={style} onChange={setStyle} options={[{ value: "short", label: "Short" }, { value: "detailed", label: "Detailed" }, { value: "exam", label: "Exam-oriented" }]} />
              <Segmented label="Language" value={lang} onChange={setLang} options={[{ value: "english", label: "English" }, { value: "roman_urdu", label: "Roman Urdu" }]} />
              <button className="btn-primary" onClick={generate} disabled={busy !== null}>
                {draft ? <RefreshCw className="h-4 w-4" aria-hidden /> : <FileText className="h-4 w-4" aria-hidden />}
                {draft ? "Regenerate" : "Generate notes"}
              </button>
            </div>
            {busy === "generate" && <Spinner label="AI is writing your notes… this can take up to a minute." />}

            {draft && (
              <div className="rounded-xl border border-brand-200 p-4 dark:border-brand-900">
                <div className="mb-2 flex flex-wrap gap-2">
                  <CopyButton text={draft} />
                  <button className="btn-primary !px-3 !py-1.5" onClick={saveDraft}><Save className="h-4 w-4" aria-hidden /> Save</button>
                </div>
                <Markdown>{draft}</Markdown>
              </div>
            )}

            {summaries.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-500">Saved notes</h3>
                <div className="space-y-3">
                  {summaries.map((s) => (
                    <details key={s.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                      <summary className="cursor-pointer text-sm font-medium">
                        {s.style} · {s.language === "roman_urdu" ? "Roman Urdu" : "English"} · {fmtDate(s.created_at)}
                      </summary>
                      <div className="mt-3">
                        <div className="mb-2 flex gap-2">
                          <CopyButton text={s.content} />
                          <button className="btn-secondary !px-3 !py-1.5 !text-red-600" onClick={() => removeSummary(s.id)}><Trash2 className="h-4 w-4" aria-hidden /> Delete</button>
                        </div>
                        <Markdown>{s.content}</Markdown>
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
