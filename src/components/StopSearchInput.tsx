"use client";

import { useMemo, useState } from "react";
import type { Stop, StopsIndex } from "minotor";

type StopSearchInputProps = {
  label: string;
  placeholder?: string;
  stopsIndex: StopsIndex | null;
  selectedStop: Stop | null;
  onSelect: (stop: Stop) => void;
  helperText?: string;
};

export function StopSearchInput({
  label,
  placeholder,
  stopsIndex,
  selectedStop,
  onSelect,
  helperText,
}: StopSearchInputProps) {
  const [query, setQuery] = useState("");
  const displayValue =
    selectedStop && query.trim().length === 0 ? selectedStop.name : query;

  const results = useMemo(() => {
    if (!stopsIndex) return [];
    const q = query.trim();
    if (q.length === 0) return [];
    return stopsIndex.findStopsByName(q, 6);
  }, [query, stopsIndex]);

  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
        <span>{label}</span>
        {selectedStop ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
            {selectedStop.name}
          </span>
        ) : null}
      </div>
      <input
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
        placeholder={placeholder ?? "停留所名で検索"}
        value={displayValue}
        disabled={!stopsIndex}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="flex flex-wrap gap-2 text-[11px] leading-relaxed text-slate-500">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
          地図クリックでも設定可能
        </span>
        {helperText ? <span>{helperText}</span> : null}
      </div>
      {results.length > 0 ? (
        <div className="grid gap-2 rounded-xl bg-slate-50/80 p-2">
          {results.map((stop) => (
            <button
              key={stop.sourceStopId}
              type="button"
              className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-800 transition hover:bg-white hover:shadow-sm"
              onClick={() => {
                onSelect(stop);
                setQuery(stop.name);
              }}
            >
              <span className="font-semibold">{stop.name}</span>
              <span className="text-xs text-slate-500">{stop.sourceStopId}</span>
            </button>
          ))}
        </div>
      ) : query.trim().length > 0 && stopsIndex ? (
        <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
          一致する停留所が見つかりませんでした
        </div>
      ) : null}
    </div>
  );
}
