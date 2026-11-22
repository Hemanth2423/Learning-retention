// Every library item sits in the same padded, rounded frame (prototype 005). Inside it:
// a real cover (a PDF's first page, an EPUB's cover), a video thumbnail, an article's preview image,
// or a plain colour with the title (books) or the site's first letter (articles).
const COLOURS = ["#5e3b27", "#31483f", "#94532e", "#443e58", "#6d6038", "#563238"];

export function coverColour(id: string): string {
  let n = 0;
  for (const c of id) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return COLOURS[n % COLOURS.length];
}

export type CoverKind = "pdf" | "article" | "video" | "epub" | "word" | "powerpoint";

export function BookCover({
  id,
  title,
  className = "",
  badge,
  coverUrl,
  imageUrl,
  kind = "pdf",
  label,
  meta,
  pad = "md",
}: {
  id: string;
  title: string;
  className?: string; // size of the frame (width, or height + width)
  badge?: string; // e.g. "New", top left
  coverUrl?: string | null; // a book's own cover image
  imageUrl?: string | null; // article preview image or YouTube thumbnail
  kind?: CoverKind;
  label?: string; // site or channel, shown as a badge on articles and videos
  meta?: string; // small line on a plain cover, e.g. "320 pages"
  pad?: "sm" | "md";
}) {
  const inset = pad === "sm" ? "inset-1.5" : "inset-2.5";
  const linkLike = kind === "article" || kind === "video";
  const picture = coverUrl ?? (linkLike ? imageUrl : null);
  const letter =
    (label ?? title)
      .replace(/^www\./, "")
      .trim()
      .charAt(0)
      .toUpperCase() || "?";

  return (
    <div
      className={`relative aspect-[3/4] overflow-hidden rounded-xl border border-line bg-card shadow-[0_10px_22px_-16px_rgba(42,34,27,.6)] transition-colors ${className}`}
      aria-hidden="true"
      title={title}
    >
      {picture ? (
        // The whole image always shows: a wide thumbnail sits centred with quiet space around it, never cropped.
        <div className={`absolute ${inset} grid place-items-center overflow-hidden bg-panel ${pad === "sm" ? "rounded-md" : "rounded-lg"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={picture} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-contain" />
        </div>
      ) : linkLike ? (
        <div
          className={`absolute ${inset} grid place-items-center rounded-lg font-serif text-[46px] font-bold text-[#f6eedf]`}
          style={{ background: coverColour(id) }}
        >
          {letter}
        </div>
      ) : (
        <div
          className={`absolute ${inset} flex flex-col justify-between rounded-lg py-3 pl-3.5 pr-2.5 font-serif text-[#f6eedf]`}
          style={{
            background: coverColour(id),
            boxShadow: "inset 5px 0 0 rgba(0,0,0,.18), 0 8px 18px -10px rgba(42,34,27,.7)",
          }}
        >
          <b className={`line-clamp-5 font-bold leading-tight ${badge ? "mt-6" : ""}`}>{title}</b>
          {meta && <small className="truncate font-sans text-label opacity-85">{meta}</small>}
        </div>
      )}
      {kind === "video" && (
        <span className="absolute inset-0 m-auto grid h-[34px] w-12 place-items-center rounded-[9px] bg-[#c4302b]/95 pl-0.5 text-meta text-white">▶</span>
      )}
      {linkLike && label && !picture && (
        <span className="absolute bottom-[18px] left-[18px] max-w-[calc(100%-36px)] truncate rounded-md bg-[#1d1813]/80 px-2 py-0.5 text-label font-semibold text-white">
          {kind === "video" ? "▶ " : ""}
          {label}
        </span>
      )}
      {badge && <span className="absolute left-[18px] top-[18px] rounded-full bg-ochre px-2 py-0.5 text-label font-bold text-ink">{badge}</span>}
    </div>
  );
}
