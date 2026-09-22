"use client";

import { useId } from "react";
import { money } from "@/lib/client";

type Point = { label: string; value: number; secondary?: number };

export function LineAreaChart({
  data,
  height = 200,
  valueLabel = "Revenue",
}: {
  data: Point[];
  height?: number;
  valueLabel?: string;
}) {
  const gradientId = useId();
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-neutral-400">
        No data for this range yet.
      </div>
    );
  }
  const width = 640;
  const max = Math.max(...data.map((d) => d.value), 1);
  const step = data.length > 1 ? width / (data.length - 1) : width;
  const points = data.map((d, i) => {
    const x = data.length > 1 ? i * step : width / 2;
    const y = height - 30 - (d.value / max) * (height - 60);
    return { x, y, ...d };
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${path} L${points[points.length - 1]!.x.toFixed(1)},${height - 20} L${points[0]!.x.toFixed(1)},${height - 20} Z`;

  return (
    <figure className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${valueLabel} trend chart`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#31a95c" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#31a95c" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => (
          <line
            key={i}
            x1="0"
            x2={width}
            y1={20 + i * ((height - 60) / 3)}
            y2={20 + i * ((height - 60) / 3)}
            stroke="#ddf6e3"
            strokeWidth="1"
          />
        ))}
        <path d={area} fill={`url(#${gradientId})`} />
        <path d={path} fill="none" stroke="#218a49" strokeWidth="2.5" strokeLinecap="round" />
        {points.map((p) => (
          <circle key={p.label} cx={p.x} cy={p.y} r="3" fill="#fff" stroke="#218a49" strokeWidth="2" />
        ))}
        {points.map((p, i) =>
          i % Math.ceil(data.length / 7) === 0 ? (
            <text key={`t-${p.label}`} x={p.x} y={height - 4} textAnchor="middle" fontSize="11" fill="#6b7280">
              {p.label}
            </text>
          ) : null,
        )}
      </svg>
      <figcaption className="mt-1 text-[11px] text-neutral-500">
        Peak {valueLabel.toLowerCase()}: {money(max)}
      </figcaption>
    </figure>
  );
}

export function BarChart({ data, valueLabel = "Orders" }: { data: Point[]; valueLabel?: string }) {
  if (data.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-neutral-400">No data yet.</div>
    );
  }
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className="space-y-2" aria-label={`${valueLabel} bar chart`}>
      {data.map((d) => (
        <li key={d.label} className="flex items-center gap-3 text-xs">
          <span className="w-28 shrink-0 truncate text-neutral-600">{d.label}</span>
          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-brand-50">
            <span
              className="block h-full rounded-full bg-brand-500"
              style={{ width: `${Math.max(4, (d.value / max) * 100)}%` }}
            />
          </span>
          <span className="w-20 shrink-0 text-right font-medium text-ink">
            {d.secondary != null ? money(d.value) : d.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: "#31a95c",
  PREPARING: "#f59e0b",
  PACKED: "#3b82f6",
  OUT_FOR_DELIVERY: "#8b5cf6",
  DELIVERED: "#059669",
  CANCELLED: "#ef4444",
};

export function StatusDonut({ data }: { data: { label: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return <p className="py-8 text-center text-sm text-neutral-400">No orders in this range.</p>;
  }
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const segments: { label: string; value: number; dash: number; offset: number }[] = [];
  let running = 0;
  for (const point of data) {
    const dash = (point.value / total) * circumference;
    segments.push({ ...point, dash, offset: running });
    running += dash;
  }
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 140 140" className="h-36 w-36" role="img" aria-label="Order status distribution">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="18" />
        {segments.map((segment) => (
          <circle
            key={segment.label}
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={STATUS_COLORS[segment.label] ?? "#94a3b8"}
            strokeWidth="18"
            strokeDasharray={`${segment.dash} ${circumference - segment.dash}`}
            strokeDashoffset={-segment.offset}
            transform="rotate(-90 70 70)"
          />
        ))}
        <text x="70" y="66" textAnchor="middle" fontSize="18" fontWeight="600" fill="#12261a">
          {total}
        </text>
        <text x="70" y="84" textAnchor="middle" fontSize="10" fill="#6b7280">
          orders
        </text>
      </svg>
      <ul className="space-y-1.5 text-xs">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: STATUS_COLORS[d.label] ?? "#94a3b8" }}
            />
            <span className="text-neutral-600">{d.label.replace(/_/g, " ").toLowerCase()}</span>
            <span className="font-semibold text-ink">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
