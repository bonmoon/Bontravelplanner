import type { City, PlaceCategory, Trip } from "./types";
import { uid } from "./types";
import { looseDateToIso, sortCitiesByDate, syncCityDatesFromDays } from "./dates";

export function tripFromAssistant(raw: Partial<Trip>, fallbackDate: string): Trip {
  if (!raw || typeof raw.title !== "string" || !raw.title.trim() || !Array.isArray(raw.cities) || !raw.cities.length) throw new Error("新旅程缺少标题或城市，请补充城市与日期后重试；原旅行未修改");
  const reference = looseDateToIso(raw.startDate || "", fallbackDate) || fallbackDate;
  const categories: PlaceCategory[] = ["景点", "美食", "交通", "住宿", "购物"];
  const cities = raw.cities.map((city): City => {
    if (!city || typeof city.name !== "string" || !Array.isArray(city.days) || !city.days.length) throw new Error("新旅程有城市缺少每日行程，请按天整理后重试");
    const days = city.days.map((day) => {
      const date = looseDateToIso(day?.date || "", reference);
      if (!date || !Array.isArray(day.places) || !day.places.length) throw new Error("新旅程缺少有效日期或地点，未创建旅行");
      return { id: uid("day"), date, weekday: "", title: typeof day.title === "string" ? day.title : "顺路的一天", places: day.places.map((place) => {
        if (!place || typeof place.name !== "string" || !place.name.trim()) throw new Error("攻略中有地点名称缺失，请重新整理");
        return { id: uid("place"), name: place.name, mapQuery: typeof place.mapQuery === "string" ? place.mapQuery : "", category: categories.includes(place.category) ? place.category : "景点" as PlaceCategory, time: typeof place.time === "string" ? place.time : "待安排", endTime: typeof place.endTime === "string" ? place.endTime : "", duration: typeof place.duration === "string" ? place.duration : "待安排", summary: typeof place.summary === "string" ? place.summary : "", highlights: Array.isArray(place.highlights) ? place.highlights.filter((value) => typeof value === "string") : [] };
      }).sort((a, b) => (a.time.match(/\d{1,2}:\d{2}/)?.[0].padStart(5,"0") || "99:99").localeCompare(b.time.match(/\d{1,2}:\d{2}/)?.[0].padStart(5,"0") || "99:99")) };
    }).sort((a, b) => a.date.localeCompare(b.date));
    return syncCityDatesFromDays({ id: uid("city"), name: city.name, englishName: typeof city.englishName === "string" ? city.englishName : city.name, dates: "", note: typeof city.note === "string" ? city.note : "从攻略收好的地点", color: "#eadccf", days }, reference);
  });
  const dates = cities.flatMap((city) => city.days.map((day) => day.date)).sort();
  return { id: uid("trip"), title: raw.title.trim(), startDate: dates[0], endDate: dates.at(-1)!, subtitle: typeof raw.subtitle === "string" ? raw.subtitle : "从攻略整理的新旅程", cities: sortCitiesByDate(cities, reference), tickets: [], expenses: [], track: { title: "", artist: "", reason: "", url: "" }, chats: [], updatedAt: new Date().toISOString() };
}
