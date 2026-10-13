// Client-side text extraction + file validation.
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB (also enforced by the storage bucket)
export const ALLOWED_EXT = ["pdf", "txt", "md"] as const;

export function validateFile(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!(ALLOWED_EXT as readonly string[]).includes(ext)) return "Unsupported file type. Please upload a PDF, TXT or MD file.";
  if (file.size === 0) return "This file is empty.";
  if (file.size > MAX_FILE_BYTES) return "File is too large. The limit is 10 MB.";
  return null;
}

export async function extractText(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "txt" || ext === "md") return (await file.text()).trim();
  if (ext === "pdf") {
    const pdfjs = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= Math.min(pdf.numPages, 150); i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((it) => ("str" in it ? it.str : "")).join(" "));
    }
    return pages.join("\n\n").replace(/[ \t]+/g, " ").trim();
  }
  throw new Error("Unsupported file type.");
}
