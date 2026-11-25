import { Bulb } from "@/components/icons/Bulb";

const TOOLS = [
  { icon: <Bulb size={26} rays />, title: "Practice questions", text: "Open-ended questions on what you just read" },
  { icon: "🗺️", title: "Mind map", text: "See how the chapter's ideas connect" },
  { icon: "🃏", title: "Flashcards", text: "Key terms to review later" },
];

// Tools that are coming later. Shown now so readers know what's on the way.
export function MoreTools() {
  return (
    <div className="p-4">
      <p className="mb-3 text-meta text-muted">More ways to work with this chapter.</p>
      <ul className="grid gap-3">
        {TOOLS.map((t) => (
          <li key={t.title} className="flex items-center gap-3.5 rounded-xl border border-dashed border-[#c2b49c] bg-card p-3.5">
            <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-cream text-h2">
              {t.icon}
            </span>
            <div className="min-w-0">
              <p className="font-semibold">{t.title}</p>
              <p className="text-meta text-muted">{t.text}</p>
            </div>
            <span className="ml-auto shrink-0 rounded bg-ochre px-1.5 py-0.5 font-game text-label">SOON</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
