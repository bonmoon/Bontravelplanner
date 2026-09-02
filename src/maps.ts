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
  if (typeof place === "string") return place;
  const name = place.mapQuery || queryFromMapUrl(place.mapUrl) || place.name;
  const cityHint = city?.englishName || city?.name || "";
  return cityHint && !name.toLowerCase().includes(cityHint.toLowerCase()) ? `${name}, ${cityHint}` : name;
}

export function appleMapsUrl(place: Place | string, city?: City): string {
  if (typeof place !== "string" && place.mapUrl?.includes("maps.apple.com")) return place.mapUrl;
  return `https://maps.apple.com/search?query=${encodeURIComponent(placeQuery(place, city))}`;
}

export function googleMapsUrl(place: Place | string, city?: City): string {
  if (typeof place !== "string" && place.mapUrl?.includes("google.com/maps")) return place.mapUrl;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeQuery(place, city))}`;
}

export function appleRouteUrl(places: Place[], city?: City): string {
  if (!places.length) return "https://maps.apple.com";
  if (places.length === 1) return appleMapsUrl(places[0], city);
  const destination = placeQuery(places.at(-1)!, city);
  const start = placeQuery(places[0], city);
  return `https://maps.apple.com/directions?source=${encodeURIComponent(start)}&destination=${encodeURIComponent(destination)}&mode=walking`;
}

export function googleRouteUrl(places: Place[], city?: City): string {
  if (!places.length) return "https://www.google.com/maps";
  if (places.length === 1) return googleMapsUrl(places[0], city);
  const origin = encodeURIComponent(placeQuery(places[0], city));
  const destination = encodeURIComponent(placeQuery(places.at(-1)!, city));
  const waypoints = places.slice(1, -1).map((place) => placeQuery(place, city)).join("|");
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=walking${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ""}`;
}
