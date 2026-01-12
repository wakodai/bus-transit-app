"use client";

import "leaflet/dist/leaflet.css";

import type { LatLngExpression } from "leaflet";
import { useMemo } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMapEvent,
} from "react-leaflet";
import { routeNameToColorHex } from "@/lib/routeColors";
import type { RoutesGeoJson, StopsGeoJson } from "@/lib/gtfsLocalClient";

type TransitMapProps = {
  routesGeoJson: RoutesGeoJson | null;
  stopsGeoJson: StopsGeoJson | null;
  selectionMode: "from" | "via" | "to";
  selectedStopIds: string[];
  usedRouteNames: string[];
  onMapClick: (lat: number, lng: number) => void;
  onStopClick: (stopId: string) => void;
};

type MapClickCatcherProps = {
  onClick: (lat: number, lng: number) => void;
};

function MapClickCatcher({ onClick }: MapClickCatcherProps) {
  useMapEvent("click", (event) => {
    onClick(event.latlng.lat, event.latlng.lng);
  });
  return null;
}

export function TransitMap({
  routesGeoJson,
  stopsGeoJson,
  selectionMode,
  selectedStopIds,
  usedRouteNames,
  onMapClick,
  onStopClick,
}: TransitMapProps) {
  const routes = useMemo(() => {
    if (!routesGeoJson) return [];
    return routesGeoJson.features.map((feature) => {
      const routeName = feature.properties.route_name;
      const color = routeNameToColorHex(routeName);
      const segments =
        feature.geometry.type === "MultiLineString"
          ? feature.geometry.coordinates.map((line) =>
              line.map(
                ([lon, lat]) => [lat, lon] as LatLngExpression,
              ),
            )
          : [];
      return {
        routeName,
        color,
        segments,
      };
    });
  }, [routesGeoJson]);

  const stops = useMemo(() => {
    if (!stopsGeoJson) return [];
    return stopsGeoJson.features
      .map((feature) => {
        const [lon, lat] = feature.geometry.coordinates;
        return {
          id: feature.properties.stop_id,
          name: feature.properties.stop_name,
          lat,
          lon,
        };
      })
      .filter((stop) => Number.isFinite(stop.lat) && Number.isFinite(stop.lon));
  }, [stopsGeoJson]);

  const bounds = useMemo(() => {
    if (stops.length === 0) return null;
    const lats = stops.map((s) => s.lat);
    const lons = stops.map((s) => s.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    return [
      [minLat, minLon],
      [maxLat, maxLon],
    ] as [[number, number], [number, number]];
  }, [stops]);

  const highlightedRoutes = useMemo(
    () => new Set(usedRouteNames),
    [usedRouteNames],
  );
  const selectedIds = useMemo(
    () => new Set(selectedStopIds),
    [selectedStopIds],
  );

  const selectionLabel =
    selectionMode === "from"
      ? "地図クリック: 出発地"
      : selectionMode === "via"
        ? "地図クリック: 経由地"
        : "地図クリック: 目的地";

  return (
    <div className="relative h-[540px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="absolute left-4 top-4 z-[400] flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800 shadow">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        {selectionLabel}
      </div>
      <MapContainer
        center={bounds ? undefined : [35.0, 137.0]}
        bounds={bounds ?? undefined}
        boundsOptions={{ padding: [32, 32] }}
        zoom={13}
        className="h-full w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <MapClickCatcher onClick={onMapClick} />
        {routes.map((route) =>
          route.segments.map((segment, idx) => {
            const highlighted = highlightedRoutes.has(route.routeName);
            return (
              <Polyline
                key={`${route.routeName}-${idx}`}
                positions={segment}
                color={route.color}
                opacity={highlighted ? 0.9 : 0.25}
                weight={highlighted ? 6 : 3}
                dashArray={highlighted ? undefined : "6 6"}
              />
            );
          }),
        )}
        {stops.map((stop) => {
          const selected = selectedIds.has(stop.id);
          return (
            <CircleMarker
              key={stop.id}
              center={[stop.lat, stop.lon]}
              radius={selected ? 9 : 6}
              pathOptions={{
                color: selected ? "#0f766e" : "#64748b",
                weight: selected ? 3 : 1.5,
                fillColor: selected ? "#34d399" : "#e2e8f0",
                fillOpacity: selected ? 0.9 : 0.8,
              }}
              eventHandlers={{
                click: () => onStopClick(stop.id),
              }}
            >
              <Tooltip direction="top" offset={[0, -2]} opacity={0.9}>
                <div className="text-xs font-semibold text-slate-900">
                  {stop.name}
                </div>
                <div className="text-[10px] text-slate-600">{stop.id}</div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
