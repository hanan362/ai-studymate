import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { DocumentRow } from "../types";

export function useDocuments() {
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const { data, error } = await supabase.from("documents").select("*").order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setDocs((data ?? []) as DocumentRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { docs, loading, error, reload };
}
