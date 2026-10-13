import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Preferences, Profile } from "../types";

interface AppState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  prefs: Preferences | null;
  loading: boolean;
  theme: "light" | "dark";
  toggleTheme: () => void;
  refresh: () => Promise<void>;
  updateProfile: (p: Partial<Profile>) => Promise<string | null>;
  updatePrefs: (p: Partial<Preferences>) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    document.documentElement.classList.contains("dark") ? "dark" : "light",
  );

  const user = session?.user ?? null;

  const load = useCallback(async (uid: string) => {
    const [p, pr] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("learning_preferences").select("*").eq("user_id", uid).maybeSingle(),
    ]);
    setProfile((p.data as Profile) ?? null);
    setPrefs((pr.data as Preferences) ?? null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await load(data.session.user.id);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      if (s) void load(s.user.id);
      else {
        setProfile(null);
        setPrefs(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      try {
        localStorage.setItem("studymate-theme", next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo<AppState>(
    () => ({
      user,
      session,
      profile,
      prefs,
      loading,
      theme,
      toggleTheme,
      refresh: async () => {
        if (user) await load(user.id);
      },
      updateProfile: async (p) => {
        if (!user) return "Not signed in.";
        const { error } = await supabase.from("profiles").update(p).eq("id", user.id);
        if (error) return error.message;
        setProfile((prev) => (prev ? { ...prev, ...p } : prev));
        return null;
      },
      updatePrefs: async (p) => {
        if (!user) return "Not signed in.";
        const { error } = await supabase
          .from("learning_preferences")
          .upsert({ user_id: user.id, ...(prefs ?? {}), ...p, updated_at: new Date().toISOString() });
        if (error) return error.message;
        setPrefs((prev) => ({ ...(prev as Preferences), user_id: user.id, ...p }));
        return null;
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [user, session, profile, prefs, loading, theme, toggleTheme, load],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp must be used inside AppProvider");
  return c;
}

/** Log a study session (used for streaks, weekly chart and Study DNA). Failures are non-fatal. */
export async function logSession(userId: string, kind: string, minutes: number) {
  await supabase.from("study_sessions").insert({ user_id: userId, kind, minutes });
}
