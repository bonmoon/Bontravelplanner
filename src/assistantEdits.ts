import type { AssistantOperation, Trip } from "./types";
import { cityDateRange, sortCitiesByDate } from "./dates";

export function applyRecordEdits(trip: Trip, operations: AssistantOperation[]): Trip {
  let result = trip;
  for (const op of operations) {
    if (op.type !== "edit_record") continue;
    const keys: Record<typeof op.entity, string[]> = { trip: ["title","subtitle","startDate","endDate"], city: ["name","englishName","country","note","startDate","endDate"], day: ["date","title"], ticket: ["title","provider","date","time","meta","code","passengers","departureTime","arrivalTime","arrivalDate","checkInDate","checkOutDate","checkInTime","checkOutTime","includesBreakfast"], journal: ["title","date","text"] };
    if (!keys[op.entity] || !op.changes || !Object.keys(op.changes).length) throw new Error("修改缺少有效字段，原资料未修改");
    for (const [key,value] of Object.entries(op.changes)) {
      if (!keys[op.entity].includes(key) || (key === "includesBreakfast" ? typeof value !== "boolean" : typeof value !== "string")) throw new Error("修改字段不受支持，原资料未修改");
      if (/date$/i.test(key) && !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) throw new Error("请提供完整日期，原资料未修改");
    }
    let found = false;
    const update = <T extends {id:string}>(record: T): T => { if (record.id !== op.id) return record; found = true; return { ...record, ...op.changes }; };
    if (op.entity === "trip") result = update(result);
    if (op.entity === "ticket") result = { ...result, tickets: result.tickets.map(update) };
    if (["city","day","journal"].includes(op.entity)) result = { ...result, cities: result.cities.map((city) => {
      if (op.entity === "city") { const changed = update(city); if (changed !== city && ("startDate" in op.changes || "endDate" in op.changes)) { if ((changed.endDate || changed.startDate || "") < (changed.startDate || "")) throw new Error("离开日期不能早于到达日期"); return { ...changed, dateMode: "stay", dates: cityDateRange(changed.startDate || "",changed.endDate || "") }; } return changed; }
      if (op.entity === "day") return { ...city, days: city.days.map(update).sort((a,b) => a.date.localeCompare(b.date)) };
      return { ...city, journal: city.journal?.map(update) };
    }) };
    if (!found) throw new Error("找不到要修改的原始记录，请指明城市或票据名称");
  }
  return { ...result, cities: sortCitiesByDate(result.cities,result.startDate) };
}
