// Single AI gateway for AI StudyMate. Runs on Supabase Edge Functions (Deno).
// The Anthropic API key lives ONLY in function secrets (ANTHROPIC_API_KEY) and is never sent to the browser.
// Every request must carry a valid Supabase user JWT.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = Deno.env.get("AI_MODEL") ?? "claude-sonnet-5-5";
const MAX_SOURCE_CHARS = 60_000;
const MAX_MESSAGE_CHARS = 4_000;

type Lang = "english" | "roman_urdu";

const langRule = (l: Lang) =>
  l === "roman_urdu"
    ? "Write explanations in Roman Urdu (Urdu written in the Latin alphabet, e.g. 'Yeh ek function hai jo...'). Keep technical terms, code and definitions in English."
    : "Write in clear, simple English suitable for a university student.";

const grounding =
  "Base your answer on the SOURCE MATERIAL provided. If the source does not contain something the student asks for, say so explicitly instead of guessing. Never invent facts, citations or references.";

function clip(text: unknown, max: number): string {
  return String(text ?? "").slice(0, max);
}

async function callClaude(opts: { system: string; messages: { role: string; content: string }[]; maxTokens?: number }) {
  if (!ANTHROPIC_API_KEY) throw new Error("AI service is not configured (missing ANTHROPIC_API_KEY).");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 3000,
      system: opts.system,
      messages: opts.messages,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error("Anthropic error", res.status, detail);
    if (res.status === 429) throw new Error("The AI service is busy. Please try again in a moment.");
    throw new Error("The AI service returned an error. Please try again.");
  }
  const data = await res.json();
  return (data.content ?? []).map((b: { text?: string }) => b.text ?? "").join("").trim();
}

