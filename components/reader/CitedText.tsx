"use client";

import { createContext, useContext } from "react";

type Piece = { kind: "text"; text: string } | { kind: "page"; page: number };

// Splits "… own [1][2]." into text and page chips, keeping one chip when back-to-back markers point at the same page.
function pieces(text: string, pages: { n: number; page: number }[]): Piece[] {
  const out: Piece[] = [];
  for (const part of text.split(/(\[\d+\])/g)) {
    const m = /^\[(\d+)\]$/.exec(part);
    const page = m ? pages.find((p) => p.n === Number(m[1]))?.page : undefined;
    if (!m || !page) {
      if (part) out.push({ kind: "text", text: part });
      continue;
    }
    const prev = out[out.length - 1];
    if (prev?.kind === "page" && prev.page === page) continue;
    out.push({ kind: "page", page });
  }
  return out;
}

// What a cited "page" is: a PDF page ("p.214"), or a part of an article's text ("§3").
export const CiteUnit = createContext<"page" | "part">("page");

// Text with small "p.214" chips that jump to the page each passage came from.
export function CitedText({ text, pages, onJump }: { text: string; pages: { n: number; page: number }[]; onJump: (page: number) => void }) {
  const unit = useContext(CiteUnit);
  return (
    <>
      {pieces(text, pages).map((p, i) =>
        p.kind === "text" ? (
          <span key={i}>{p.text}</span>
        ) : (
          <button
            key={i}
            onClick={() => onJump(p.page)}
            title={`Go to ${unit} ${p.page}`}
            aria-label={`Go to ${unit} ${p.page}`}
            className="mx-0.5 inline-flex items-center rounded-md bg-ochre px-1.5 align-[1px] text-[11px] font-bold leading-5 text-ink hover:bg-accent hover:text-white"
          >
            {unit === "page" ? "p." : "§"}
            {p.page}
          </button>
        )
      )}
    </>
  );
}
