import type { City, DayPlan } from "./types";

function yearFrom(value: string): number {
  return Number(value.match(/20\d{2}/)?.[0]) || new Date().getFullYear();
}

export function looseDateToIso(value: string, tripDate: string, position = 0): string {
  if (!value) return "";
  const fullDates = [...value.matchAll(/(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})/g)];
  const direct = fullDates[Math.min(position, Math.max(0, fullDates.length - 1))];
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

function datedDays(days: DayPlan[], tripDate: string): string[] {
  return days.map((day) => looseDateToIso(day.date, tripDate, 0)).filter(Boolean).sort();
}

/** Once itinerary days have real dates, they become the source of truth for the city card. */
export function cityDatesFromDays(city: City, tripDate: string): Pick<City, "startDate" | "endDate" | "dates"> | null {
  if (city.dateMode === "stay" && city.startDate) return { startDate: city.startDate, endDate: city.endDate || city.startDate, dates: cityDateRange(city.startDate, city.endDate || city.startDate) };
  const dates = datedDays(city.days, tripDate);
  if (!dates.length) return null;
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];
  return { startDate, endDate, dates: cityDateRange(startDate, endDate) };
}

export function syncCityDatesFromDays(city: City, tripDate: string): City {
  const range = cityDatesFromDays(city, tripDate);
  return range ? { ...city, ...range } : city;
}

export function sortCitiesByDate(cities: City[], tripDate: string): City[] {
  return cities.map((city, index) => ({ city, index })).sort((a, b) => cityStartDate(a.city, tripDate).localeCompare(cityStartDate(b.city, tripDate)) || a.index - b.index).map(({ city }) => city);
}
