import type { City, Place } from "./types";
import { appleMapsUrl } from "./maps";

export function cityGuidePlaces(city: City): Place[] {
  const seen = new Set<string>();
  return city.days.flatMap((day) => day.places).filter((place) => { const key = (place.mapQuery || place.mapUrl || place.name).trim().toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; });
}
export function validAppleGuideUrl(value: string): string {
  if (!value.trim()) return "";
  const url = new URL(value.trim());
  if (url.protocol !== "https:" || !["maps.apple.com", "maps.apple"].includes(url.hostname) || url.username || url.password) throw new Error("请粘贴 Apple 地图分享的 HTTPS 指南链接");
  return url.href;
}
export function cityGuideText(city: City): string {
  return `${city.name} · 旅行地点集\n${cityGuidePlaces(city).map((place,index) => `${index+1}. ${place.name} · ${place.category}\n${place.summary || ""}\n${appleMapsUrl(place,city)}`).join("\n\n")}`;
}
export function cityGuideHtml(city: City): string {
  const escape = (text: string) => text.replace(/[&<>"']/g, (ch) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]!));
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(city.name)}地点集</title><style>body{font:16px/1.7 system-ui;background:#f4efd8;color:#1a2744;max-width:720px;margin:auto;padding:24px}article{background:#fffaf0;border:2px solid #1a2744;border-radius:20px;padding:20px;margin:16px 0}a{color:#2364a7}p{white-space:pre-wrap}</style><h1>${escape(city.name)} · 地点集</h1><p>地点与看点可离线阅读；打开 Apple 地图需要网络或已下载的离线地图。</p>${cityGuidePlaces(city).map((place,index) => `<article><small>${escape(place.category)}</small><h2>${index+1}. ${escape(place.name)}</h2><p>${escape(place.summary || "")}</p><a href="${escape(appleMapsUrl(place,city))}">在 Apple 地图查找</a></article>`).join("")}</html>`;
}
