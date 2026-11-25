"use client";

import { useAction } from "convex/react";
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, SimulationNodeDatum } from "d3-force";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Cell, Mode, Relation, RELATIONS, Status } from "@/convex/conceptRules";
import { MODE_INFO, MODE_LIST, StatusPill } from "./shared";

type Idea = { id: string; name: string; objective: string; page: number };
type Link = { from: string; to: string; type: string; note: string };
type Node = SimulationNodeDatum & { id: string };

const W = 680;
const H = 440;
const R = 30;
const RING = { solid: "var(--good)", shaky: "#d4a72c", needs_practice: "var(--accent)" } as const;

// The highest level with a pass on record (solid or shaky), and how solid it is. Not checked anywhere = null.
function reached(cells: Cell[], ideaId: string): { mode: Mode | null; status: Status } {
  const mine = MODE_LIST.map((m) => cells.find((c) => c.ideaId === ideaId && c.mode === m)!);
  const top = [...mine].reverse().find((c) => c.status === "solid" || c.status === "shaky");
  if (top) return { mode: top.mode, status: top.status };
  return { mode: null, status: mine.some((c) => c.status === "needs_practice") ? "needs_practice" : "not_checked" };
}

// d3-force, run to a fixed number of steps from a circle in page order, so the same ideas always land in the same
// place. Then scaled to fit the frame.
function layout(ideas: Idea[], links: Link[]) {
  const nodes: Node[] = ideas.map((i, n) => {
    const a = (n / ideas.length) * 2 * Math.PI - Math.PI / 2;
    return { id: i.id, x: Math.cos(a) * 200, y: Math.sin(a) * 140 };
  });
  const sim = forceSimulation(nodes)
    .force("link", forceLink<Node, { source: string; target: string }>(links.map((l) => ({ source: l.from, target: l.to }))).id((d) => d.id).distance(200).strength(0.4))
    .force("charge", forceManyBody().strength(-700))
    .force("collide", forceCollide(82))
    .force("x", forceX(0).strength(0.05))
    .force("y", forceY(0).strength(0.08))
    .stop();
  sim.tick(300);
  const xs = nodes.map((n) => n.x!);
  const ys = nodes.map((n) => n.y!);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const pad = { x: 90, top: 50, bottom: 70 };
  const scale = Math.min((W - 2 * pad.x) / Math.max(maxX - minX, 1), (H - pad.top - pad.bottom) / Math.max(maxY - minY, 1), 1.4);
  const cx = (W - (maxX - minX) * scale) / 2;
  const cy = pad.top + (H - pad.top - pad.bottom - (maxY - minY) * scale) / 2;
  return new Map(nodes.map((n) => [n.id, { x: cx + (n.x! - minX) * scale, y: cy + (n.y! - minY) * scale }]));
}

// Splits a name into at most two short lines for under the node.
function lines(name: string, max = 18) {
  const words = name.split(" ");
  const out = [""];
  for (const w of words) {
    const line = out[out.length - 1];
    if (!line || (line + " " + w).length <= max) out[out.length - 1] = line ? `${line} ${w}` : w;
    else if (out.length < 2) out.push(w);
    else {
      out[1] = `${out[1].slice(0, max - 1)}…`;
      break;
    }
  }
  return out;
}

const relationLabel = (type: string) => (RELATIONS as Record<string, { label: string }>)[type]?.label ?? "relates to";

