import { Link } from "react-router-dom";
import type { DocumentRow } from "../types";

export default function DocPicker({ docs, value, onChange, id = "doc" }: { docs: DocumentRow[]; value: string; onChange: (id: string) => void; id?: string }) {
  if (!docs.length)
    return (
      <p className="text-sm text-slate-500">
        You have no notes yet. <Link to="/app/notes" className="font-semibold text-brand-600 hover:underline">Upload some first</Link>.
      </p>
    );
  return (
    <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Choose notes">
      <option value="">Select a document…</option>
      {docs.map((d) => (
        <option key={d.id} value={d.id}>{d.title}</option>
      ))}
    </select>
  );
}
