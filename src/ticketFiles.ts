import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { TicketAttachment } from "./types";
import { uid } from "./types";

GlobalWorkerOptions.workerSrc = workerUrl;

export function readTicketData(file: File): Promise<string> {
  if (file.size > 20 * 1024 * 1024) return Promise.reject(new Error("单份文件请控制在 20MB 以内"));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

export async function prepareTicketFile(file: File): Promise<TicketAttachment> {
  const data = await readTicketData(file);
  const type = file.type === "application/pdf" || /\.pdf$/i.test(file.name) ? "pdf" : "image";
  if (type === "image" && !file.type.startsWith("image/")) throw new Error("请选择图片或 PDF");
  const attachment: TicketAttachment = { id: uid("attachment"), name: file.name, data, type };
  if (type === "pdf") {
    const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    const doc = await task.promise;
    try {
      if (doc.numPages > 30) throw new Error("请将 PDF 拆分为每份不超过 30 页");
      const pages: string[] = []; const texts: string[] = [];
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        const viewport = page.getViewport({ scale: Math.min(2, 1600 / page.getViewport({ scale: 1 }).width) });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, viewport }).promise;
        pages.push(canvas.toDataURL("image/png"));
        const content = await page.getTextContent();
        texts.push(content.items.map((item) => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join(""));
        canvas.width = 0; canvas.height = 0;
        page.cleanup();
      }
      attachment.pages = pages; attachment.text = texts.join("\n\n");
    } finally { await task.destroy(); }
  }
  return attachment;
}

export async function ticketText(attachments: TicketAttachment[], progress: (text: string) => void): Promise<string> {
  const results: string[] = [];
  const images: string[] = [];
  for (const file of attachments) {
    if (file.text?.trim()) results.push(file.text);
    else if (file.type === "image") images.push(file.data);
    else images.push(...(file.pages || []));
  }
  if (images.length) {
    progress("正在加载文字识别，首次使用需要联网…");
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng+chi_sim", 1, { logger: (message) => { if (message.status === "recognizing text") progress(`正在读取票据文字 ${Math.round(message.progress * 100)}%`); } });
    try {
      for (const image of images) results.push((await worker.recognize(image)).data.text);
    } finally { await worker.terminate(); }
  }
  const text = results.join("\n\n").trim();
  if (!text) throw new Error("没有读取到文字，请改用清晰图片或直接填写");
  return text.slice(0, 24000);
}
