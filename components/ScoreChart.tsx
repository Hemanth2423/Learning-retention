"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = { at: number; percent: number; count: number };

function fmt(at: number) {
  return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Single series: the share of check questions answered right, per day.
export function ScoreChart({ data }: { data: Point[] }) {
  const rows = data.map((d) => ({ ...d, day: fmt(d.at) }));
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 12, right: 16, bottom: 4, left: -16 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="0" vertical={false} />
          <XAxis dataKey="day" tick={{ fill: "var(--muted)", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "var(--line)" }} />
          <YAxis domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tickFormatter={(v) => `${v}%`}
            tick={{ fill: "var(--muted)", fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ stroke: "var(--muted)", strokeWidth: 1 }}
            contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--ink)" }}
            labelFormatter={(_, p) => (p?.[0] ? `${p[0].payload.day} · ${p[0].payload.count} answered` : "")}
            formatter={(v) => [`${v}%`, "Right"]}
          />
          <Line type="monotone" dataKey="percent" stroke="var(--accent)" strokeWidth={2}
            dot={{ r: 4, fill: "var(--accent)", stroke: "var(--card)", strokeWidth: 2 }}
            activeDot={{ r: 6, stroke: "var(--card)", strokeWidth: 2 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
