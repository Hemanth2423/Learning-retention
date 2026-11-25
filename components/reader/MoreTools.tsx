import Link from "next/link";
import { ReactNode } from "react";
import { Bulb } from "@/components/icons/Bulb";

const CARD = "flex w-full items-center gap-3.5 rounded-xl border bg-card p-3.5 text-left";

function Body({ icon, title, text, soon }: { icon: ReactNode; title: string; text: string; soon?: boolean }) {
  return (
    <>
      <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-cream text-h2">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        <p className="text-meta text-muted">{text}</p>
      </div>
      {soon ? <span className="ml-auto shrink-0 rounded bg-ochre px-1.5 py-0.5 font-game text-label">SOON</span> : <span aria-hidden="true" className="ml-auto shrink-0 text-muted">→</span>}
    </>
  );
}

// More ways to work with the chapter: practice (the chapter's concept check), the book's mind map, and what's coming.
export function MoreTools({ practiceHref, onMindMap }: { practiceHref?: string; onMindMap?: () => void }) {
  return (
    <div className="p-4">
      <p className="mb-3 text-meta text-muted">More ways to work with this chapter.</p>
      <ul className="grid gap-3">
        {practiceHref && (
          <li>
            <Link href={practiceHref} className={`${CARD} border-line hover:border-accent`}>
              <Body icon={<Bulb size={26} rays />} title="Practice questions" text="Test yourself on this chapter" />
            </Link>
          </li>
        )}
        {onMindMap && (
          <li>
            <button onClick={onMindMap} className={`${CARD} border-line hover:border-accent`}>
              <Body icon="🗺️" title="Mind map" text="See how the book's chapters and ideas connect" />
            </button>
          </li>
        )}
        <li className={`${CARD} border-dashed border-[#c2b49c]`}>
          <Body icon="🃏" title="Flashcards" text="Key terms to review later" soon />
        </li>
      </ul>
    </div>
  );
}
