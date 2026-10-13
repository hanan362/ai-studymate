import { useEffect, useRef, useState, type FormEvent } from "react";
import { Send, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useApp, logSession } from "../hooks/useApp";
import { callAI } from "../lib/ai";
import { CopyButton, ErrorBanner, Markdown, PageHeader, Segmented, Spinner } from "../components/ui";
import { errMsg, SUBJECTS } from "../lib/utils";
import type { ChatMessage, Lang } from "../types";

export default function Tutor() {
  const { user, prefs, updatePrefs } = useApp();
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [lang, setLang] = useState<Lang>(prefs?.language ?? "english");
  const [beginner, setBeginner] = useState(prefs?.beginner_mode ?? false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weak, setWeak] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefs) {
      setLang(prefs.language);
      setBeginner(prefs.beginner_mode);
    }
  }, [prefs]);

  useEffect(() => {
    supabase
      .from("topic_performance")
      .select("topic,attempts,correct")
      .gte("attempts", 2)
      .then(({ data }) => {
        const w = (data ?? []).filter((t) => t.correct / t.attempts < 0.6).map((t) => t.topic);
        setWeak(w.slice(0, 5));
      });
  }, []);

  // Load saved history when the subject changes
  useEffect(() => {
    setMessages([]);
    supabase
      .from("tutor_messages")
      .select("role,content")
      .eq("subject", subject)
      .order("created_at", { ascending: true })
      .limit(60)
      .then(({ data }) => setMessages((data ?? []) as ChatMessage[]));
  }, [subject]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const send = async (text: string, regenerate = false) => {
    if (!user || !text.trim() || busy) return;
    setError(null);
    const history = regenerate ? messages.slice(0, -1) : messages;
    const base = regenerate ? history : [...history, { role: "user" as const, content: text.trim() }];
    setMessages(base);
    setInput("");
    setBusy(true);
    try {
      const { reply } = await callAI<{ reply: string }>("tutor", {
        message: text.trim(),
        history: regenerate ? history.slice(0, -1) : history,
        subject,
        language: lang,
        beginner,
        weakTopics: weak,
      });
      setMessages([...base, { role: "assistant", content: reply }]);
      const rows = [{ user_id: user.id, subject, role: "assistant", content: reply }];
      if (!regenerate) rows.unshift({ user_id: user.id, subject, role: "user", content: text.trim() });
      await supabase.from("tutor_messages").insert(rows);
      void logSession(user.id, "tutor", 5);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const regenerate = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    void send(lastUser.content, true);
  };

  const clearChat = async () => {
    if (!confirm(`Clear your saved ${subject} conversation?`)) return;
    await supabase.from("tutor_messages").delete().eq("subject", subject);
    setMessages([]);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  const toggleBeginner = async () => {
    const next = !beginner;
    setBeginner(next);
    await updatePrefs({ beginner_mode: next });
  };

  const starters = ["Explain recursion with a simple example", "What is the difference between a stack and a queue?", "How does normalization work in databases?"];

  return (
    <>
      <PageHeader
        title="AI Tutor"
        subtitle="Ask anything about your subject. The tutor explains step by step and may ask you a question back."
        actions={messages.length > 0 ? <button className="btn-secondary" onClick={clearChat}><Trash2 className="h-4 w-4" aria-hidden /> Clear chat</button> : undefined}
      />
      <div className="card mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <label className="label" htmlFor="subject">Subject</label>
          <select id="subject" className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>
            {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <Segmented label="Language" value={lang} onChange={setLang} options={[{ value: "english", label: "English" }, { value: "roman_urdu", label: "Roman Urdu" }]} />
        <button className={beginner ? "btn-primary" : "btn-secondary"} onClick={toggleBeginner} aria-pressed={beginner}>
          <Sparkles className="h-4 w-4" aria-hidden /> Explain like I'm a beginner
        </button>
      </div>

      <div className="card flex h-[60vh] flex-col !p-0">
        <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
          {messages.length === 0 && !busy && (
            <div className="mx-auto max-w-md py-8 text-center">
              <p className="font-medium">What would you like to understand today?</p>
              <div className="mt-4 flex flex-col gap-2">
                {starters.map((s) => (
                  <button key={s} className="btn-secondary !justify-start text-left" onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[90%] rounded-2xl px-4 py-3 ${m.role === "user" ? "bg-brand-600 text-white" : "bg-slate-100 dark:bg-slate-800"}`}>
                {m.role === "user" ? <p className="whitespace-pre-wrap text-sm">{m.content}</p> : <Markdown>{m.content}</Markdown>}
                {m.role === "assistant" && (
                  <div className="mt-2 flex gap-2">
                    <CopyButton text={m.content} />
                    {i === messages.length - 1 && (
                      <button className="btn-secondary !px-3 !py-1.5" onClick={regenerate} disabled={busy}>Regenerate</button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && <Spinner label="Tutor is thinking…" />}
          <div ref={endRef} />
        </div>
        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          <ErrorBanner message={error} onClose={() => setError(null)} />
          <form onSubmit={submit} className="mt-2 flex gap-2">
            <label htmlFor="q" className="sr-only">Your question</label>
            <textarea
              id="q"
              rows={1}
              className="input max-h-32 resize-none"
              placeholder="Type your question…"
              value={input}
              maxLength={4000}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
            />
            <button className="btn-primary" disabled={busy || !input.trim()} aria-label="Send">
              <Send className="h-4 w-4" aria-hidden />
            </button>
          </form>
          <p className="mt-2 text-xs text-slate-500">AI can make mistakes — verify important answers with your course material.</p>
        </div>
      </div>
    </>
  );
}
