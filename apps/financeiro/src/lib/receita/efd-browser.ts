"use client";
import { efdPageText, parseEfdResumo } from "./efd";

export async function readEfdPdf(file: File, progress: (message: string) => void) {
  if (!file.name.toLowerCase().endsWith(".pdf") || file.size > 50 * 1024 * 1024) throw new Error("Selecione um PDF de até 50 MB.");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `/financeiro/pdf.worker.min.mjs?v=${pdfjs.version}`;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  try {
    if (doc.numPages > 2000) throw new Error("O limite é de 2.000 páginas por arquivo.");
    const relevant: string[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      progress(`Lendo página ${p} de ${doc.numPages}…`);
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const text = efdPageText(content.items.flatMap(item => "str" in item ? [{ str: item.str, transform: item.transform }] : []));
      // Only four summary pages cross the network, not the 542-page source file.
      if (/RESUMO DAS CONTRIBUI|DEMONSTRATIVO DA APURA/i.test(text)) relevant.push(text);
      page.cleanup();
    }
    const text = relevant.join("\n");
    return { text, resumo: parseEfdResumo(text) };
  } finally { await task.destroy(); }
}
