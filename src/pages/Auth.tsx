import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { GraduationCap, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { ErrorBanner } from "../components/ui";
import { errMsg } from "../lib/utils";

export default function Auth() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">(params.get("mode") === "signup" ? "signup" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const validate = (): string | null => {
    if (mode === "signup" && name.trim().length < 2) return "Please enter your full name.";
    if (!/^\S+@\S+\.\S+$/.test(email)) return "Please enter a valid email address.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    return null;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const v = validate();
    if (v) return setError(v);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name.trim() } } });
        if (error) throw error;
        if (!data.session) {
          setInfo("Account created! Check your email to confirm your address, then log in.");
          setMode("login");
        } else nav("/onboarding");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav("/app");
      }
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2 text-lg font-bold">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <GraduationCap className="h-5 w-5" aria-hidden />
          </div>
          AI StudyMate
        </Link>
        <div className="card">
          <h1 className="text-xl font-bold">{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{mode === "signup" ? "Start studying smarter in under a minute." : "Log in to continue learning."}</p>

          <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
            {mode === "signup" && (
              <div>
                <label className="label" htmlFor="name">Full name</label>
                <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </div>
            )}
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
              {mode === "signup" && <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>}
            </div>
            <ErrorBanner message={error} />
            {info && <div role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{info}</div>}
            <button className="btn-primary w-full" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {mode === "signup" ? "Sign up" : "Log in"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-600 dark:text-slate-400">
            {mode === "signup" ? "Already have an account?" : "New to AI StudyMate?"}{" "}
            <button
              className="font-semibold text-brand-600 hover:underline"
              onClick={() => {
                setMode(mode === "signup" ? "login" : "signup");
                setError(null);
              }}
            >
              {mode === "signup" ? "Log in" : "Create an account"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
