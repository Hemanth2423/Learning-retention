"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";

// A collapsible concept map: course → pillars → sub-ideas → finer points.
// Starts with only the first level open; (+) on a node opens the next level.

type Node = { id: string; label: string; depth: number; href?: string; children: Node[] };
type Placed = { node: Node; x: number; y: number; w: number; parent?: Placed };

const ROW = 46; // vertical space per visible leaf
const H = 34; // node height
const COL_GAP = 56; // horizontal space for the connecting curves
const MAX_W = 340;

const STYLE = [
  "bg-ink text-paper border-ink font-semibold",
  "bg-accent-soft border-accent/60 font-medium",
  "bg-good/10 border-good/40",
  "bg-paper border-line text-muted",
];
const CURVE = ["var(--accent)", "var(--accent)", "var(--line)"];

let canvas: HTMLCanvasElement | null = null;
function textWidth(text: string, bold: boolean) {
  if (typeof document === "undefined") return text.length * 7.5;
  canvas ??= document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  // Measure with the font the page actually renders (next/font gives Inter a generated family name).
  ctx.font = `${bold ? 600 : 400} 14px ${getComputedStyle(document.body).fontFamily}`;
  return ctx.measureText(text).width;
}

// Text + padding (24) + borders, plus room for the (+) button; a few px spare for rounding.
const nodeWidth = (n: Node) => Math.min(MAX_W, textWidth(n.label, n.depth <= 1) + (n.children.length ? 60 : 32));

// Places visible nodes: each leaf takes one row; a parent sits centred on its children.
function layout(root: Node, open: Set<string>) {
  const placed: Placed[] = [];
  const colW: number[] = [];
  const visit = (n: Node) => {
    colW[n.depth] = Math.max(colW[n.depth] ?? 0, nodeWidth(n));
    if (open.has(n.id)) n.children.forEach(visit);
  };
  visit(root);
  const colX = colW.map((_, d) => colW.slice(0, d).reduce((a, b) => a + b + COL_GAP, 0));

  let row = 0;
  const place = (n: Node, parent?: Placed): Placed => {
    const p: Placed = { node: n, x: colX[n.depth], y: 0, w: nodeWidth(n), parent };
    placed.push(p);
    const kids = open.has(n.id) ? n.children.map((c) => place(c, p)) : [];
    p.y = kids.length ? (kids[0].y + kids[kids.length - 1].y) / 2 : row++ * ROW;
    return p;
  };
  place(root);
  const width = colX[colX.length - 1] + colW[colW.length - 1];
  return { placed, width, height: Math.max(row, 1) * ROW };
}

export function MindMap({ courseId, title }: { courseId: string; title: string }) {
  const topics = useQuery(api.topics.listByCourse, { courseId });
  const [open, setOpen] = useState<Set<string>>(() => new Set(["root"]));

  const root = useMemo<Node | null>(() => {
    if (!topics) return null;
    return {
      id: "root",
      label: title,
      depth: 0,
      children: topics.map((t) => ({
        id: t._id,
        label: t.title,
        depth: 1,
        href: `/topics/${t._id}`,
        children: t.subIdeas.map((s, i) => ({
          id: `${t._id}-${i}`,
          label: s.title,
          depth: 2,
          children: s.children.map((c, j) => ({ id: `${t._id}-${i}-${j}`, label: c, depth: 3, children: [] })),
        })),
      })),
    };
  }, [topics, title]);

  const allIds = useMemo(() => {
    const ids: string[] = [];
    const walk = (n: Node) => {
      if (n.children.length) ids.push(n.id);
      n.children.forEach(walk);
    };
    if (root) walk(root);
    return ids;
  }, [root]);

  if (!root) return null;
  const { placed, width, height } = layout(root, open);
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-2xl">Concept map</h2>
        <div className="flex gap-2">
          <button className="btn-ghost px-3 py-1 text-xs" onClick={() => setOpen(new Set(allIds))}>Expand all</button>
          <button className="btn-ghost px-3 py-1 text-xs" onClick={() => setOpen(new Set(["root"]))}>Collapse</button>
        </div>
      </div>
      <div className="card overflow-x-auto p-6">
        <div className="relative" style={{ width, height }}>
          <svg className="pointer-events-none absolute inset-0" width={width} height={height} aria-hidden="true">
            {placed
              .filter((p) => p.parent)
              .map((p) => {
                const a = p.parent!;
                const x1 = a.x + a.w;
                const y1 = a.y + H / 2;
                const x2 = p.x;
                const y2 = p.y + H / 2;
                const mx = (x1 + x2) / 2;
                return (
                  <path
                    key={p.node.id}
                    d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                    fill="none"
                    stroke={CURVE[a.node.depth] ?? "var(--line)"}
                    strokeOpacity={0.6}
                    strokeWidth={1.5}
                  />
                );
              })}
          </svg>
          {placed.map((p) => {
            const n = p.node;
            const isOpen = open.has(n.id);
            const label = n.href ? (
              <Link href={n.href} className="truncate hover:underline" title={`Open the lesson: ${n.label}`}>{n.label}</Link>
            ) : (
              <span className="truncate" title={n.label}>{n.label}</span>
            );
            return (
              <div
                key={n.id}
                className={`absolute flex items-center gap-2 rounded-lg border px-3 text-sm ${STYLE[n.depth] ?? STYLE[3]}`}
                style={{ left: p.x, top: p.y, width: p.w, height: H }}
              >
                <span className="flex min-w-0 flex-1">{label}</span>
                {n.children.length > 0 && (
                  <button
                    onClick={() => toggle(n.id)}
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? "Collapse" : "Expand"} ${n.label}`}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-sm leading-none ${
                      n.depth === 0 ? "bg-paper/20 text-paper" : "bg-accent text-[#1E2A3A]"
                    }`}
                  >
                    {isOpen ? "−" : "+"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">Click (+) to go deeper. Click a pillar&apos;s name to open its lesson.</p>
    </section>
  );
}
