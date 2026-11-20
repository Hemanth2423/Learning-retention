"use client";

import { useMemo, useState } from "react";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { chapterOf, SectionLike } from "@/convex/chapters";
import { MAX_COMMENT } from "@/convex/highlightRules";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Section = SectionLike & { title: string };
type Highlight = Doc<"highlights">;

type Props = {
  highlights: Highlight[];
  sections: Section[];
  editingId: Id<"highlights"> | null;
  onEdit: (id: Id<"highlights"> | null) => void;
  onSetComment: (id: Id<"highlights">, comment: string) => void;
  onRemove: (id: Id<"highlights">) => void;
  onJump: (h: Highlight) => void;
};

const firstBox = (h: Highlight) => h.segments.find((s) => s.page === h.locator.page)?.rects[0];

function CommentEditor({ initial, onSave, onCancel }: { initial: string; onSave: (text: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initial);
  return (
    <textarea
      autoFocus
      rows={2}
      maxLength={MAX_COMMENT}
      value={value}
      aria-label="Comment"
      placeholder="Your thoughts…"
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onSave(value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onSave(value);
        } else if (e.key === "Escape") onCancel();
      }}
      className="input mt-2 resize-none"
    />
  );
}

export function HighlightsPanel({ highlights, sections, editingId, onEdit, onSetComment, onRemove, onJump }: Props) {
  const [confirmId, setConfirmId] = useState<Id<"highlights"> | null>(null);
  // Group by chapter, in book order. With no contents there are no headings.
  const groups = useMemo(() => {
    const sorted = [...highlights].sort(
      (a, b) => a.locator.page - b.locator.page || (firstBox(a)?.y ?? 0) - (firstBox(b)?.y ?? 0) || (firstBox(a)?.x ?? 0) - (firstBox(b)?.x ?? 0)
    );
    const out: { key: string; title: string | null; items: Highlight[] }[] = [];
    for (const h of sorted) {
      const chapter = sections.length ? chapterOf(sections, h.locator.page) : null;
      const key = chapter?.key ?? "start";
      let group = out.find((g) => g.key === key);
      if (!group) {
        group = { key, title: sections.length ? (chapter?.title ?? "Start of book") : null, items: [] };
        out.push(group);
      }
      group.items.push(h);
    }
    return out;
  }, [highlights, sections]);

  return (
    <div className="py-4">
      <h2 className="px-4 pb-2 text-label font-semibold uppercase tracking-wide text-muted">Highlights</h2>
      {highlights.length === 0 ? (
        <p className="empty-note">No highlights yet. Select text in the book, then press 🖍 to highlight it.</p>
      ) : (
        groups.map((g) => (
          <section key={g.key} className="mb-3">
            {g.title && (
              <h3 className="flex items-baseline justify-between gap-2 px-4 py-1 text-ui font-semibold">
                <span className="min-w-0 truncate">{g.title}</span>
                <span className="shrink-0 text-label font-normal text-muted">{g.items.length}</span>
              </h3>
            )}
            <ul>
              {g.items.map((h) => (
                <li key={h._id} className="group border-b border-line/60 px-4 py-2.5 last:border-b-0">
                  <button onClick={() => onJump(h)} className="block w-full text-left">
                    <span className="line-clamp-3 border-l-4 border-ochre pl-2 text-ui">{h.text}</span>
                    <span className="mt-1 block text-label text-muted">p. {h.locator.page}</span>
                  </button>
                  {editingId === h._id ? (
                    <CommentEditor initial={h.comment ?? ""} onSave={(text) => onSetComment(h._id, text)} onCancel={() => onEdit(null)} />
                  ) : h.comment ? (
                    <button onClick={() => onEdit(h._id)} className="mt-1.5 block w-full text-left text-meta text-muted hover:text-ink">
                      {h.comment}
                    </button>
                  ) : null}
                  <div className="mt-1 flex gap-3 text-label text-muted">
                    {!h.comment && editingId !== h._id && (
                      <button onClick={() => onEdit(h._id)} className="hover:text-ink">
                        Add comment
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (h.comment) setConfirmId(h._id);
                        else onRemove(h._id);
                      }}
                      aria-label="Delete highlight"
                      className="hover:text-bad"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      <ConfirmDialog
        open={!!confirmId}
        title="Delete this highlight?"
        message="Its comment will be deleted too. This can't be undone."
        confirmLabel="Delete"
        onCancel={() => setConfirmId(null)}
        onConfirm={() => {
          if (confirmId) onRemove(confirmId);
          setConfirmId(null);
        }}
      />
    </div>
  );
}
