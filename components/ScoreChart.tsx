"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MASTERY_PCT } from "@/convex/progress";

type Point = { at: number; percent: number };

function fmt(at: number) {
  return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Single series: every quiz attempt's score over time, with the mastery line for reference.
export function ScoreChart({ data }: { data: Point[] }) {
  const rows = data.map((d, i) => ({ ...d, n: i + 1 }));
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 12, right: 16, bottom: 4, left: -16 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="0" vertical={false} />
          <XAxis dataKey="n" tick={{ fill: "var(--muted)", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "var(--line)" }}
            label={{ value: "Quiz attempt #", position: "insideBottomRight", offset: -2, fill: "var(--muted)", fontSize: 11 }} />
          <YAxis domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tickFormatter={(v) => `${v}%`}
            tick={{ fill: "var(--muted)", fontSize: 12 }} tickLine={false} axisLine={false} />
          <ReferenceLine y={MASTERY_PCT} stroke="var(--muted)" strokeDasharray="4 4"
            label={{ value: "Mastery", position: "insideTopLeft", fill: "var(--muted)", fontSize: 11 }} />
          <Tooltip
            cursor={{ stroke: "var(--muted)", strokeWidth: 1 }}
            contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--ink)" }}
            labelFormatter={(_, p) => (p?.[0] ? `Attempt ${p[0].payload.n} · ${fmt(p[0].payload.at)}` : "")}
            formatter={(v) => [`${v}%`, "Score"]}
          />
          <Line type="monotone" dataKey="percent" stroke="var(--accent)" strokeWidth={2}
            dot={{ r: 4, fill: "var(--accent)", stroke: "var(--card)", strokeWidth: 2 }}
            activeDot={{ r: 6, stroke: "var(--card)", strokeWidth: 2 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
