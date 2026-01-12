import { Duration } from "minotor";
import type { Stop, StopsIndex } from "minotor";
import type { SelectionMode } from "@/lib/planner/selectionTypes";
import {
  DEFAULT_MIN_TRANSFER_MINUTES,
  buildQuery,
  loadRouter,
  parseHHmm,
} from "./routingUtils";

const MAX_CANDIDATES = 8;
const SEARCH_RADIUS_KM = 1.2;
const TIME_PENALTY_PER_TRANSFER_MIN = 10;

type EvaluationContext = {
  router: Awaited<ReturnType<typeof loadRouter>>;
  departAtHHmm: string;
  viaStayMinutes: number;
  maxTransfers: number;
};

type CandidateScore = {
  stop: Stop;
  distanceKm: number;
  totalMinutes: number | null;
  transfers: number | null;
  score: number;
};

const toMinutes = (seconds: number) => Math.round(seconds / 60);

const squaredDistance = (lat: number, lon: number, stop: Stop) => {
  const dLat = lat - stop.lat;
  const dLon = lon - stop.lon;
  return dLat * dLat + dLon * dLon;
};

const describeTransfers = (legs: number) => Math.max(0, legs - 1);

async function evaluateRoute(
  context: EvaluationContext,
  from: string,
  to: string,
  departureOffsetMinutes = 0,
) {
  const minTransferMinutes = DEFAULT_MIN_TRANSFER_MINUTES;
  const baseDeparture = parseHHmm(context.departAtHHmm);
  const departureTime =
    departureOffsetMinutes > 0
      ? baseDeparture.plus(Duration.fromMinutes(departureOffsetMinutes))
      : baseDeparture;
  const query = buildQuery({
    from,
    to,
    departure: departureTime,
    maxTransfers: context.maxTransfers,
    minTransferMinutes,
  });
  const result = context.router.route(query).bestRoute();
  if (!result) return null;
  const durationSeconds = result.totalDuration().toSeconds();
  const totalMinutes = toMinutes(durationSeconds);
  const transfers = describeTransfers(
    result.legs.filter((leg) => "route" in leg).length,
  );
  return { totalMinutes, transfers };
}

async function scoreCandidate(
  candidate: Stop,
  distanceKm: number,
  selectionMode: SelectionMode,
  context: EvaluationContext,
  fromStopId?: string,
  toStopId?: string,
) {
  let totalMinutes: number | null = null;
  let transfers: number | null = null;

  if (selectionMode === "from" && toStopId) {
    const route = await evaluateRoute(
      context,
      candidate.sourceStopId,
      toStopId,
    );
    if (route) {
      totalMinutes = route.totalMinutes;
      transfers = route.transfers;
    }
  }

  if (selectionMode === "to" && fromStopId) {
    const route = await evaluateRoute(
      context,
      fromStopId,
      candidate.sourceStopId,
    );
    if (route) {
      totalMinutes = route.totalMinutes;
      transfers = route.transfers;
    }
  }

  if (selectionMode === "via" && fromStopId && toStopId) {
    const first = await evaluateRoute(
      context,
      fromStopId,
      candidate.sourceStopId,
    );
    if (first) {
      const second = await evaluateRoute(
        context,
        candidate.sourceStopId,
        toStopId,
        Math.max(0, context.viaStayMinutes),
      );
      if (second) {
        totalMinutes = first.totalMinutes + second.totalMinutes;
        transfers = first.transfers + second.transfers;
      }
    }
  }

  const transferPenalty =
    transfers !== null ? transfers * TIME_PENALTY_PER_TRANSFER_MIN : 0;
  const timeScore = totalMinutes ?? 9999;
  const score = timeScore + transferPenalty + distanceKm * 5;

  return {
    stop: candidate,
    distanceKm,
    totalMinutes,
    transfers,
    score,
  } satisfies CandidateScore;
}

export async function selectStopByConnectivity(params: {
  lat: number;
  lon: number;
  stopsIndex: StopsIndex;
  selectionMode: SelectionMode;
  fromStopId?: string;
  toStopId?: string;
  departAtHHmm: string;
  viaStayMinutes: number;
  maxTransfers: number;
}): Promise<Stop | null> {
  const {
    lat,
    lon,
    stopsIndex,
    selectionMode,
    fromStopId,
    toStopId,
    departAtHHmm,
    viaStayMinutes,
    maxTransfers,
  } = params;

  const candidates = stopsIndex.findStopsByLocation(
    lat,
    lon,
    MAX_CANDIDATES,
    SEARCH_RADIUS_KM,
  );
  if (candidates.length === 0) return null;

  const context: EvaluationContext = {
    router: await loadRouter(),
    departAtHHmm,
    viaStayMinutes,
    maxTransfers,
  };

  const scored: CandidateScore[] = [];
  for (const candidate of candidates) {
    const distanceKm = Math.sqrt(squaredDistance(lat, lon, candidate)) * 111;
    scored.push(
      await scoreCandidate(
        candidate,
        distanceKm,
        selectionMode,
        context,
        fromStopId,
        toStopId,
      ),
    );
  }

  const viable = scored.filter((item) => item.totalMinutes !== null);
  const ordered = (viable.length > 0 ? viable : scored).sort(
    (a, b) => a.score - b.score,
  );
  return ordered[0]?.stop ?? null;
}
