import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { City, DayPlan, Place, PlaceCategory, Trip } from "./types";
import { uid } from "./types";
import { cityDateRange, sortCitiesByDate } from "./dates";

type JsonRecord = Record<string, unknown>;
const categories: PlaceCategory[] = ["景点", "美食", "交通", "住宿", "购物"];
const record = (value: unknown): JsonRecord => value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;

function mime(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase();
  return extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : extension === "gif" ? "image/gif" : extension === "heic" || extension === "heif" ? "image/heic" : "image/jpeg";
}

export async function importTripPackage(file: File): Promise<Trip> {
  if (file.size > 120 * 1024 * 1024) throw new Error("素材包请控制在 120MB 以内");
  const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const manifestName = Object.keys(archive).find((name) => name.toLowerCase().endsWith("trip.json"));
  if (!manifestName) throw new Error("ZIP 中没有找到 trip.json");
  const root = record(JSON.parse(strFromU8(archive[manifestName])));
  const asset = (path: unknown): string | undefined => {
    const name = text(path).replace(/^\.\//, "");
    if (!name) return undefined;
    if (name.startsWith("data:image/")) return name;
    const exact = archive[name] || archive[Object.keys(archive).find((entry) => entry.endsWith(`/${name}`)) || ""];
    return exact ? `data:${mime(name)};base64,${bytesToBase64(exact)}` : undefined;
  };
  const cities = list(root.cities).map((rawCity): City => {
    const source = record(rawCity);
    const startDate = text(source.startDate);
    const endDate = text(source.endDate, startDate);
    const days = list(source.days).map((rawDay): DayPlan => {
      const day = record(rawDay);
      const places = list(day.places).map((rawPlace): Place => {
        const place = record(rawPlace);
        const images = list(place.images).map(asset).filter((value): value is string => !!value).slice(0, 12);
        const category = text(place.category, "景点") as PlaceCategory;
        return { id: uid("place"), name: text(place.name, "待补地点"), mapQuery: text(place.mapQuery), category: categories.includes(category) ? category : "景点", time: text(place.time, "待安排"), endTime: text(place.endTime), duration: text(place.duration, "待安排"), summary: text(place.summary), highlights: list(place.highlights).map((item) => text(item)).filter(Boolean), mapUrl: text(place.mapUrl), image: images[0], gallery: images.slice(1) };
      });
      return { id: uid("day"), date: text(day.date, "Day 1"), weekday: text(day.weekday), title: text(day.title, "顺路的一天"), places: places.sort((a, b) => a.time.localeCompare(b.time)) };
    });
    return { id: uid("city"), name: text(source.name, "新的城市"), englishName: text(source.englishName, text(source.name, "New city")), country: text(source.country), startDate, endDate, dates: text(source.dates, cityDateRange(startDate, endDate)), note: text(source.note, "给这座城市留一点偶遇。"), color: text(source.color, "#e8c547"), cover: asset(source.cover), journal: [], days };
  });
  if (!cities.length) throw new Error("trip.json 至少需要一座城市");
  const startDate = text(root.startDate, cities[0].startDate || "待定");
  return { id: uid("trip"), title: text(root.title, "导入的旅行"), startDate, endDate: text(root.endDate, cities.at(-1)?.endDate || startDate), subtitle: text(root.subtitle, "从素材包整理的旅程"), cover: asset(root.cover), cities: sortCitiesByDate(cities, startDate), tickets: [], expenses: [], track: { title: "", artist: "", reason: "", url: "" }, chats: [{ id: uid("chat"), role: "assistant", content: "素材包已经整理完成。", createdAt: new Date().toISOString() }], updatedAt: new Date().toISOString() };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

export function downloadTripPackageTemplate(): void {
  const template = {
    title: "我的欧洲旅行", startDate: "2026-09-24", endDate: "2026-10-06", subtitle: "城市、美食与慢火车", cover: "images/trip-cover.jpg",
    cities: [{ name: "布鲁塞尔", englishName: "Brussels", country: "Belgium", startDate: "2026-09-24", endDate: "2026-09-25", note: "大广场、漫画墙与啤酒馆。", color: "#e8c547", cover: "images/brussels-cover.jpg", days: [{ date: "2026-09-24", weekday: "周四", title: "老城漫步", places: [{ name: "布鲁塞尔大广场", mapQuery: "Grand Place, Brussels, Belgium", category: "景点", time: "15:00", endTime: "16:30", duration: "1.5 小时", summary: "从市政厅尖塔开始认识布鲁塞尔。", highlights: ["市政厅", "行会建筑", "蓝调时刻"], images: ["images/brussels/grand-place-1.jpg", "images/brussels/grand-place-2.jpg"] }] }] }],
  };
  const guide = "1. 编辑 trip.json。\n2. 把照片放进 images 文件夹，路径与 JSON 完全一致。\n3. 将 trip.json 和 images 一起压缩成 ZIP。\n4. 在旅卡设置中选择“导入素材包”，确认后覆盖当前旅行。\n每个地点最多读取 12 张图片；城市会按 startDate 自动排序。";
  const zipped = zipSync({ "trip.json": strToU8(JSON.stringify(template, null, 2)), "使用说明.txt": strToU8(guide) }, { level: 6 });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([Uint8Array.from(zipped).buffer], { type: "application/zip" }));
  link.download = "旅卡批量导入模板.zip";
  link.click();
  URL.revokeObjectURL(link.href);
}
