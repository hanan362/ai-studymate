import { supabase } from "./supabase";

/** All AI calls go through the `ai` Supabase Edge Function; the model API key never reaches the browser. */
export async function callAI<T = Record<string, unknown>>(action: string, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("ai", { body: { action, ...payload } });
  if (error) {
    // Try to surface the function's own error message
    let message = "The AI request failed. Check your connection and try again.";
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const j = await ctx.json();
        if (j?.error) message = String(j.error);
      } catch {
        /* ignore */
      }
    } else if (error.message) {
      message = error.message;
    }
    throw new Error(message);
  }
  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
    throw new Error(String((data as { error: string }).error));
  }
  return data as T;
}
