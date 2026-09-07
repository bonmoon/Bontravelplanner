import type { City, Place } from "./types";
export function moveEditedPlace(city: City, edited: Place, targetDayId: string): City {
  if (!city.days.some(d => d.id === targetDayId) || !city.days.some(d => d.places.some(p => p.id === edited.id))) throw new Error("目标日期或原地点不存在");
  return { ...city, days: city.days.map(day => ({ ...day, places: [...day.places.filter(p => p.id !== edited.id), ...(day.id === targetDayId ? [edited] : [])].sort((a,b) => (/^\d{2}:\d{2}$/.test(a.time) ? a.time : "99:99").localeCompare(/^\d{2}:\d{2}$/.test(b.time) ? b.time : "99:99")) })) };
}
