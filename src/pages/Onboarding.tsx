import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { useApp } from "../hooks/useApp";
import { ErrorBanner, Segmented } from "../components/ui";
import type { Lang } from "../types";

export default function Onboarding() {
  const { profile, updateProfile, updatePrefs } = useApp();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile?.full_name ?? "");
  const [university, setUniversity] = useState(profile?.university ?? "");
  const [semester, setSemester] = useState<number>(profile?.semester ?? 1);
  const [language, setLanguage] = useState<Lang>("english");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    setBusy(true);
    setError(null);
    const e1 = await updateProfile({ full_name: name.trim(), university: university.trim() || null, semester, onboarded: true });
    const e2 = await updatePrefs({ language });
    setBusy(false);
    if (e1 || e2) return setError(e1 ?? e2);
    nav("/app");
  };

  const next = () => {
    if (step === 0 && name.trim().length < 2) return setError("Please enter your name.");
    setError(null);
    setStep(step + 1);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="card w-full max-w-lg">
        <div className="mb-5 flex items-center gap-2 font-bold">
          <GraduationCap className="h-5 w-5 text-brand-600" aria-hidden /> Let's set up AI StudyMate
        </div>
        <div className="mb-5 flex gap-1.5" aria-label={`Step ${step + 1} of 3`}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-brand-500" : "bg-slate-200 dark:bg-slate-800"}`} />
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <h1 className="text-xl font-bold">What should we call you?</h1>
            <div>
              <label className="label" htmlFor="n">Your name</label>
              <input id="n" className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="u">University (optional)</label>
              <input id="u" className="input" value={university} onChange={(e) => setUniversity(e.target.value)} placeholder="e.g. BZU Multan" />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h1 className="text-xl font-bold">Which semester are you in?</h1>
            <select className="input" value={semester} onChange={(e) => setSemester(Number(e.target.value))} aria-label="Semester">
              {Array.from({ length: 8 }, (_, i) => i + 1).map((s) => (
                <option key={s} value={s}>Semester {s}</option>
              ))}
            </select>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h1 className="text-xl font-bold">How do you prefer explanations?</h1>
            <p className="text-sm text-slate-500">You can change this anytime in Settings. Technical terms stay in English.</p>
            <Segmented label="Explanation language" value={language} onChange={setLanguage} options={[{ value: "english", label: "English" }, { value: "roman_urdu", label: "Roman Urdu" }]} />
          </div>
        )}

        <div className="mt-5">
          <ErrorBanner message={error} />
        </div>
        <div className="mt-5 flex justify-between">
          <button className="btn-secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
          {step < 2 ? (
            <button className="btn-primary" onClick={next}>Continue</button>
          ) : (
            <button className="btn-primary" onClick={finish} disabled={busy}>{busy ? "Saving…" : "Start learning"}</button>
          )}
        </div>
      </div>
    </div>
  );
}
