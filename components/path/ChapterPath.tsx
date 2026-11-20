"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { ChapterRange } from "@/convex/chapters";
import { Bulb } from "@/components/icons/Bulb";
import { readableTitle } from "@/components/reader/text";

export type Stop = ChapterRange & { pct: number; read: boolean; hasNote: boolean; current: boolean; label: string; openAt: number; best?: string };

const pip = "inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-2.5 py-0.5 pl-1.5 text-label font-semibold";
const pipIdle = `${pip} border-line bg-card text-muted hover:border-accent hover:text-ink`;
const pipDone = `${pip} border-good-line bg-good-soft text-[#2f4a2b] after:font-bold after:text-good after:content-['✓']`;

// A ring around the circle shows how much of the chapter has been read.
function Ring({ pct }: { pct: number }) {
  if (pct <= 0 || pct >= 100) return null;
  const mask = "radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px))";
  return (
    <span
      aria-hidden="true"
      className="absolute -inset-2 rounded-full"
      style={{ background: `conic-gradient(var(--good) ${pct * 3.6}deg, transparent 0)`, WebkitMask: mask, mask }}
    />
  );
}

export function ChapterPath({ documentId, stops }: { documentId: Id<"documents">; stops: Stop[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [trail, setTrail] = useState("");

  // The dotted trail joins the centres of the circles.
  const draw = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const box = wrap.getBoundingClientRect();
    const pts = [...wrap.querySelectorAll<HTMLElement>("[data-node]")].map((n) => {
      const r = n.getBoundingClientRect();
      return [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top];
    });
    if (pts.length < 2) return setTrail("");
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const my = (y0 + y1) / 2;
      d += ` C ${x0} ${my}, ${x1} ${my}, ${x1} ${y1}`;
    }
    setTrail(d);
  }, []);

  useLayoutEffect(() => {
    draw();
    const ro = new ResizeObserver(draw);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [draw, stops]);

  const book = `/read/${documentId}/book`;

  // Open the path where the reader is: the current chapter second from the top, with the one before it above.
  const scrolled = useRef(false);
  useEffect(() => {
    if (scrolled.current || !wrapRef.current) return;
    const items = [...wrapRef.current.querySelectorAll<HTMLElement>("li")];
    const at = stops.findIndex((s) => s.current);
    if (at <= 0 || !items[at - 1]) return;
    scrolled.current = true;
    const header = document.querySelector("header")?.getBoundingClientRect().height ?? 0;
    window.scrollTo({ top: items[at - 1].getBoundingClientRect().top + window.scrollY - header - 16 });
  }, [stops]);

  return (
    <div ref={wrapRef} className="relative pb-10 pt-2.5" aria-label="Chapters">
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
        <path d={trail} fill="none" stroke="#b9a88f" strokeWidth="4" strokeDasharray="2 10" strokeLinecap="round" />
      </svg>
      <ol>
        {stops.map((s, i) => {
          const node = s.read
            ? "bg-good text-white shadow-[0_5px_0_var(--ink)]"
            : s.current
              ? "bg-accent text-white"
              : s.pct > 0
                ? "bg-card shadow-[0_5px_0_var(--ink)]"
                : "border-dashed bg-panel text-muted";
          return (
            <li key={s.key} className={`relative z-[1] mb-7 flex items-start gap-4 ${i % 2 ? "md:ml-[38%]" : "md:ml-[4%]"}`}>
              <span data-node className={`relative grid h-[66px] w-[66px] shrink-0 place-items-center rounded-full border-[3px] border-ink font-game text-ui ${node}`}>
                <Ring pct={s.pct} />
                {s.label}
              </span>
              <div className="min-w-0 max-w-[380px] pt-0.5">
                <p className="text-label font-semibold text-muted">
                  {s.current ? "You're here · " : ""}
                  {s.pct}% read
                </p>
                <p className="font-serif text-h3 font-semibold leading-snug">{readableTitle(s.title)}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Link href={`${book}?page=${s.openAt}`} className={s.read ? pipDone : pipIdle} title={s.pct > 0 && !s.read ? "Continue where you left off" : "Open this chapter"}>
                    <span aria-hidden="true">📖</span>Read {s.pct}%
                  </Link>
                  <Link href={`${book}?page=${s.openAt}&notes=${encodeURIComponent(s.key)}`} className={s.hasNote ? pipDone : pipIdle} title={s.hasNote ? "Open your note" : "Write a note"}>
                    <span aria-hidden="true">✏️</span>Notes
                  </Link>
                  <Link href={`/read/${documentId}/test?chapter=${encodeURIComponent(s.key)}`} className={s.best ? pipDone : pipIdle} title={s.best ? "Your best score · test again" : "Test yourself"}>
                    <Bulb size={16} />
                    Test{s.best ? ` ${s.best}` : ""}
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
