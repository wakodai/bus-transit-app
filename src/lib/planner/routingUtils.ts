import { Duration, Query, Router, Time } from "minotor";
import { loadStopsIndex, loadTimetable } from "../gtfsLocalClient";

export const DEFAULT_MIN_TRANSFER_MINUTES = 2;

let routerCache: Router | null = null;

export async function loadRouter(): Promise<Router> {
  if (routerCache) return routerCache;
  const [timetable, stopsIndex] = await Promise.all([
    loadTimetable(),
    loadStopsIndex(),
  ]);
  routerCache = new Router(timetable, stopsIndex);
  return routerCache;
}

export function parseHHmm(value: string): Time {
  if (!/^\d{1,2}:\d{2}$/.test(value)) {
    throw new Error("時刻は HH:mm 形式で入力してください");
  }
  const [hh, mm] = value.split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm) || mm < 0 || mm > 59) {
    throw new Error("時刻は HH:mm 形式で入力してください");
  }
  return Time.fromHM(hh, mm);
}

export function buildQuery(params: {
  from: string;
  to: string;
  departure: Time;
  maxTransfers: number;
  minTransferMinutes: number;
}): Query {
  const builder = new Query.Builder()
    .from(params.from)
    .to(params.to)
    .departureTime(params.departure)
    .maxTransfers(params.maxTransfers)
    .minTransferTime(Duration.fromMinutes(params.minTransferMinutes));
  return builder.build();
}
