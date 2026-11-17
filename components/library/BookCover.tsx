// A plain-colour cover with the title. PDFs have no cover art, and rendering one would slow uploads.
const COLOURS = ["#5e3b27", "#31483f", "#94532e", "#443e58", "#6d6038", "#563238"];

export function coverColour(id: string): string {
  let n = 0;
  for (const c of id) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return COLOURS[n % COLOURS.length];
}

export function BookCover({ id, title, pageCount, className = "", badge }: { id: string; title: string; pageCount?: number; className?: string; badge?: string }) {
  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden rounded-l-[4px] rounded-r-lg py-3.5 pl-[18px] pr-3 font-serif text-[#f6eedf] ${className}`}
      style={{ background: coverColour(id), boxShadow: "0 10px 22px -12px rgba(42,34,27,.55), inset 6px 0 0 rgba(0,0,0,.18)" }}
      aria-hidden="true"
    >
      {badge && <span className="absolute left-3.5 top-2.5 rounded-full bg-ochre px-2 py-0.5 font-sans text-[11px] font-bold text-ink">{badge}</span>}
      <b className={`line-clamp-4 font-bold leading-tight ${badge ? "mt-6" : ""}`}>{title}</b>
      {!!pageCount && <small className="font-sans text-[11px] opacity-85">{pageCount} pages</small>}
    </div>
  );
}
