import type { TravelDocument, Trip } from "./types";

function safeName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || "travel";
}

export function downloadBlob(blob: Blob, filename: string): void {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}

export function exportJson(document: TravelDocument): void {
  downloadBlob(new Blob([JSON.stringify(document, null, 2)], { type: "application/json" }), "travel-card-backup.json");
}

export function exportTripHtml(trip: Trip, markup: string, styles: string): void {
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${trip.title}</title><style>${styles}\nbody{padding:24px}.export-hide{display:none!important}.export-only{display:block!important}.trip-heading{display:none!important}.app-shell{min-height:auto}.trip-page{max-width:1180px;margin:auto}.trip-workspace{display:block}.city-strip>div{grid-template-columns:repeat(4,minmax(0,1fr));overflow:hidden}.city-cover-card{min-width:0}</style></head><body>${markup}</body></html>`;
  downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `${safeName(trip.title)}.html`);
}

export async function exportElementPng(element: HTMLElement, filename: string, styles: string): Promise<void> {
  const rect = element.getBoundingClientRect();
  const width = Math.ceil(Math.max(rect.width, element.scrollWidth));
  const height = Math.ceil(Math.max(rect.height, element.scrollHeight));
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".export-hide").forEach((node) => node.remove());
  const wrapper = document.createElement("div");
  wrapper.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  wrapper.style.width = `${width}px`;
  wrapper.style.minHeight = `${height}px`;
  wrapper.style.background = "#f4efe7";
  const style = document.createElement("style");
  style.textContent = `${styles}\n.export-hide{display:none!important}.export-only{display:block!important}.trip-heading{display:none!important}.trip-workspace{display:block}.city-strip>div{grid-template-columns:repeat(4,minmax(0,1fr));overflow:hidden}.city-cover-card{min-width:0}`;
  wrapper.appendChild(style);
  wrapper.appendChild(clone);
  const serialized = new XMLSerializer().serializeToString(wrapper);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${serialized}</foreignObject></svg>`;
  const image = new Image();
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("图片暂时无法生成"));
    image.src = url;
  });
  const scale = Math.min(2, 4096 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("图片暂时无法生成");
  context.scale(scale, scale);
  context.fillStyle = "#f4efe7";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("图片暂时无法生成"))), "image/png", 1));
  downloadBlob(blob, `${safeName(filename)}.png`);
}
