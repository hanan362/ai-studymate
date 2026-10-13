import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useApp } from "../hooks/useApp";
import { ErrorBanner, PageHeader, Segmented } from "../components/ui";
import { errMsg } from "../lib/utils";
import type { Lang, NoteStyle } from "../types";

export default function SettingsPage() {
  const { user, profile, prefs, updateProfile, updatePrefs, signOut, theme, toggleTheme } = useApp();
  const nav = useNavigate();
  const [name, setName] = useState(profile?.full_name ?? "");
  const [university, setUniversity] = useState(profile?.university ?? "");
  const [semester, setSemester] = useState(profile?.semester ?? 1);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(profile?.full_name ?? "");
    setUniversity(profile?.university ?? "");
    setSemester(profile?.semester ?? 1);
  }, [profile]);

  const saveProfile = async () => {
    setError(null);
    setMsg(null);
    if (name.trim().length < 2) return setError("Please enter your name.");
    const e = await updateProfile({ full_name: name.trim(), university: university.trim() || null, semester });
    if (e) setError(e);
    else setMsg("Profile saved.");
  };

  const setPref = async (p: Partial<{ language: Lang; note_style: NoteStyle; study_dna_enabled: boolean }>) => {
    const e = await updatePrefs(p);
    if (e) setError(e);
  };

  const logout = async () => {
    await signOut();
    nav("/");
  };

  const reset = async () => {
    if (!confirm("Reset your learning history (quiz results, topic stats, sessions, chats, flashcard ratings)?")) return;
    const { error } = await supabase.rpc("reset_learning_history");
    setMsg(error ? null : "Learning history reset.");
    if (error) setError(error.message);
  };

  const deleteAll = async () => {
    if (!confirm("Permanently delete ALL your documents, notes, quizzes, flashcards, plans and learning data? This cannot be undone.")) return;
    try {
      const { data: files } = await supabase.from("documents").select("file_path").not("file_path", "is", null);
      const paths = (files ?? []).map((f) => f.file_path as string);
      if (paths.length) await supabase.storage.from("documents").remove(paths);
      const { error } = await supabase.rpc("delete_my_data");
      if (error) throw error;
      setMsg("All your study data was deleted. Your login account still exists — contact the administrator to remove it fully.");
    } catch (e) {
      setError(errMsg(e));
    }
  };

  return (
    <>
      <PageHeader title="Profile & settings" />
      <div className="space-y-4">
        <ErrorBanner message={error} onClose={() => setError(null)} />
        {msg && <div role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{msg}</div>}

        <section className="card space-y-3" aria-labelledby="prof">
          <h2 id="prof" className="font-semibold">Profile</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="pn">Name</label><input id="pn" className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><label className="label" htmlFor="pe">Email</label><input id="pe" className="input" value={user?.email ?? ""} disabled /></div>
            <div><label className="label" htmlFor="pu">University</label><input id="pu" className="input" value={university} onChange={(e) => setUniversity(e.target.value)} /></div>
            <div>
              <label className="label" htmlFor="ps">Semester</label>
              <select id="ps" className="input" value={semester} onChange={(e) => setSemester(Number(e.target.value))}>
                {Array.from({ length: 8 }, (_, i) => i + 1).map((s) => <option key={s} value={s}>Semester {s}</option>)}
              </select>
            </div>
          </div>
          <button className="btn-primary" onClick={saveProfile}>Save profile</button>
        </section>

        <section className="card space-y-4" aria-labelledby="pref">
          <h2 id="pref" className="font-semibold">Learning preferences</h2>
          <div><span className="label">Explanation language</span><Segmented label="Explanation language" value={prefs?.language ?? "english"} onChange={(v) => setPref({ language: v })} options={[{ value: "english", label: "English" }, { value: "roman_urdu", label: "Roman Urdu" }]} /></div>
          <div><span className="label">Default note style</span><Segmented label="Default note style" value={prefs?.note_style ?? "detailed"} onChange={(v) => setPref({ note_style: v })} options={[{ value: "short", label: "Short" }, { value: "detailed", label: "Detailed" }, { value: "exam", label: "Exam-oriented" }]} /></div>
          <div><span className="label">Appearance</span><Segmented label="Theme" value={theme} onChange={() => toggleTheme()} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} /></div>
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={prefs?.study_dna_enabled ?? true} onChange={(e) => setPref({ study_dna_enabled: e.target.checked })} />
            Enable My Study DNA recommendations
          </label>
        </section>

        <section className="card space-y-3" aria-labelledby="priv">
          <h2 id="priv" className="font-semibold">Your data</h2>
          <p className="text-sm text-slate-500">Your files and records are private to your account. You can clear your learning history or delete everything at any time.</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={reset}>Reset learning history</button>
            <button className="btn-danger" onClick={deleteAll}>Delete all my data</button>
          </div>
        </section>

        <button className="btn-secondary" onClick={logout}><LogOut className="h-4 w-4" aria-hidden /> Log out</button>
      </div>
    </>
  );
}
