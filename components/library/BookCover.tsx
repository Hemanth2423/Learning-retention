// A plain-colour cover with the title. PDFs have no cover art, and rendering one would slow uploads.
const COLOURS = ["#5e3b27", "#31483f", "#94532e", "#443e58", "#6d6038", "#563238"];

export function coverColour(id: string): string {
  let n = 0;
  for (const c of id) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return COLOURS[n % COLOURS.length];
}

export function BookCover({
  id,
  title,
  pageCount,
  className = "",
  badge,
  imageUrl,
  kind = "pdf",
  label,
}: {
  id: string;
  title: string;
  pageCount?: number;
  className?: string;
  badge?: string;
  imageUrl?: string | null; // article preview image or YouTube thumbnail
  kind?: "pdf" | "article" | "video";
  label?: string; // site or channel, shown at the bottom
}) {
  if (imageUrl) {
    return (
      <div className={`relative overflow-hidden rounded-lg bg-ink ${className}`} style={{ boxShadow: "0 10px 22px -12px rgba(42,34,27,.55)" }} aria-hidden="true" title={title}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
        {kind === "video" && <span className="absolute inset-0 m-auto grid h-9 w-12 place-items-center rounded-lg bg-[#c4302b]/95 pl-0.5 text-sm text-white">▶</span>}
        {badge && <span className="absolute left-2.5 top-2.5 rounded-full bg-ochre px-2 py-0.5 font-sans text-[11px] font-bold text-ink">{badge}</span>}
        {label && <span className="absolute bottom-2.5 left-2.5 max-w-[85%] truncate rounded-md bg-ink/80 px-2 py-0.5 font-sans text-xs font-semibold text-white">{kind === "video" ? "▶ " : ""}{label}</span>}
      </div>
    );
  }
  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden rounded-l-[4px] rounded-r-lg py-3.5 pl-[18px] pr-3 font-serif text-[#f6eedf] ${className}`}
      style={{ background: coverColour(id), boxShadow: "0 10px 22px -12px rgba(42,34,27,.55), inset 6px 0 0 rgba(0,0,0,.18)" }}
      aria-hidden="true"
      title={title}
    >
      {badge && <span className="absolute left-3.5 top-2.5 rounded-full bg-ochre px-2 py-0.5 font-sans text-[11px] font-bold text-ink">{badge}</span>}
      <b className={`line-clamp-3 font-bold leading-tight ${badge ? "mt-6" : ""}`}>{title}</b>
      {!!pageCount && <small className="font-sans text-[11px] opacity-85">{pageCount} pages</small>}
      {!pageCount && label && <small className="truncate font-sans text-[11px] opacity-85">{label}</small>}
    </div>
  );
}
