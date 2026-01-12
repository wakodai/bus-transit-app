import type {
  Feature,
  FeatureCollection,
  MultiLineString,
  Point,
} from "geojson";
import { StopsIndex, Timetable } from "minotor";

export type StopFeatureProperties = {
  stop_id: string;
  stop_name: string;
  zone_id?: string;
  location_type?: string;
};

export type RouteFeatureProperties = {
  id: string;
  route_name: string;
};

export type StopsGeoJson = FeatureCollection<Point, StopFeatureProperties>;
export type StopFeature = Feature<Point, StopFeatureProperties>;
export type RoutesGeoJson = FeatureCollection<
  MultiLineString,
  RouteFeatureProperties
>;

export type GtfsMetadata = {
  fileUid: string;
  feedName: string;
  licenseId: string;
  licenseUrl: string;
  fromDate: string;
  toDate: string;
  publishedAt: string;
  updatedAt: string;
  serviceDate: string;
  generatedAt: string;
};

const STOPS_URL = "/gtfs/stops.geojson";
const ROUTES_URL = "/gtfs/routes.geojson";
const STOPS_BIN_URL = "/gtfs/stops.bin";
const TIMETABLE_BIN_URL = "/gtfs/timetable.bin";
const METADATA_URL = "/gtfs/metadata.json";

let stopsGeojsonCache: StopsGeoJson | null = null;
let routesGeojsonCache: RoutesGeoJson | null = null;
let stopsIndexCache: StopsIndex | null = null;
let timetableCache: Timetable | null = null;
let metadataCache: GtfsMetadata | null = null;

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url} (status ${res.status})`);
  }
  return (await res.json()) as T;
}

async function fetchBinary(url: string, signal?: AbortSignal): Promise<Uint8Array> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url} (status ${res.status})`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

export async function fetchStopsGeoJson(
  options: { signal?: AbortSignal } = {},
): Promise<StopsGeoJson> {
  if (stopsGeojsonCache) return stopsGeojsonCache;
  stopsGeojsonCache = await fetchJson<StopsGeoJson>(STOPS_URL, options.signal);
  return stopsGeojsonCache;
}

export async function fetchRoutesGeoJson(
  options: { signal?: AbortSignal } = {},
): Promise<RoutesGeoJson> {
  if (routesGeojsonCache) return routesGeojsonCache;
  routesGeojsonCache = await fetchJson<RoutesGeoJson>(ROUTES_URL, options.signal);
  return routesGeojsonCache;
}

export async function loadStopsIndex(
  options: { signal?: AbortSignal } = {},
): Promise<StopsIndex> {
  if (stopsIndexCache) return stopsIndexCache;
  const data = await fetchBinary(STOPS_BIN_URL, options.signal);
  stopsIndexCache = StopsIndex.fromData(data);
  return stopsIndexCache;
}

export async function loadTimetable(
  options: { signal?: AbortSignal } = {},
): Promise<Timetable> {
  if (timetableCache) return timetableCache;
  const data = await fetchBinary(TIMETABLE_BIN_URL, options.signal);
  timetableCache = Timetable.fromData(data);
  return timetableCache;
}

export async function fetchGtfsMetadata(
  options: { signal?: AbortSignal } = {},
): Promise<GtfsMetadata> {
  if (metadataCache) return metadataCache;
  metadataCache = await fetchJson<GtfsMetadata>(METADATA_URL, options.signal);
  return metadataCache;
}

export function resetGtfsCaches() {
  stopsGeojsonCache = null;
  routesGeojsonCache = null;
  stopsIndexCache = null;
  timetableCache = null;
  metadataCache = null;
}
