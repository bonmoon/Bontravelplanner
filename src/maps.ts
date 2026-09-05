import type { City, Place } from "./types";

function queryFromMapUrl(value?: string): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    const query = url.searchParams.get("query") || url.searchParams.get("q");
    if (query) return query;
    const placeMatch = decodeURIComponent(url.pathname).match(/\/(?:place|search)\/([^/]+)/i);
    return placeMatch?.[1]?.replace(/\+/g, " ") || "";
  } catch { return ""; }
}

function placeQuery(place: Place | string, city?: City): string {
  const name = typeof place === "string" ? place : place.mapQuery || queryFromMapUrl(place.mapUrl) || place.name;
  const cityNames = [city?.englishName?.split(/[\/·]/)[0].trim(), city?.name].filter(Boolean) as string[];
  const location = [...cityNames, city?.country].filter((value, index, values) => value && values.findIndex((item) => item?.toLowerCase() === value.toLowerCase()) === index).join(", ");
  const normalized = name.toLowerCase();
  const alreadyScoped = cityNames.some((value) => normalized.includes(value.toLowerCase())) || (!!city?.country && normalized.includes(city.country.toLowerCase()));
  return location && !alreadyScoped ? `${name}, ${location}` : name;
}

export function appleMapsUrl(place: Place | string, city?: City): string {
  if (typeof place !== "string" && place.mapUrl) { try { const url = new URL(place.mapUrl); if (url.protocol === "https:" && ["maps.apple.com","maps.apple"].includes(url.hostname) && !url.username && !url.password) return url.href; } catch { /* fall back to a scoped search */ } }
  return `https://maps.apple.com/?q=${encodeURIComponent(placeQuery(place, city))}`;
}

export function googleMapsUrl(place: Place | string, city?: City): string {
  if (typeof place !== "string" && place.mapUrl) { try { const url = new URL(place.mapUrl); if (url.protocol === "https:" && ["google.com","www.google.com","maps.google.com"].includes(url.hostname) && !url.username && !url.password) return url.href; } catch { /* fall back to a scoped search */ } }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeQuery(place, city))}`;
}

export function appleRouteUrl(places: Place[], city?: City): string {
  if (!places.length) return "https://maps.apple.com";
  if (places.length === 1) return appleMapsUrl(places[0], city);
  const destination = placeQuery(places.at(-1)!, city);
  const start = placeQuery(places[0], city);
  return `https://maps.apple.com/?saddr=${encodeURIComponent(start)}&daddr=${encodeURIComponent(destination)}&dirflg=w`;
}

export function googleRouteUrl(places: Place[], city?: City): string {
  if (!places.length) return "https://www.google.com/maps";
  if (places.length === 1) return googleMapsUrl(places[0], city);
  const origin = encodeURIComponent(placeQuery(places[0], city));
  const destination = encodeURIComponent(placeQuery(places.at(-1)!, city));
  const waypoints = places.slice(1, -1).map((place) => placeQuery(place, city)).join("|");
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=walking${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ""}`;
}
