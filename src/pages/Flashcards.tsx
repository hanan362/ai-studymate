import { useEffect, useMemo, useState } from "react";
import { Layers, RotateCw, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useApp, logSession } from "../hooks/useApp";
import { useDocuments } from "../hooks/useDocuments";
import { callAI } from "../lib/ai";
import DocPicker from "../components/DocPicker";
import { EmptyState, ErrorBanner, PageHeader, ProgressBar, Spinner } from "../components/ui";
import { errMsg } from "../lib/utils";
import type { Deck, Flashcard, Rating } from "../types";

// Difficult cards come up most often during revision.
const WEIGHT: Record<Rating, number> = { difficult: 4, practice: 3, new: 2, easy: 1 };

function buildQueue(cards: Flashcard[]): Flashcard[] {
  return [...cards].sort((a, b) => WEIGHT[b.rating] - WEIGHT[a.rating] || (a.last_reviewed_at ?? "").localeCompare(b.last_reviewed_at ?? ""));
}

export default function Flashcards() {
  const { user, prefs } = useApp();
  const { docs } = useDocuments();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [deckId, setDeckId] = useState("");
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [docId, setDocId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studying, setStudying] = useState(false);

  const loadDecks = async () => {
    const { data } = await supabase.from("flashcard_decks").select("*").order("created_at", { ascending: false });
    setDecks((data ?? []) as Deck[]);
  };
  useEffect(() => {
    void loadDecks();
  }, []);

  useEffect(() => {
    if (!deckId) return setCards([]);
    supabase.from("flashcards").select("*").eq("deck_id", deckId).then(({ data }) => setCards((data ?? []) as Flashcard[]));
  }, [deckId]);

  const counts = useMemo(() => {
    const c = { new: 0, easy: 0, practice: 0, difficult: 0 };
    cards.forEach((x) => (c[x.rating] += 1));
    return c;
  }, [cards]);

  const generate = async () => {
    const doc = docs.find((d) => d.id === docId);
    if (!doc || !user) return setError("Choose a document first.");
    setBusy(true);
    setError(null);
    try {
      const { cards: gen } = await callAI<{ cards: { front: string; back: string; topic: string }[] }>("flashcards", { text: doc.extracted_text, count: 12, language: prefs?.language ?? "english" });
      const { data: deck, error: e1 } = await supabase.from("flashcard_decks").insert({ user_id: user.id, document_id: doc.id, title: doc.title }).select("*").single();
      if (e1) throw new Error(e1.message);
      const { error: e2 } = await supabase.from("flashcards").insert(gen.map((c) => ({ deck_id: deck.id, user_id: user.id, front: c.front, back: c.back, topic: c.topic || "General" })));
      if (e2) throw new Error(e2.message);
      await loadDecks();
      setDeckId(deck.id);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const start = () => {
    setQueue(buildQueue(cards));
    setI(0);
    setFlipped(false);
    setStudying(true);
  };

  const rate = async (rating: Rating) => {
    const card = queue[i];
    if (!card || !user) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from("flashcards").update({ rating, review_count: card.review_count + 1, last_reviewed_at: now }).eq("id", card.id);
    if (error) return setError(error.message);
    setCards((cs) => cs.map((c) => (c.id === card.id ? { ...c, rating, review_count: c.review_count + 1, last_reviewed_at: now } : c)));
    setFlipped(false);
    if (i + 1 >= queue.length) {
      void logSession(user.id, "flashcards", Math.max(5, queue.length));
      setStudying(false);
    } else setI(i + 1);
  };

  const removeDeck = async () => {
    if (!confirm("Delete this deck?")) return;
    await supabase.from("flashcard_decks").delete().eq("id", deckId);
    setDeckId("");
    setStudying(false);
    await loadDecks();
  };

  if (studying && queue[i]) {
    const card = queue[i];
    return (
      <>
        <PageHeader title="Revision" subtitle={`Card ${i + 1} of ${queue.length} · difficult cards first`} actions={<button className="btn-secondary" onClick={() => setStudying(false)}>End session</button>} />
        <div className="mb-4"><ProgressBar value={(i / queue.length) * 100} /></div>
        <ErrorBanner message={error} onClose={() => setError(null)} />
        <div className="flip-scene mx-auto max-w-xl">
          <button className={`flip-card relative block h-72 w-full ${flipped ? "flipped" : ""}`} onClick={() => setFlipped((f) => !f)} aria-label={flipped ? "Showing answer. Click to show question" : "Showing question. Click to reveal answer"}>
            <div className="flip-face card absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="chip mb-3">{card.topic}</span>
              <p className="text-lg font-semibold">{card.front}</p>
              <p className="mt-4 flex items-center gap-1 text-xs text-slate-400"><RotateCw className="h-3 w-3" aria-hidden /> Tap to flip</p>
            </div>
            <div className="flip-face flip-back card absolute inset-0 flex items-center justify-center overflow-y-auto bg-brand-50 text-center dark:bg-brand-900/30">
              <p className="text-base">{card.back}</p>
            </div>
          </button>
        </div>
        <div className="mx-auto mt-5 grid max-w-xl grid-cols-3 gap-2">
          <button className="btn-secondary !text-emerald-700" onClick={() => rate("easy")} disabled={!flipped}>Easy</button>
          <button className="btn-secondary !text-amber-700" onClick={() => rate("practice")} disabled={!flipped}>Need practice</button>
          <button className="btn-secondary !text-red-700" onClick={() => rate("difficult")} disabled={!flipped}>Difficult</button>
        </div>
        {!flipped && <p className="mt-2 text-center text-xs text-slate-500">Flip the card to rate it.</p>}
      </>
    );
  }

  return (
    <>
      <PageHeader title="Flashcards" subtitle="Flip, rate, repeat — difficult cards come back first." />
      <div className="space-y-4">
        <ErrorBanner message={error} onClose={() => setError(null)} />
        <div className="card space-y-3">
          <h2 className="font-semibold">Create a deck from your notes</h2>
          <DocPicker docs={docs} value={docId} onChange={setDocId} />
          <button className="btn-primary" onClick={generate} disabled={busy || !docId}><Layers className="h-4 w-4" aria-hidden /> Generate flashcards</button>
          {busy && <Spinner label="AI is creating your flashcards…" />}
        </div>

        <div className="card">
          <h2 className="mb-3 font-semibold">Your decks</h2>
          {decks.length === 0 ? (
            <EmptyState icon={<Layers className="h-6 w-6" />} title="No decks yet" text="Generate flashcards from a document to start revising." action={docs.length === 0 ? <Link to="/app/notes" className="btn-secondary">Upload notes</Link> : undefined} />
          ) : (
            <div className="space-y-3">
              <select className="input" value={deckId} onChange={(e) => setDeckId(e.target.value)} aria-label="Choose deck">
                <option value="">Select a deck…</option>
                {decks.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
              {deckId && (
                <>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {([["new", "New"], ["easy", "Easy"], ["practice", "Need practice"], ["difficult", "Difficult"]] as const).map(([k, label]) => (
                      <div key={k} className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800">
                        <div className="text-2xl font-bold">{counts[k]}</div>
                        <div className="text-xs text-slate-500">{label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-primary" onClick={start} disabled={cards.length === 0}>Start revision ({cards.length} cards)</button>
                    <button className="btn-secondary !text-red-600" onClick={removeDeck}><Trash2 className="h-4 w-4" aria-hidden /> Delete deck</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
