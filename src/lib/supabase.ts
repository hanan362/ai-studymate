import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isConfigured = Boolean(url && anon);

// Falls back to placeholders so the UI can show a helpful setup screen instead of crashing.
export const supabase = createClient(url ?? "https://placeholder.supabase.co", anon ?? "placeholder-anon-key", {
  auth: { persistSession: true, autoRefreshToken: true },
});
