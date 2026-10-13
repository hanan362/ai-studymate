import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { addDays, todayStr } from "../lib/utils";
import type { StudySession, StudyTask, TopicPerformance } from "../types";

export interface Stats {
  topics: TopicPerformance[];
  sessions: StudySession[];
  todayTasks: StudyTask[];
  allTasks: { status: string }[];
  cardRatings: { new: number; easy: number; practice: number; difficult: number };
  quizCount: number;
  streak: number;
  weekly: { day: string; minutes: number }[];
  weakTopics: (TopicPerformance & { accuracy: number })[];
  loading: boolean;
  reload: () => Promise<void>;
}

const empty = { new: 0, easy: 0, practice: 0, difficult: 0 };

export function useStats(): Stats {
  const [topics, setTopics] = useState<TopicPerformance[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [todayTasks, setTodayTasks] = useState<StudyTask[]>([]);
  const [allTasks, setAllTasks] = useState<{ status: string }[]>([]);
  const [cardRatings, setCardRatings] = useState(empty);
  const [quizCount, setQuizCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const since = addDays(todayStr(), -60) + "T00:00:00";
    const [t, s, tt, at, fc, qa] = await Promise.all([
      supabase.from("topic_performance").select("topic,attempts,correct"),
      supabase.from("study_sessions").select("id,kind,minutes,created_at").gte("created_at", since).order("created_at", { ascending: false }),
      supabase.from("study_tasks").select("*").eq("task_date", todayStr()),
      supabase.from("study_tasks").select("status"),
      supabase.from("flashcards").select("rating"),
      supabase.from("quiz_attempts").select("id", { count: "exact", head: true }),
    ]);
    setTopics((t.data ?? []) as TopicPerformance[]);
    setSessions((s.data ?? []) as StudySession[]);
    setTodayTasks((tt.data ?? []) as StudyTask[]);
    setAllTasks((at.data ?? []) as { status: string }[]);
    const c = { ...empty };
    (fc.data ?? []).forEach((r: { rating: keyof typeof empty }) => (c[r.rating] += 1));
    setCardRatings(c);
    setQuizCount(qa.count ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Group sessions by LOCAL calendar day
  const minutesByDay = new Map<string, number>();
  sessions.forEach((x) => {
    const d = todayStr(new Date(x.created_at));
    minutesByDay.set(d, (minutesByDay.get(d) ?? 0) + x.minutes);
  });

  let streak = 0;
  let cursor = todayStr();
  if (!minutesByDay.has(cursor)) cursor = addDays(cursor, -1); // today may not be studied yet
  while (minutesByDay.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  const weekly = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(todayStr(), i - 6);
    return { day: new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" }), minutes: minutesByDay.get(d) ?? 0 };
  });

  const weakTopics = topics
    .filter((t) => t.attempts >= 2)
    .map((t) => ({ ...t, accuracy: Math.round((t.correct / t.attempts) * 100) }))
    .filter((t) => t.accuracy < 60)
    .sort((a, b) => a.accuracy - b.accuracy);

  return { topics, sessions, todayTasks, allTasks, cardRatings, quizCount, streak, weekly, weakTopics, loading, reload };
}
