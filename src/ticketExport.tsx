import { renderToStaticMarkup } from "react-dom/server";
import type { Trip } from "./types";
import { TicketQrs, TicketCard } from "./components";
import { sortTickets, ticketAttachments } from "./tickets";
import { downloadBlob } from "./exporters";

async function embeddedImage(src: string): Promise<string> {
  if (src.startsWith("data:image/")) return src;
  const response = await fetch(src);
  if (!response.ok) throw new Error("有图片尚未下载，联网后再导出完整票夹");
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("有图片无法打包，请重新上传这张图片");
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
}

export async function exportTicketsHtml(trip: Trip, styles: string): Promise<void> {
  const tickets = sortTickets(trip.tickets, trip.startDate);
  const sections: string[] = [];
  for (const ticket of tickets) {
    const files = [...ticketAttachments(ticket)];
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      if (file.type === "pdf" && !file.pages?.length) {
        const response = await fetch(file.data);
        if (!response.ok) throw new Error(`无法打包 ${file.name}`);
        const { prepareTicketFile } = await import("./ticketFiles");
        files[index] = await prepareTicketFile(new File([await response.blob()], file.name + ".pdf", { type: "application/pdf" }));
      }
    }
    sections.push(renderToStaticMarkup(<section className="offline-ticket"><TicketCard ticket={ticket} city={trip.cities.find((city) => city.id === ticket.cityId)} onEdit={() => {}} onRemove={() => {}} onPreview={() => {}} /><details><summary>展开完整票据 / 二维码 · {files.length} 份附件</summary><div className="ticket-full-preview"><TicketQrs ticket={ticket} />{files.map((file) => <section key={file.id}><h3>{file.name}</h3><a href={file.data} download={file.name}>保存原始文件</a>{file.type === "image" ? <img src={file.data} alt={file.name} /> : file.pages?.map((page, index) => <figure key={index}><img src={page} alt={`第 ${index + 1} 页`} /><figcaption>第 {index + 1} / {file.pages!.length} 页</figcaption></figure>)}</section>)}</div></details></section>));
  }
  const body = document.createElement("main"); body.innerHTML = sections.join("");
  const cache = new Map<string, string>();
  for (const img of Array.from(body.querySelectorAll("img"))) {
    const src = img.getAttribute("src") || "";
    if (!cache.has(src)) cache.set(src, await embeddedImage(src));
    img.setAttribute("src", cache.get(src)!);
  }
  // Static React preload hints are unnecessary: every image is now embedded.
  body.querySelectorAll("link").forEach((node) => node.remove());
  body.querySelectorAll(".export-hide").forEach((node) => node.remove());
  const title = trip.title.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · 离线票夹</title><style>${styles.replace(/<\/style/gi, "<\\/style")}\nbody{padding:24px;background:var(--paper)}main{max-width:1000px;margin:auto}.offline-ticket{margin:30px 0}.offline-ticket details{margin-top:12px;border:2px solid var(--ink);border-radius:16px;padding:16px}.offline-ticket summary{cursor:pointer;font-weight:700}.ticket-card{content-visibility:visible}.export-hide{display:none!important}button{cursor:default}.ticket-qr-button,.ticket-attachment-button{pointer-events:none}@media(max-width:600px){body{padding:10px}}@media print{details:not([open])>div{display:block!important}}</style></head><body><main><h1>${title} · 票据夹</h1><p>图片、二维码与全部 PDF 页面已保存在本文件内。点开每张票下方的“展开完整票据”即可查看。</p>${body.innerHTML}</main></body></html>`;
  downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `${trip.title.replace(/[\\/:*?"<>|]/g, "-")}-完整离线票夹.html`);
}
