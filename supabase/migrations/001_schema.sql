-- AI StudyMate database schema
-- Run in the Supabase SQL editor (or `supabase db push`).
-- Every table is protected by Row Level Security: a student can only touch rows where user_id = auth.uid().

create extension if not exists "pgcrypto";

-- ───────────────────────── Profiles & preferences ─────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  university text,
  degree text default 'BS Computer Science',
  semester int check (semester between 1 and 12),
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.learning_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  language text not null default 'english' check (language in ('english','roman_urdu')),
  note_style text not null default 'detailed' check (note_style in ('short','detailed','exam')),
  beginner_mode boolean not null default false,
  study_dna_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ───────────────────────── Documents & notes ─────────────────────────
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  subject text,
  file_path text,                 -- path inside the private "documents" bucket
  file_type text not null,        -- pdf | txt | md | pasted
  size_bytes bigint not null default 0,
  extracted_text text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists documents_user_idx on public.documents(user_id, created_at desc);

create table if not exists public.summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  style text not null check (style in ('short','detailed','exam')),
  language text not null check (language in ('english','roman_urdu')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists summaries_doc_idx on public.summaries(document_id);

-- ───────────────────────── Quizzes ─────────────────────────
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  title text not null,
  difficulty text not null check (difficulty in ('beginner','intermediate','advanced')),
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position int not null default 0,
  topic text not null,
  question text not null,
  options jsonb not null,                       -- array of exactly 4 strings
  correct_index int not null check (correct_index between 0 and 3),
  explanation text not null default '',
  constraint options_is_four check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4)
);
create index if not exists quiz_questions_quiz_idx on public.quiz_questions(quiz_id, position);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  score int not null default 0,
  total int not null default 0,
  is_retry boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists quiz_attempts_user_idx on public.quiz_attempts(user_id, created_at desc);

create table if not exists public.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  selected_index int not null check (selected_index between 0 and 3),
  is_correct boolean not null,
  topic text not null
);

-- ───────────────────────── Flashcards ─────────────────────────
create table if not exists public.flashcard_decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  title text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.flashcard_decks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  front text not null,
  back text not null,
  topic text not null default 'General',
  rating text not null default 'new' check (rating in ('new','easy','practice','difficult')),
  review_count int not null default 0,
  last_reviewed_at timestamptz
);
create index if not exists flashcards_deck_idx on public.flashcards(deck_id);

-- ───────────────────────── Study planner ─────────────────────────
create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  config jsonb not null default '{}'::jsonb,    -- subjects, exam dates, hours/day, difficult topics
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.study_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.study_plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  title text not null,
  kind text not null default 'study' check (kind in ('study','revision','practice')),
  task_date date not null,
  duration_min int not null default 45 check (duration_min between 5 and 480),
  status text not null default 'pending' check (status in ('pending','done','missed')),
  completed_at timestamptz
);
create index if not exists study_tasks_user_date_idx on public.study_tasks(user_id, task_date);

-- ───────────────────────── Learning data (Study DNA / analytics) ─────────────────────────
create table if not exists public.topic_performance (
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  attempts int not null default 0,
  correct int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, topic)
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('tutor','notes','quiz','flashcards','planner','assignment')),
  minutes int not null default 5 check (minutes between 0 and 600),
  created_at timestamptz not null default now()
);
create index if not exists study_sessions_user_idx on public.study_sessions(user_id, created_at desc);

create table if not exists public.tutor_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null default 'General',
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists tutor_messages_user_idx on public.tutor_messages(user_id, subject, created_at);

create table if not exists public.saved_outputs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('assignment','tutor')),
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

-- ───────────────────────── Row Level Security ─────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'learning_preferences','documents','summaries','quizzes','quiz_questions','quiz_attempts',
    'attempt_answers','flashcard_decks','flashcards','study_plans','study_tasks',
    'topic_performance','study_sessions','tutor_messages','saved_outputs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

alter table public.profiles enable row level security;
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ───────────────────────── Storage (private bucket, per-user folders) ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760,
        array['application/pdf','text/plain','text/markdown'])
on conflict (id) do update set public = false, file_size_limit = 10485760;

drop policy if exists "documents own read" on storage.objects;
drop policy if exists "documents own insert" on storage.objects;
drop policy if exists "documents own delete" on storage.objects;
create policy "documents own read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "documents own insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "documents own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- ───────────────────────── Functions ─────────────────────────
-- New user -> profile + preferences
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict do nothing;
  insert into public.learning_preferences (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Atomically record a quiz answer against a topic (runs as the caller, so RLS applies)
create or replace function public.record_topic_result(p_topic text, p_correct boolean)
returns void language sql security invoker as $$
  insert into public.topic_performance (user_id, topic, attempts, correct, updated_at)
  values (auth.uid(), p_topic, 1, case when p_correct then 1 else 0 end, now())
  on conflict (user_id, topic) do update
    set attempts = topic_performance.attempts + 1,
        correct = topic_performance.correct + (case when p_correct then 1 else 0 end),
        updated_at = now();
$$;

-- "My Study DNA" -> reset learning history (keeps account, documents and preferences)
create or replace function public.reset_learning_history()
returns void language plpgsql security invoker as $$
begin
  delete from public.topic_performance where user_id = auth.uid();
  delete from public.quiz_attempts where user_id = auth.uid();   -- cascades attempt_answers
  delete from public.study_sessions where user_id = auth.uid();
  delete from public.tutor_messages where user_id = auth.uid();
  update public.flashcards set rating = 'new', review_count = 0, last_reviewed_at = null
    where user_id = auth.uid();
  update public.study_tasks set status = 'pending', completed_at = null where user_id = auth.uid();
end $$;

-- Delete ALL of the student's data (account row in auth.users is removed by the delete-account step in Settings)
create or replace function public.delete_my_data()
returns void language plpgsql security invoker as $$
begin
  delete from public.saved_outputs where user_id = auth.uid();
  delete from public.tutor_messages where user_id = auth.uid();
  delete from public.study_sessions where user_id = auth.uid();
  delete from public.topic_performance where user_id = auth.uid();
  delete from public.study_tasks where user_id = auth.uid();
  delete from public.study_plans where user_id = auth.uid();
  delete from public.flashcard_decks where user_id = auth.uid();   -- cascades flashcards
  delete from public.quizzes where user_id = auth.uid();           -- cascades questions/attempts/answers
  delete from public.summaries where user_id = auth.uid();
  delete from public.documents where user_id = auth.uid();
end $$;
