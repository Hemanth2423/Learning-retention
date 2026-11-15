"use client";

// Text with [1] markers turned into small buttons that jump to the page the passage came from.
export function CitedText({ text, pages, onJump }: { text: string; pages: { n: number; page: number }[]; onJump: (page: number) => void }) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = /^\[(\d+)\]$/.exec(part);
        const page = m ? pages.find((p) => p.n === Number(m[1]))?.page : undefined;
        if (!m || !page) return <span key={i}>{part}</span>;
        return (
          <button
            key={i}
            onClick={() => onJump(page)}
            title={`Go to page ${page}`}
            aria-label={`Go to page ${page}`}
            className="mx-0.5 inline-flex min-w-5 items-center justify-center rounded bg-accent-soft px-1 text-xs font-semibold text-ink hover:bg-accent"
          >
            {m[1]}
          </button>
        );
      })}
    </>
  );
}
