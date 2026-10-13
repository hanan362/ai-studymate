# AI StudyMate

An AI-powered learning companion for university students (built with Computer Science students in Pakistan in mind).
Upload notes → get summaries, MCQs and flashcards → chat with a tutor in English or Roman Urdu → follow an adaptive study plan.

**Stack:** React 19 + TypeScript + Vite + Tailwind CSS · Supabase (Auth, Postgres with RLS, private Storage, Edge Functions) · Anthropic Claude API (called only from the server-side Edge Function).

## Features implemented

| Area | What works |
|---|---|
| Onboarding & auth | Welcome page, 3-step onboarding, email/password sign-up & login, logout, protected routes |
| AI Notes | Upload PDF/TXT/MD (≤10 MB, validated) or paste text; text extracted in the browser; short / detailed / exam notes; English or Roman Urdu; copy, save, regenerate, delete |
| MCQs | Beginner/intermediate/advanced, 4 options, instant correct answer + explanation, score, per-topic breakdown, retry incorrect questions, results saved |
| AI Tutor | Subject-focused chat, saved history, English/Roman Urdu, "Explain like I'm a beginner", guiding questions, copy/regenerate |
| Flashcards | AI-generated decks, flip cards, Easy / Need practice / Difficult ratings, difficult cards shown first |
| Study planner | Subjects + exam dates + hours/day + difficult topics → AI timetable, weekly calendar, task completion, "suggest revised plan" for missed tasks |
| Weakness detection | Per-topic accuracy chart, weak topics (<60% over ≥2 answers) with links to tutor / notes / flashcards / quizzes |
| Assignment helper | Explains the question, outline, similar worked example; never fabricates references; shows an "unverified" notice |
| My Study DNA | Rule-based next step + optional AI coach recommendations from study activity only; view data, reset history, delete all data |
| Dashboard & UX | Streak, tasks, weekly chart, today's plan, weak topics, light/dark mode, responsive (mobile bottom nav / desktop sidebar), loading & error states, empty states, labelled sample document |

## Setup

### 1. Install
```bash
npm install
cp .env.example .env
```

### 2. Create the Supabase project
1. Create a project at <https://supabase.com>.
2. In **SQL Editor**, run `supabase/migrations/001_schema.sql`. This creates all tables, Row Level Security policies, the private `documents` storage bucket (10 MB limit, PDF/TXT/MD only), and helper functions.
3. In **Authentication → Providers**, keep Email enabled. For quick local testing you can turn off "Confirm email"; for production leave it on.
4. Copy **Project URL** and **anon public key** (Settings → API) into `.env`:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
   The anon key is safe to expose — every table and storage path is protected by RLS (`user_id = auth.uid()`).

### 3. Configure the AI API (server side only)
The browser never sees the AI key. All AI calls go to the `ai` Edge Function, which checks the user's Supabase login first.

```bash
npm i -g supabase            # or use npx supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...        # from console.anthropic.com
supabase secrets set AI_MODEL=claude-sonnet-5-5           # optional, this is the default
supabase secrets set ALLOWED_ORIGIN=https://your-site.com # optional, restrict CORS in production
supabase functions deploy ai
```

### 4. Run locally
```bash
npm run dev        # http://localhost:5173
npm run typecheck
npm run build
```

## Deployment
- **Frontend:** deploy `dist/` (from `npm run build`) to Vercel, Netlify or Cloudflare Pages. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as build env vars. Add a single-page-app rewrite (all paths → `/index.html`).
- **Backend:** already hosted by Supabase (database + Edge Function). In Supabase **Authentication → URL Configuration**, add your deployed site URL as the Site URL / redirect URL.
- Set `ALLOWED_ORIGIN` on the function to your deployed domain.

## Project structure
```
src/pages/        10 screens (+ Assignment helper)
src/components/   Layout, shared UI
src/hooks/        auth/theme context, data hooks
src/lib/          Supabase client, AI client, PDF/text extraction
supabase/migrations/001_schema.sql   schema + RLS + storage + functions
supabase/functions/ai/index.ts       server-side AI gateway
```

## Known limitations
- **Scanned / image-only PDFs** are not supported (no OCR); the app tells the user when no text can be read. PDFs are read up to 150 pages; text sent to the AI is capped at 60,000 characters per request.
- **Account deletion:** "Delete all my data" removes documents, files and all study data, but the Supabase login record itself can only be removed with a service-role key (add a small admin Edge Function if you need full self-service account deletion).
- AI output can be wrong — the UI says so and the assignment helper is guidance-only.
- Planner is one active plan at a time; "missed" re-planning keeps completed tasks and regenerates the rest.
- No rate limiting beyond Anthropic's / Supabase's own limits; add per-user quotas before opening to many users.
- No automated test suite yet.

## Testing checklist (do this against your own Supabase project)
- [ ] Sign up → onboarding → lands on dashboard (empty states visible)
- [ ] Log out, log back in; refresh keeps you signed in
- [ ] Wrong password shows an error; short password/invalid email rejected
- [ ] Notes: add the sample document; upload a text PDF; try a 15 MB file and a .docx (both rejected with a message)
- [ ] Generate short/detailed/exam notes in English and Roman Urdu; save, copy, regenerate, delete
- [ ] Generate a quiz; answer all questions; see score + topics; retry incorrect; check Analytics updates
- [ ] Generate flashcards; flip and rate; difficult cards appear first next session
- [ ] Tutor: ask a question, switch subject (history changes), toggle beginner mode, clear chat
- [ ] Planner: create a plan, tick tasks, mark one missed, request revised plan
- [ ] Assignment helper returns an outline with the "unverified" notice
- [ ] Analytics: charts render; Study DNA view / reset / delete work
- [ ] Second account cannot see the first account's documents, files or results (RLS)
- [ ] Light/dark mode and mobile layout (≈375 px) look right; keyboard navigation works