export function ConceptMap({
  checkId,
  ideas,
  cells,
  links,
  canMapLinks,
  pageHref,
  pageLabel,
  busy,
  onPractice,
}: {
  checkId: Id<"conceptChecks">;
  ideas: Idea[];
  cells: Cell[];
  links: Link[] | null;
  canMapLinks: boolean;
  pageHref: (page: number) => string;
  pageLabel: string;
  busy: boolean;
  onPractice: () => void;
}) {
  const mapLinks = useAction(api.concepts.mapLinks);
  const asked = useRef(false);
  const [mapping, setMapping] = useState(false);
  const [selected, setSelected] = useState(ideas[0]?.id ?? "");
  const shown = useMemo(() => links ?? [], [links]);
  const pos = useMemo(() => layout(ideas, shown), [ideas, shown]);

  // Older checks were made before links existed: map them once, the first time the map opens.
  useEffect(() => {
    if (links || !canMapLinks || asked.current) return;
    asked.current = true;
    setMapping(true);
    void mapLinks({ checkId })
      .catch(() => {})
      .finally(() => setMapping(false));
  }, [links, canMapLinks, checkId, mapLinks]);

  const idea = ideas.find((i) => i.id === selected) ?? ideas[0];
  const name = (id: string) => ideas.find((i) => i.id === id)?.name ?? "";
  const mine = shown.filter((l) => l.from === idea?.id || l.to === idea?.id);

  return (
    <main className="mx-auto max-w-[1080px] px-4 pb-16 pt-3 md:px-7">
      <p className="font-game text-label tracking-wider text-accent-dark">CONCEPT MAP</p>
      <h1 className="mt-1 font-serif text-h1 font-bold leading-tight">How the ideas connect, and how far you&apos;ve climbed on each</h1>
      <p className="mt-1 text-meta text-muted">
        Fill = highest level you&apos;ve passed · ring = how solid it is · faded = not checked yet. Select an idea.
        {mapping ? " Mapping how these ideas connect…" : !links && !canMapLinks ? " We couldn't map links for this chapter, so ideas are shown in page order." : ""}
      </p>
      <div className="mt-3 grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_300px]">
        <div className="rounded-[18px] border border-line bg-card p-2">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="group" aria-label="Concept map of this chapter's ideas">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M0,0 L10,5 L0,10 z" fill="#b9a88f" />
              </marker>
            </defs>
            {shown.map((l) => {
              const a = pos.get(l.from);
              const b = pos.get(l.to);
              if (!a || !b) return null;
              const ang = Math.atan2(b.y - a.y, b.x - a.x);
              const gap = R + 8;
              const [sx, sy, ex, ey] = [a.x + Math.cos(ang) * gap, a.y + Math.sin(ang) * gap, b.x - Math.cos(ang) * (gap + 3), b.y - Math.sin(ang) * (gap + 3)];
              const on = l.from === idea?.id || l.to === idea?.id;
              return (
                <g key={`${l.from}-${l.to}`} opacity={on ? 1 : 0.55}>
                  <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={on ? "#8f7d63" : "#b9a88f"} strokeWidth={on ? 3 : 2.2} strokeDasharray={l.type === "contrasts" ? "6 5" : undefined} markerEnd={l.type === "contrasts" ? undefined : "url(#arrow)"} />
                  <text x={(sx + ex) / 2} y={(sy + ey) / 2 - 6} textAnchor="middle" fontSize="11.5" fontWeight={on ? 700 : 500} fill="var(--muted)" stroke="var(--card)" strokeWidth="4" paintOrder="stroke">
                    {relationLabel(l.type)}
                  </text>
                </g>
              );
            })}
            {ideas.map((i) => {
              const p = pos.get(i.id)!;
              const r = reached(cells, i.id);
              const isSel = i.id === idea?.id;
              const fill = r.mode ? `color-mix(in srgb, ${MODE_INFO[r.mode].colour} 45%, white)` : "#efe6d8";
              const choose = () => setSelected(i.id);
              return (
                <g
                  key={i.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSel}
                  aria-label={`${i.name}: ${r.mode ? `passed ${MODE_INFO[r.mode].label}` : r.status === "needs_practice" ? "needs practice" : "not checked yet"}`}
                  className="cursor-pointer outline-none [&:focus-visible>circle.body]:stroke-[#1f5fbf]"
                  opacity={r.status === "not_checked" ? 0.6 : 1}
                  onClick={choose}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      choose();
                    }
                  }}
                >
                  <circle className="body" cx={p.x} cy={p.y} r={R} fill={fill} stroke={isSel ? "var(--ink)" : "#c9b9a0"} strokeWidth={isSel ? 3 : 1.5} />
                  <circle cx={p.x} cy={p.y} r={R + 5} fill="none" stroke={r.status === "not_checked" ? "#d9ccb6" : RING[r.status]} strokeWidth={5} strokeDasharray={r.status === "not_checked" ? "4 5" : undefined} />
                  <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="var(--ink)">
                    {r.mode ? MODE_INFO[r.mode].label : r.status === "needs_practice" ? "Practice" : "—"}
                  </text>
                  {lines(i.name).map((t, n, all) => (
                    // Names sit on the outer side of the map, away from where links arrive.
                    <text key={n} x={p.x} y={p.y < H / 2 - 10 ? p.y - R - 14 - (all.length - 1 - n) * 15 : p.y + R + 20 + n * 15} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--ink)" stroke="var(--card)" strokeWidth="4" paintOrder="stroke">
                      {t}
                    </text>
                  ))}
                </g>
              );
            })}
          </svg>
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-2 pb-1 text-meta text-muted">
            {MODE_LIST.map((m) => (
              <span key={m} className="inline-flex items-center gap-1.5">
                <i className="size-3.5 rounded-full border border-line" style={{ background: `color-mix(in srgb, ${MODE_INFO[m].colour} 45%, white)` }} />
                {MODE_INFO[m].label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5"><i className="size-3.5 rounded-full border-[3px] border-good" />Solid</span>
            <span className="inline-flex items-center gap-1.5"><i className="size-3.5 rounded-full border-[3px] border-[#d4a72c]" />Shaky</span>
            <span className="inline-flex items-center gap-1.5"><i className="size-3.5 rounded-full border-[3px] border-accent" />Needs practice</span>
          </div>
        </div>

        {idea && (
          <aside className="rounded-[18px] border border-line bg-card p-4" aria-live="polite">
            <p className="text-label font-bold uppercase tracking-[0.08em] text-muted">Idea</p>
            <h2 className="font-serif text-h2 font-bold">{idea.name}</h2>
            <p className="mt-1 text-meta text-muted">{idea.objective}</p>
            <dl className="mt-3 space-y-1.5">
              {MODE_LIST.map((m) => (
                <div key={m} className="grid grid-cols-[92px_1fr] items-center gap-2 text-meta">
                  <dt>{MODE_INFO[m].label}</dt>
                  <dd>
                    <StatusPill status={cells.find((c) => c.ideaId === idea.id && c.mode === m)!.status} />
                  </dd>
                </div>
              ))}
            </dl>
            {mine.length > 0 && (
              <>
                <p className="mt-4 text-label font-bold uppercase tracking-[0.08em] text-muted">Connections</p>
                <ul className="mt-1 space-y-2 text-meta">
                  {mine.map((l) => (
                    <li key={`${l.from}-${l.to}`}>
                      <button type="button" className="text-left" onClick={() => setSelected(l.from === idea.id ? l.to : l.from)}>
                        <b>{name(l.from)}</b> <span className="text-accent-dark">{relationLabel(l.type)}</span> <b>{name(l.to)}</b>
                      </button>
                      {l.note && <span className="block text-muted">{l.note}</span>}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="chunky sm" disabled={busy} onClick={onPractice}>
                Practice this chapter
              </button>
              <a className="quiet" href={pageHref(idea.page)}>
                📖 Reread {pageLabel}
                {idea.page}
              </a>
            </div>
          </aside>
        )}
      </div>
      <details className="mt-4 rounded-xl border border-line bg-card px-4 py-3 text-meta">
        <summary className="cursor-pointer font-semibold">Where the links come from</summary>
        <p className="mt-2 text-muted">
          Each link is one of {Object.keys(RELATIONS).length} relation types drawn from standard vocabularies (RDFS, SKOS, the OBO Relation Ontology and BFO). The AI picks a type
          only when the chapter connects the two ideas, and anything else is dropped.
        </p>
        <ul className="mt-2 grid gap-1 text-muted sm:grid-cols-2">
          {(Object.entries(RELATIONS) as [Relation, (typeof RELATIONS)[Relation]][]).map(([k, r]) => (
            <li key={k}>
              <b className="text-ink">{r.label}</b> · {r.source}
            </li>
          ))}
        </ul>
      </details>
    </main>
  );
}