function parseJson<T>(raw: string): T {
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.search(/[\[{]/);
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (start === -1 || end === -1) throw new Error("The AI returned an unreadable response. Please regenerate.");
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // ── Authenticate the caller ──
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) return json({ error: "Please sign in to use AI features." }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const action = String(body.action ?? "");
  const language: Lang = body.language === "roman_urdu" ? "roman_urdu" : "english";

  try {
    switch (action) {
      // ───────────── AI Personal Tutor ─────────────
      case "tutor": {
        const subject = clip(body.subject, 80) || "General Computer Science";
        const beginner = body.beginner === true;
        const history = Array.isArray(body.history) ? (body.history as { role: string; content: string }[]).slice(-12) : [];
        const message = clip(body.message, MAX_MESSAGE_CHARS);
        if (!message.trim()) return json({ error: "Please type a question." }, 400);
        const weak = Array.isArray(body.weakTopics) ? (body.weakTopics as string[]).slice(0, 5).map((t) => clip(t, 60)) : [];

        const system = [
          `You are AI StudyMate, a patient personal tutor for university students (especially Computer Science students in Pakistan). The selected subject is: ${subject}.`,
          "Keep the conversation focused on this subject; if the question is unrelated, politely steer back.",
          "Explain step by step with a simple, concrete example. Use Markdown (short headings, lists, fenced code blocks).",
          beginner ? "BEGINNER MODE: assume no prior knowledge, avoid jargon, use an everyday analogy first." : "",
          "When it helps learning, finish with ONE guiding question that makes the student think, rather than always handing over the final answer immediately. For direct factual questions, answer directly.",
          weak.length ? `The student has struggled with: ${weak.join(", ")}. Mention these only if relevant.` : "",
          langRule(language),
        ].filter(Boolean).join("\n");

        const msgs = [...history.filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({ role: m.role, content: clip(m.content, MAX_MESSAGE_CHARS) })), { role: "user", content: message }];
        const reply = await callClaude({ system, messages: msgs, maxTokens: 1800 });
        return json({ reply });
      }

      // ───────────── Notes generator ─────────────
      case "notes": {
        const source = clip(body.text, MAX_SOURCE_CHARS);
        if (source.trim().length < 50) return json({ error: "The document has too little text to summarise. If it is a scanned PDF, try a text-based file." }, 400);
        const style = ["short", "detailed", "exam"].includes(String(body.style)) ? String(body.style) : "detailed";
        const styleRule: Record<string, string> = {
          short: "SHORT NOTES: a concise one-page summary with headings and tight bullet points.",
          detailed: "DETAILED NOTES: thorough notes with headings, explanations, examples and key definitions.",
          exam: "EXAM-ORIENTED NOTES: key definitions, formulas/algorithms, likely exam questions, comparisons, and a quick revision checklist.",
        };
        const system = [
          "You turn lecture material into well-organised study notes for a university student.",
          styleRule[style],
          "Use Markdown with headings, bullet lists, a 'Key Definitions' section and an 'Examples' section where the material supports them.",
          grounding,
          "End with a short section 'Not covered in the source' listing important related points the material does not address (or 'None noticed').",
          langRule(language),
        ].join("\n");
        const content = await callClaude({ system, messages: [{ role: "user", content: `SOURCE MATERIAL:\n"""\n${source}\n"""` }], maxTokens: 4000 });
        return json({ content });
      }

      // ───────────── MCQ generator ─────────────
      case "mcqs": {
        const source = clip(body.text, MAX_SOURCE_CHARS);
        if (source.trim().length < 50) return json({ error: "Not enough text to generate questions." }, 400);
        const difficulty = ["beginner", "intermediate", "advanced"].includes(String(body.difficulty)) ? String(body.difficulty) : "intermediate";
        const count = Math.min(Math.max(Number(body.count) || 8, 3), 15);
        const system = [
          `Create ${count} multiple-choice questions at ${difficulty} difficulty from the SOURCE MATERIAL only.`,
          "Each question has exactly 4 options with exactly one correct answer and plausible distractors.",
          "Give each question a short 'topic' label (2-4 words) naming the concept it tests.",
          "Explain briefly why the correct answer is right.",
          'Respond with ONLY valid JSON: {"questions":[{"topic":"","question":"","options":["","","",""],"correct_index":0,"explanation":""}]}',
          langRule(language),
        ].join("\n");
        const raw = await callClaude({ system, messages: [{ role: "user", content: `SOURCE MATERIAL:\n"""\n${source}\n"""` }], maxTokens: 4000 });
        const parsed = parseJson<{ questions: { topic: string; question: string; options: string[]; correct_index: number; explanation: string }[] }>(raw);
        const questions = (parsed.questions ?? []).filter((q) => Array.isArray(q.options) && q.options.length === 4 && q.correct_index >= 0 && q.correct_index <= 3 && q.question);
        if (!questions.length) throw new Error("Could not generate valid questions. Please try again.");
        return json({ questions });
      }

      // ───────────── Flashcards ─────────────
      case "flashcards": {
        const source = clip(body.text, MAX_SOURCE_CHARS);
        if (source.trim().length < 50) return json({ error: "Not enough text to generate flashcards." }, 400);
        const count = Math.min(Math.max(Number(body.count) || 12, 4), 30);
        const system = [
          `Create ${count} question-and-answer flashcards from the SOURCE MATERIAL only.`,
          "Fronts are short questions or terms; backs are concise answers (max 3 sentences).",
          "Give each a short 'topic' label (2-4 words).",
          'Respond with ONLY valid JSON: {"cards":[{"front":"","back":"","topic":""}]}',
          langRule(language),
        ].join("\n");
        const raw = await callClaude({ system, messages: [{ role: "user", content: `SOURCE MATERIAL:\n"""\n${source}\n"""` }], maxTokens: 3500 });
        const parsed = parseJson<{ cards: { front: string; back: string; topic: string }[] }>(raw);
        const cards = (parsed.cards ?? []).filter((c) => c.front && c.back);
        if (!cards.length) throw new Error("Could not generate flashcards. Please try again.");
        return json({ cards });
      }

      // ───────────── Study planner ─────────────
      case "plan": {
        const subjects = Array.isArray(body.subjects) ? (body.subjects as Record<string, unknown>[]).slice(0, 10) : [];
        if (!subjects.length) return json({ error: "Add at least one subject." }, 400);
        const today = clip(body.today, 10);
        const hoursPerDay = Math.min(Math.max(Number(body.hoursPerDay) || 3, 0.5), 12);
        const days = Math.min(Math.max(Number(body.days) || 14, 3), 28);
        const missed = Array.isArray(body.missed) ? (body.missed as unknown[]).slice(0, 20) : [];
        const system = [
          "You are a study planner. Build a realistic day-by-day timetable.",
          `Today is ${today}. Plan the next ${days} days (start today). The student can study at most ${hoursPerDay} hours per day, so total duration_min per day must not exceed ${Math.round(hoursPerDay * 60)}.`,
          "Prioritise subjects with earlier exam dates and those marked difficult; schedule revision tasks in the days before each exam; never schedule study after an exam date has passed; keep sessions between 25 and 90 minutes.",
          missed.length ? `The student MISSED these tasks; reschedule them sensibly: ${JSON.stringify(missed)}` : "",
          'Respond with ONLY valid JSON: {"tasks":[{"date":"YYYY-MM-DD","subject":"","title":"","kind":"study|revision|practice","duration_min":45}]}',
        ].filter(Boolean).join("\n");
        const raw = await callClaude({ system, messages: [{ role: "user", content: JSON.stringify({ subjects }) }], maxTokens: 4000 });
        const parsed = parseJson<{ tasks: { date: string; subject: string; title: string; kind: string; duration_min: number }[] }>(raw);
        const tasks = (parsed.tasks ?? [])
          .filter((t) => /^\d{4}-\d{2}-\d{2}$/.test(t.date) && t.subject && t.title)
          .map((t) => ({ ...t, kind: ["study", "revision", "practice"].includes(t.kind) ? t.kind : "study", duration_min: Math.min(Math.max(Math.round(t.duration_min) || 45, 15), 180) }));
        if (!tasks.length) throw new Error("Could not build a plan. Please try again.");
        return json({ tasks });
      }

      // ───────────── Assignment helper ─────────────
      case "assignment": {
        const question = clip(body.question, MAX_MESSAGE_CHARS);
        if (question.trim().length < 10) return json({ error: "Paste the assignment question first." }, 400);
        const subject = clip(body.subject, 80) || "Computer Science";
        const system = [
          `You help a university student UNDERSTAND an assignment in ${subject}. You do not write the final submission for them.`,
          "Produce Markdown with these sections: 1) What the question is really asking, 2) Key concepts to review, 3) Suggested outline/structure, 4) A short worked example on a SIMILAR (not identical) problem, 5) Tips for writing it in your own words.",
          "Do NOT fabricate references, citations, URLs, or statistics. If sources are needed, tell the student to find and verify them personally.",
          "End with this note: 'This is guidance only and has not been verified. Write your final answer in your own words and check it against your course material.'",
          langRule(language),
        ].join("\n");
        const reply = await callClaude({ system, messages: [{ role: "user", content: question }], maxTokens: 2500 });
        return json({ reply });
      }

      // ───────────── Study DNA recommendation ─────────────
      case "recommend": {
        const stats = JSON.stringify(body.stats ?? {}).slice(0, 6000);
        const system = [
          "You are a study coach. Using ONLY the learning statistics provided (topic accuracy, quiz history, flashcard ratings, task completion, study minutes), recommend the next 3 best learning activities.",
          "Never comment on intelligence, personality, or any personal characteristic. Only talk about demonstrated study activity.",
          'Respond with ONLY valid JSON: {"recommendations":[{"title":"","reason":"","action":"tutor|notes|quiz|flashcards|planner"}]}',
          langRule(language),
        ].join("\n");
        const raw = await callClaude({ system, messages: [{ role: "user", content: stats }], maxTokens: 900 });
        const parsed = parseJson<{ recommendations: { title: string; reason: string; action: string }[] }>(raw);
        return json({ recommendations: (parsed.recommendations ?? []).slice(0, 3) });
      }

      default:
        return json({ error: "Unknown action." }, 400);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Something went wrong.";
    return json({ error: message }, 500);
  }
});
