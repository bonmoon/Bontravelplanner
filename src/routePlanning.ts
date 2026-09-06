import type { City, Place } from "./types";

export interface OptimizedDay {
  dayId: string;
  title: string;
  placeIds: string[];
  note: string;
  times: Record<string, { time: string; endTime: string }>;
}
const minutes = (text = "") => { const m = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/); return m ? Number(m[1]) * 60 + Number(m[2]) : undefined; };
const clock = (n: number) => `${Math.floor(n / 60).toString().padStart(2, "0")}:${(n % 60).toString().padStart(2, "0")}`;
function duration(place: Place): number {
  const start = minutes(place.time), end = minutes(place.endTime);
  if (start !== undefined && end !== undefined && end > start) return end - start;
  const text = place.duration || "";
  const hour = text.match(/([\d.]+)\s*(?:小时|小時|hours?|h\b)/i), minute = text.match(/(\d+)\s*(?:分钟|分鐘|min)/i);
  return Math.min(480, Math.max(15, hour ? Math.round(Number(hour[1]) * 60) : minute ? Number(minute[1]) : text.includes("半小时") ? 30 : 60));
}

// Keep locked stops in their original slots. Travel buffers are suggestions, not live directions.
export function normalizeRoute(city: City, rawDays: unknown, preview = false): OptimizedDay[] {
  if (!Array.isArray(rawDays)) throw new Error("模型没有返回路线列表，请重试；原行程未更改");
  let recognized = 0;
  const output = city.days.map((day) => {
    const raw = rawDays.find((value) => value && (value.dayId === day.id || value.dayId === day.date || value.date === day.date)) as { title?: string; placeIds?: unknown[]; note?: string; times?: OptimizedDay["times"] } | undefined;
    const byId = new Map(day.places.map((place) => [place.id, place]));
    const ids: string[] = [];
    for (const value of Array.isArray(raw?.placeIds) ? raw.placeIds : []) {
      const key = String(value);
      const matches = day.places.filter((place) => place.name === key);
      const place = byId.get(key) || (matches.length === 1 ? matches[0] : undefined);
      if (place && !ids.includes(place.id)) { ids.push(place.id); recognized++; }
    }
    const missing = day.places.filter((place) => !ids.includes(place.id));
    ids.push(...missing.map((place) => place.id));
    const movable = ids.map((id) => byId.get(id)!).filter((place) => !place.locked);
    const ordered = day.places.map((place) => place.locked ? place : movable.shift()!);
    const times: OptimizedDay["times"] = {};
    let cursor = 0;
    const conflicts: string[] = [];
    let previousEnd = 0;
    for (const place of ordered) {
      const fixed = place.locked ? minutes(place.time) : undefined;
      if (fixed !== undefined && previousEnd > fixed) conflicts.push(`${place.name} 的固定时间与上一站重叠`);
      const suggested = raw?.times?.[place.id];
      if (!preview && suggested && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(suggested.time || "") || !/^([01]\d|2[0-3]):[0-5]\d$/.test(suggested.endTime || ""))) throw new Error(`${place.name} 请填写完整有效的起止时间`);
      const start = fixed ?? minutes(suggested?.time) ?? (cursor || minutes(day.places[0]?.time) || 9 * 60);
      const end = place.locked ? start + duration(place) : minutes(suggested?.endTime) ?? start + duration(place);
      if (start < previousEnd) conflicts.push(`${place.name} 与上一站时间重叠`);
      if (end <= start) conflicts.push(`${place.name} 的结束时间须晚于开始时间`);
      if (end > 21 * 60) conflicts.push(`${place.name} 结束于 ${clock(end)}，请调整到 21:00 前`);
      if (/晚餐|晚饭|dinner/i.test(place.name) && start > 20 * 60) conflicts.push(`${place.name} 请安排在 20:00 前开始`);
      previousEnd = end;
      if (!place.locked) times[place.id] = { time: clock(start), endTime: clock(end) };
      cursor = end + 20;
    }
    if (conflicts.length && !preview) throw new Error(`${day.date} 时间冲突：${conflicts.join("；")}`);
    return { dayId: day.id, title: typeof raw?.title === "string" ? raw.title : day.title, placeIds: ordered.map((place) => place.id), times, note: `${raw?.note || "保留当天地点"}${missing.length && raw ? "；已补回遗漏地点" : ""}。时间为建议安排，站间预留 20 分钟，请按实际交通核对。` };
  });
  if (city.days.some((day) => day.places.length) && !recognized) throw new Error("模型返回的地点与当前城市不匹配，请重试；原行程未更改");
  return output;
}

// Open manual editing without an API request or time validation.
export function routeDraft(city: City): OptimizedDay[] {
  return city.days.map(day => ({ dayId: day.id, title: day.title || day.date, note: "当前行程 · 可先手动调整，也可请 AI 排顺", placeIds: day.places.map(place => place.id), times: Object.fromEntries(day.places.filter(place => !place.locked).map(place => [place.id, { time: place.time || "", endTime: place.endTime || "" }])) }));

}
