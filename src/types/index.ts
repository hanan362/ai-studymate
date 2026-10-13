export type Lang = "english" | "roman_urdu";
export type NoteStyle = "short" | "detailed" | "exam";
export type Difficulty = "beginner" | "intermediate" | "advanced";
export type Rating = "new" | "easy" | "practice" | "difficult";

export interface Profile {
  id: string;
  full_name: string;
  university: string | null;
  degree: string | null;
  semester: number | null;
  onboarded: boolean;
}

export interface Preferences {
  user_id: string;
  language: Lang;
  note_style: NoteStyle;
  beginner_mode: boolean;
  study_dna_enabled: boolean;
}

export interface DocumentRow {
  id: string;
  title: string;
  subject: string | null;
  file_path: string | null;
  file_type: string;
  size_bytes: number;
  extracted_text: string;
  created_at: string;
}

export interface SummaryRow {
  id: string;
  document_id: string;
  style: NoteStyle;
  language: Lang;
  content: string;
  created_at: string;
}

export interface Quiz {
  id: string;
  document_id: string | null;
  title: string;
  difficulty: Difficulty;
  created_at: string;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  position: number;
  topic: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

export interface Deck {
  id: string;
  document_id: string | null;
  title: string;
  created_at: string;
}

export interface Flashcard {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  topic: string;
  rating: Rating;
  review_count: number;
  last_reviewed_at: string | null;
}

export interface StudyTask {
  id: string;
  plan_id: string;
  subject: string;
  title: string;
  kind: "study" | "revision" | "practice";
  task_date: string; // YYYY-MM-DD
  duration_min: number;
  status: "pending" | "done" | "missed";
  completed_at: string | null;
}

export interface TopicPerformance {
  topic: string;
  attempts: number;
  correct: number;
}

export interface StudySession {
  id: string;
  kind: string;
  minutes: number;
  created_at: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Recommendation {
  title: string;
  reason: string;
  action: "tutor" | "notes" | "quiz" | "flashcards" | "planner";
}
