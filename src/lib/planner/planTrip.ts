import { Duration, Query, Route as MinotorRoute, Router, Time } from "minotor";
import { loadStopsIndex, loadTimetable } from "../gtfsLocalClient";
import type { Itinerary, ItineraryLeg } from "./itinerary";

export type PlanTripInput = {
  fromStopId: string;
  viaStopId?: string;
  viaStayMinutes?: number;
  toStopId: string;
  departAtHHmm: string;
  maxTransfers: number;
};

const DEFAULT_MIN_TRANSFER_MINUTES = 2;

const formatHHmm = (time: Time): string => {
  const minutes = time.toMinutes();
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
};

function parseHHmm(value: string): Time {
  if (!/^\d{1,2}:\d{2}$/.test(value)) {
    throw new Error("時刻は HH:mm 形式で入力してください");
  }
  const [hh, mm] = value.split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm) || mm < 0 || mm > 59) {
    throw new Error("時刻は HH:mm 形式で入力してください");
  }
  return Time.fromHM(hh, mm);
}

const stopName = (sourceStopId: string, fallback: MinotorRoute["legs"][number]["from"]) =>
  fallback?.name ?? sourceStopId;

function legsToItinerary(route: MinotorRoute): Itinerary {
  const usedRouteNames: string[] = [];
  const legs: ItineraryLeg[] = route.legs.map((leg) => {
    if ("route" in leg) {
      const routeName =
        (leg.route.name ?? "").trim() ||
        `Route ${String(leg.route.type ?? "")}`;
      usedRouteNames.push(routeName);
      return {
        kind: "vehicle",
        routeName,
        fromStopName: leg.from.name,
        fromStopId: leg.from.sourceStopId,
        fromLat: leg.from.lat,
        fromLon: leg.from.lon,
        toStopName: leg.to.name,
        toStopId: leg.to.sourceStopId,
        toLat: leg.to.lat,
        toLon: leg.to.lon,
        departureTimeHHmm: formatHHmm(leg.departureTime),
        arrivalTimeHHmm: formatHHmm(leg.arrivalTime),
      };
    }
    const minutes = leg.minTransferTime
      ? Math.max(0, Math.round(leg.minTransferTime.toSeconds() / 60))
      : 0;
    return {
      kind: "transfer",
      fromStopName: leg.from.name,
      fromStopId: leg.from.sourceStopId,
      fromLat: leg.from.lat,
      fromLon: leg.from.lon,
      toStopName: leg.to.name,
      toStopId: leg.to.sourceStopId,
      toLat: leg.to.lat,
      toLon: leg.to.lon,
      minTransferMinutes: minutes,
    };
  });

  return {
    legs,
    usedRouteNames: Array.from(new Set(usedRouteNames)),
  };
}

function buildQuery(params: {
  from: string;
  to: string;
  departure: Time;
  maxTransfers: number;
  minTransferMinutes: number;
}) {
  const builder = new Query.Builder()
    .from(params.from)
    .to(params.to)
    .departureTime(params.departure)
    .maxTransfers(params.maxTransfers)
    .minTransferTime(Duration.fromMinutes(params.minTransferMinutes));
  return builder.build();
}

async function fetchRouter() {
  const [timetable, stopsIndex] = await Promise.all([
    loadTimetable(),
    loadStopsIndex(),
  ]);
  return new Router(timetable, stopsIndex);
}

export async function planTrip(input: PlanTripInput): Promise<Itinerary> {
  const router = await fetchRouter();

  const minTransferMinutes = DEFAULT_MIN_TRANSFER_MINUTES;
  const departureTime = parseHHmm(input.departAtHHmm);

  const routeOnce = (from: string, to: string, depart: Time) => {
    const query = buildQuery({
      from,
      to,
      departure: depart,
      maxTransfers: input.maxTransfers,
      minTransferMinutes,
    });
    const result = router.route(query);
    return result.bestRoute();
  };

  if (!input.viaStopId) {
    const route = routeOnce(input.fromStopId, input.toStopId, departureTime);
    if (!route) throw new Error("経路が見つかりませんでした");
    return legsToItinerary(route);
  }

  const first = routeOnce(input.fromStopId, input.viaStopId, departureTime);
  if (!first) throw new Error("経由地までの経路が見つかりませんでした");

  const stay = Duration.fromMinutes(input.viaStayMinutes ?? 0);
  const arrival = first.arrivalTime();
  const departVia = stay.toSeconds() > 0 ? arrival.plus(stay) : arrival;

  const second = routeOnce(input.viaStopId, input.toStopId, departVia);
  if (!second) throw new Error("経由地以降の経路が見つかりませんでした");

  const viaName = stopName(input.viaStopId, first.legs.at(-1)?.to ?? second.legs[0]?.from);
  const waitLeg: ItineraryLeg | null =
    input.viaStayMinutes && input.viaStayMinutes > 0
      ? {
          kind: "transfer",
          fromStopName: viaName,
          toStopName: viaName,
          minTransferMinutes: input.viaStayMinutes,
        }
      : null;

  const firstItinerary = legsToItinerary(first);
  const secondItinerary = legsToItinerary(second);

  return {
    legs: [
      ...firstItinerary.legs,
      ...(waitLeg ? [waitLeg] : []),
      ...secondItinerary.legs,
    ],
    usedRouteNames: Array.from(
      new Set([...firstItinerary.usedRouteNames, ...secondItinerary.usedRouteNames]),
    ),
  };
}
