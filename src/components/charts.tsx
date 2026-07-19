"use client";

import { useState } from "react";
import { cn, formatCurrency } from "@/lib/utils";

// Lightweight, dependency-free SVG charts built to the dataviz method:
// validated categorical palette, one axis, thin marks with rounded data-ends,
// recessive gridlines, hover tooltips, and legends/labels so identity is never
// color-alone. Colors work in light & dark (chart ink uses currentColor via
// text tokens; series use fixed brand-safe hues).

// Validated categorical palette (passes CVD checks — see dataviz validator).
export const SERIES = ["#c400d6", "#1aa79f", "#e8850c", "#3b6ef5", "#65a30d"];

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

// ---- Grouped/overlaid trend: revenue + profit bars over time ----

export function TrendChart({
  data,
  height = 220,
}: {
  data: { label: string; revenue: number; profit: number }[];
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(1, ...data.map((d) => d.revenue)));
  const n = data.length || 1;
  const barW = 100 / n;

  return (
    <div className="relative">
      <div className="mb-2 flex items-center gap-4 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[0] }} />
          Revenue
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[1] }} />
          Gross profit
        </span>
      </div>
      <div className="relative" style={{ height }}>
        {/* gridlines */}
        <div className="absolute inset-0 flex flex-col justify-between">
          {[1, 0.75, 0.5, 0.25, 0].map((f) => (
            <div key={f} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-right text-[10px] text-ink-faint">
                {formatCurrency(max * f).replace(/\.00$/, "")}
              </span>
              <div className="h-px flex-1 bg-surface-border" />
            </div>
          ))}
        </div>
        {/* bars */}
        <svg
          className="absolute inset-0 ml-16"
          style={{ width: "calc(100% - 4rem)", height }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {data.map((d, i) => {
            const x = i * barW;
            const rH = (d.revenue / max) * 100;
            const pH = (d.profit / max) * 100;
            const isHover = hover === i;
            return (
              <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={x} y={0} width={barW} height={100} fill="transparent" />
                <rect
                  x={x + barW * 0.18}
                  y={100 - rH}
                  width={barW * 0.32}
                  height={rH}
                  rx={1}
                  fill={SERIES[0]}
                  opacity={hover === null || isHover ? 1 : 0.45}
                />
                <rect
                  x={x + barW * 0.5}
                  y={100 - pH}
                  width={barW * 0.32}
                  height={pH}
                  rx={1}
                  fill={SERIES[1]}
                  opacity={hover === null || isHover ? 1 : 0.45}
                />
              </g>
            );
          })}
        </svg>
      </div>
      {/* x labels */}
      <div className="ml-16 flex text-[10px] text-ink-faint">
        {data.map((d, i) => (
          <div key={i} className="text-center" style={{ width: `${barW}%` }}>
            {i % Math.ceil(n / 16) === 0 ? d.label : ""}
          </div>
        ))}
      </div>
      {/* tooltip */}
      {hover !== null && data[hover] && (
        <div className="pointer-events-none absolute right-2 top-0 rounded-lg border border-surface-border bg-surface px-3 py-2 text-xs shadow-pop">
          <div className="font-medium text-ink">{data[hover].label}</div>
          <div className="mt-1 flex items-center gap-1.5 text-ink-muted">
            <span className="h-2 w-2 rounded-sm" style={{ background: SERIES[0] }} />
            {formatCurrency(data[hover].revenue)}
          </div>
          <div className="flex items-center gap-1.5 text-ink-muted">
            <span className="h-2 w-2 rounded-sm" style={{ background: SERIES[1] }} />
            {formatCurrency(data[hover].profit)}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Horizontal bars (top products, categories) ----

export function BarList({
  data,
  valueFormat = "currency",
  colorIndex = 0,
}: {
  data: { label: string; value: number; sub?: string }[];
  valueFormat?: "currency" | "number";
  colorIndex?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const fmt = (v: number) =>
    valueFormat === "currency" ? formatCurrency(v) : String(v);
  return (
    <div className="space-y-2.5">
      {data.length === 0 && (
        <p className="py-6 text-center text-sm text-ink-faint">No data yet.</p>
      )}
      {data.map((d, i) => (
        <div key={i}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="min-w-0 truncate text-ink">{d.label}</span>
            <span className="ml-2 shrink-0 font-medium text-ink">
              {fmt(d.value)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(d.value / max) * 100}%`,
                background: SERIES[colorIndex % SERIES.length],
              }}
            />
          </div>
          {d.sub && (
            <div className="mt-0.5 text-[11px] text-ink-faint">{d.sub}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---- Donut (payment mix, online split) ----

export function Donut({
  data,
  size = 160,
}: {
  data: { label: string; value: number }[];
  size?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const [hover, setHover] = useState<number | null>(null);
  const R = 60;
  const C = 2 * Math.PI * R;
  let offset = 0;

  if (total === 0) {
    return (
      <div className="grid h-40 place-items-center text-sm text-ink-faint">
        No data yet.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox="0 0 160 160" className="shrink-0">
        <g transform="rotate(-90 80 80)">
          {data.map((d, i) => {
            const frac = d.value / total;
            const len = frac * C;
            const seg = (
              <circle
                key={i}
                cx={80}
                cy={80}
                r={R}
                fill="none"
                stroke={SERIES[i % SERIES.length]}
                strokeWidth={hover === i ? 22 : 18}
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{ transition: "stroke-width .1s" }}
              />
            );
            offset += len;
            return seg;
          })}
        </g>
        <text
          x={80}
          y={76}
          textAnchor="middle"
          className="fill-ink text-[13px] font-semibold"
        >
          {hover !== null
            ? `${((data[hover].value / total) * 100).toFixed(0)}%`
            : data.length}
        </text>
        <text
          x={80}
          y={92}
          textAnchor="middle"
          className="fill-ink-faint text-[9px]"
        >
          {hover !== null ? data[hover].label : "types"}
        </text>
      </svg>
      <div className="space-y-1.5">
        {data.map((d, i) => (
          <div
            key={i}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className="flex items-center gap-2 text-sm"
          >
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: SERIES[i % SERIES.length] }}
            />
            <span className="text-ink">{d.label}</span>
            <span className="text-ink-faint">
              {((d.value / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Simple column chart (traffic by hour / txns) ----

export function ColumnChart({
  data,
  height = 140,
  colorIndex = 3,
}: {
  data: { label: string; value: number }[];
  height?: number;
  colorIndex?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      <div className="flex items-end gap-1" style={{ height }}>
        {data.map((d, i) => (
          <div
            key={i}
            className="group relative flex flex-1 flex-col items-center justify-end"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            {hover === i && d.value > 0 && (
              <div className="absolute -top-6 whitespace-nowrap rounded bg-ink px-1.5 py-0.5 text-[10px] font-medium text-white">
                {d.value}
              </div>
            )}
            <div
              className="w-full rounded-t-sm transition-all"
              style={{
                height: `${(d.value / max) * 100}%`,
                minHeight: d.value > 0 ? 2 : 0,
                background: SERIES[colorIndex % SERIES.length],
                opacity: hover === null || hover === i ? 1 : 0.5,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 text-[9px] text-ink-faint">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center">
            {i % 2 === 0 ? d.label : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
