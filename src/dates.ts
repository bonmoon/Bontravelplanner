import type { City } from "./types";

function yearFrom(value: string): number {
  return Number(value.match(/20\d{2}/)?.[0]) || new Date().getFullYear();
}

export function looseDateToIso(value: string, tripDate: string, position = 0): string {
  if (!value) return "";
  const direct = value.match(/(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})/);
  if (direct) return `${direct[1]}-${direct[2].padStart(2, "0")}-${direct[3].padStart(2, "0")}`;
  const matches = [...value.matchAll(/(\d{1,2})[.\/-](\d{1,2})/g)];
  const selected = matches[Math.min(position, Math.max(0, matches.length - 1))];
  if (!selected) return "";
  return `${yearFrom(tripDate)}-${selected[1].padStart(2, "0")}-${selected[2].padStart(2, "0")}`;
}

export function cityDateRange(startDate: string, endDate: string): string {
  if (!startDate) return "待安排";
  const short = (value: string) => value.slice(5).replace("-", ".");
  return endDate && endDate !== startDate ? `${short(startDate)} – ${short(endDate)}` : short(startDate);
}

export function cityStartDate(city: City, tripDate: string): string {
  return city.startDate || looseDateToIso(city.dates, tripDate, 0) || "9999-12-31";
}

export function sortCitiesByDate(cities: City[], tripDate: string): City[] {
  return cities.map((city, index) => ({ city, index })).sort((a, b) => cityStartDate(a.city, tripDate).localeCompare(cityStartDate(b.city, tripDate)) || a.index - b.index).map(({ city }) => city);
}
