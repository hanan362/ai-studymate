export const todayStr = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const addDays = (dateStr: string, n: number) => {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return todayStr(d);
};

export const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Please try again.");

export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

export const SUBJECTS = [
  "Data Structures & Algorithms",
  "Object-Oriented Programming",
  "Database Systems",
  "Operating Systems",
  "Computer Networks",
  "Discrete Mathematics",
  "Software Engineering",
  "Artificial Intelligence",
  "Web Development",
  "Theory of Automata",
];
