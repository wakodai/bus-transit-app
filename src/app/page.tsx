"use client";

import { useEffect, useMemo, useState } from "react";
import type { Stop, StopsIndex } from "minotor";
import dynamic from "next/dynamic";
import { StopSearchInput } from "@/components/StopSearchInput";
import {
  fetchGtfsMetadata,
  fetchRoutesGeoJson,
  fetchStopsGeoJson,
  loadStopsIndex,
  type GtfsMetadata,
  type RoutesGeoJson,
  type StopsGeoJson,
} from "@/lib/gtfsLocalClient";
import { planTrip } from "@/lib/planner/planTrip";
import type { Itinerary } from "@/lib/planner/itinerary";
import { routeNameToColorHex } from "@/lib/routeColors";

const TransitMap = dynamic(
  () => import("@/components/TransitMap").then((mod) => mod.TransitMap),
  {
    ssr: false,
  },
);

type SelectionMode = "from" | "via" | "to";

const defaultDeparture = "08:00";

function ItineraryView({ itinerary }: { itinerary: Itinerary | null }) {
  if (!itinerary) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
        検索結果がここに表示されます。出発地と目的地を選び、検索を実行してください。
      </div>
    );
  }

  const firstRide = itinerary.legs.find((leg) => leg.kind === "vehicle");
  const lastRide = [...itinerary.legs]
    .reverse()
    .find((leg) => leg.kind === "vehicle");
  const summary =
    firstRide && lastRide
      ? `${firstRide.departureTimeHHmm} 出発 → ${lastRide.arrivalTimeHHmm} 到着`
      : "";

  return (
    <div className="space-y-3">
      {summary ? (
        <div className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100">
          {summary}
        </div>
      ) : null}
      <div className="space-y-2">
        {itinerary.legs.map((leg, idx) =>
          leg.kind === "vehicle" ? (
            <div
              key={`${leg.routeName}-${idx}`}
              className="rounded-xl border border-emerald-100 bg-white px-3 py-2 shadow-sm"
            >
              <div className="flex items-center justify-between text-xs text-emerald-700">
                <span className="font-semibold" data-testid="itinerary-route">
                  {leg.routeName}
                </span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                  乗車
                </span>
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {leg.fromStopName} → {leg.toStopName}
              </div>
              <div className="text-xs text-slate-600">
                {leg.departureTimeHHmm} 出発 / {leg.arrivalTimeHHmm} 到着
              </div>
            </div>
          ) : (
            <div
              key={`transfer-${idx}`}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <div className="flex items-center justify-between text-xs text-slate-700">
                <span className="font-semibold">
                  {leg.fromStopName} → {leg.toStopName}
                </span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                  乗換/待機
                </span>
              </div>
              <div className="text-xs text-slate-600">
                最低 {leg.minTransferMinutes} 分
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function RouteLegend({
  routes,
}: {
  routes: { name: string; color: string }[];
}) {
  if (routes.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-700">
      {routes.map((route) => (
        <span
          key={route.name}
          className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 shadow-sm ring-1 ring-slate-200"
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: route.color }}
          />
          {route.name}
        </span>
      ))}
    </div>
  );
}

export default function Home() {
  const [stopsIndex, setStopsIndex] = useState<StopsIndex | null>(null);
  const [stopsGeoJson, setStopsGeoJson] = useState<StopsGeoJson | null>(null);
  const [routesGeoJson, setRoutesGeoJson] = useState<RoutesGeoJson | null>(
    null,
  );
  const [metadata, setMetadata] = useState<GtfsMetadata | null>(null);

  const [fromStop, setFromStop] = useState<Stop | null>(null);
  const [viaStop, setViaStop] = useState<Stop | null>(null);
  const [toStop, setToStop] = useState<Stop | null>(null);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("from");

  const [departureTime, setDepartureTime] = useState(defaultDeparture);
  const [viaStayMinutes, setViaStayMinutes] = useState(0);
  const [maxTransfers, setMaxTransfers] = useState(2);

  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [usedRouteNames, setUsedRouteNames] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlanning, setIsPlanning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [stopsData, routesData, meta, index] = await Promise.all([
          fetchStopsGeoJson(),
          fetchRoutesGeoJson(),
          fetchGtfsMetadata(),
          loadStopsIndex(),
        ]);
        if (cancelled) return;
        setStopsGeoJson(stopsData);
        setRoutesGeoJson(routesData);
        setMetadata(meta);
        setStopsIndex(index);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("GTFS データの読み込みに失敗しました。再読み込みしてください。");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const routeLegend = useMemo(() => {
    if (!routesGeoJson) return [];
    const uniqueNames = Array.from(
      new Set(routesGeoJson.features.map((f) => f.properties.route_name)),
    );
    return uniqueNames.map((name) => ({
      name,
      color: routeNameToColorHex(name),
    }));
  }, [routesGeoJson]);

  const selectedStopIds = useMemo(
    () =>
      [fromStop, viaStop, toStop]
        .filter(Boolean)
        .map((stop) => (stop as Stop).sourceStopId),
    [fromStop, viaStop, toStop],
  );

  const applySelection = (stop: Stop, target?: SelectionMode) => {
    const mode = target ?? selectionMode;
    setError(null);
    if (mode === "from") {
      setFromStop(stop);
      if (!toStop) setSelectionMode("to");
    } else if (mode === "via") {
      setViaStop(stop);
      setSelectionMode("to");
    } else {
      setToStop(stop);
    }
  };

  const handleMapPick = (lat: number, lon: number) => {
    if (!stopsIndex) return;
    const nearest = stopsIndex.findStopsByLocation(lat, lon, 1, 0.6)[0];
    if (nearest) {
      applySelection(nearest);
    }
  };

  const handleStopClick = (stopId: string) => {
    if (!stopsIndex) return;
    const stop = stopsIndex.findStopBySourceStopId(stopId);
    if (stop) applySelection(stop);
  };

  const runPlan = async () => {
    setError(null);
    setItinerary(null);
    setUsedRouteNames([]);
    if (!fromStop || !toStop) {
      setError("出発地と目的地を選択してください。");
      return;
    }
    setIsPlanning(true);
    try {
      const result = await planTrip({
        fromStopId: fromStop.sourceStopId,
        viaStopId: viaStop?.sourceStopId,
        viaStayMinutes,
        toStopId: toStop.sourceStopId,
        departAtHHmm: departureTime,
        maxTransfers,
      });
      setItinerary(result);
      setUsedRouteNames(result.usedRouteNames);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "経路検索に失敗しました。入力を確認してください。",
      );
    } finally {
      setIsPlanning(false);
    }
  };

  const dataReady =
    !isLoading && !!stopsIndex && !!stopsGeoJson && !!routesGeoJson;

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-emerald-50 text-slate-900">
      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12">
        <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-sm backdrop-blur">
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
            知立市ミニバス 乗り換え案内 (開発プレビュー)
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
                地図で選べる乗り換えプランナー
              </h1>
              <p className="max-w-3xl text-base leading-7 text-slate-600">
                GTFS-JP を前処理し、ブラウザだけで乗り換え計算を行う SPA です。
                停留所を地図クリックまたは検索で指定し、出発時刻と経由地の滞在時間を入力して計画を立てます。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {metadata ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                  データ: {metadata.feedName} ({metadata.serviceDate})
                </span>
              ) : null}
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                React Leaflet
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                minotor (RAPTOR)
              </span>
            </div>
          </div>
          {metadata ? (
            <div className="text-xs text-slate-500">
              出典: {metadata.feedName} / ライセンス:{" "}
              <a
                href={metadata.licenseUrl}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-700 underline"
              >
                {metadata.licenseId}
              </a>{" "}
              (有効期間 {metadata.fromDate} - {metadata.toDate})
            </div>
          ) : null}
        </header>

        <section className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3 space-y-3">
            <TransitMap
              routesGeoJson={routesGeoJson}
              stopsGeoJson={stopsGeoJson}
              selectionMode={selectionMode}
              selectedStopIds={selectedStopIds}
              usedRouteNames={usedRouteNames}
              onMapClick={handleMapPick}
              onStopClick={handleStopClick}
            />
            <RouteLegend routes={routeLegend} />
          </div>
          <div className="lg:col-span-2 space-y-4 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
            <div className="flex flex-wrap gap-2">
              {(["from", "via", "to"] as SelectionMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSelectionMode(mode)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${
                    selectionMode === mode
                      ? "bg-emerald-500 text-white ring-emerald-500"
                      : "bg-slate-100 text-slate-700 ring-slate-200 hover:bg-slate-200"
                  }`}
                >
                  {mode === "from"
                    ? "出発地を指定"
                    : mode === "via"
                      ? "経由地を指定"
                      : "目的地を指定"}
                </button>
              ))}
            </div>

            <StopSearchInput
              label="出発地"
              selectedStop={fromStop}
              stopsIndex={stopsIndex}
              onSelect={(stop) => applySelection(stop, "from")}
              helperText="停留所名を入力するか、地図をクリックして選択します。"
            />
            <StopSearchInput
              label="経由地（任意）"
              selectedStop={viaStop}
              stopsIndex={stopsIndex}
              onSelect={(stop) => applySelection(stop, "via")}
              helperText="経由しない場合は空のままで構いません。"
            />
            <StopSearchInput
              label="目的地"
              selectedStop={toStop}
              stopsIndex={stopsIndex}
              onSelect={(stop) => applySelection(stop, "to")}
              helperText="目的地は必須です。"
            />

            <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="grid gap-2 text-sm text-slate-700">
                <label className="font-semibold text-slate-800">
                  出発時刻
                </label>
                <input
                  type="time"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                />
              </div>
              <div className="grid gap-2 text-sm text-slate-700">
                <label className="font-semibold text-slate-800">
                  経由地での滞在時間（分）
                </label>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  value={viaStayMinutes}
                  onChange={(e) =>
                    setViaStayMinutes(Math.max(0, Number(e.target.value) || 0))
                  }
                />
              </div>
              <div className="grid gap-2 text-sm text-slate-700">
                <label className="font-semibold text-slate-800">
                  最大乗り換え回数
                </label>
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  value={maxTransfers}
                  onChange={(e) => setMaxTransfers(Number(e.target.value))}
                >
                  {[0, 1, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      {n} 回まで
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                disabled={!dataReady || isPlanning}
                onClick={runPlan}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isPlanning ? "検索中..." : "この条件で検索"}
              </button>
              {!dataReady ? (
                <div className="text-xs text-slate-500">
                  GTFS データを読み込んでいます...
                </div>
              ) : null}
              {error ? (
                <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-100">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                旅程
              </h2>
              <ItineraryView itinerary={itinerary} />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
