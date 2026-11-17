"use client";

import Image from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ReactNode, useState } from "react";

export type NoteValue = { content: string; plainText: string };

// A small rich-text editor: bold, italic, bullet and numbered lists. Saved as the editor's JSON plus a plain-text copy.
export function NoteEditor({
  initial,
  onChange,
  autoFocus,
  actions,
  onAddImage,
}: {
  initial: string | null;
  onChange: (value: NoteValue) => void;
  autoFocus?: boolean;
  actions?: ReactNode; // e.g. the Check against the book button, shown under the note
  onAddImage?: (file: File) => Promise<string | null>; // uploads the image and returns its link, or null if it failed
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] }, // "Heading" and "Subheading"
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        link: false,
      }),
      Placeholder.configure({ placeholder: "What did you take away? A few sentences is enough." }),
      Image.configure({ allowBase64: false }),
    ],
    content: initial ? JSON.parse(initial) : "",
    immediatelyRender: false, // the page is server-rendered first
    autofocus: autoFocus ? "end" : false,
    editorProps: { attributes: { class: "note-editor", "aria-label": "Your note" } },
    onUpdate: ({ editor }) => onChange({ content: JSON.stringify(editor.getJSON()), plainText: editor.getText({ blockSeparator: "\n" }) }),
  });

  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: !!editor?.isActive("bold"),
      italic: !!editor?.isActive("italic"),
      underline: !!editor?.isActive("underline"),
      strike: !!editor?.isActive("strike"),
      bullets: !!editor?.isActive("bulletList"),
      numbers: !!editor?.isActive("orderedList"),
      style: editor?.isActive("heading", { level: 2 }) ? "heading" : editor?.isActive("heading", { level: 3 }) ? "subheading" : "normal",
    }),
  });

  const icon = (paths: ReactNode) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths}
    </svg>
  );
  const tool = (label: string, on: boolean | undefined, run: () => void, content: ReactNode) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={!!on}
      // Keep the cursor in the note while a button is pressed.
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
      className={`grid h-8 w-7 place-items-center rounded-md ${on ? "bg-accent-soft text-accent-dark" : "text-muted hover:bg-panel hover:text-ink"}`}
    >
      {content}
    </button>
  );
  const divider = <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-line" />;
  const [uploading, setUploading] = useState(false);
  async function addImage(file: File | undefined) {
    if (!file || !onAddImage || !editor) return;
    setUploading(true);
    try {
      const src = await onAddImage(file);
      if (src) editor.chain().focus().setImage({ src, alt: file.name.replace(/\.[^.]+$/, "") }).run();
    } finally {
      setUploading(false);
    }
  }
  const chain = () => editor?.chain().focus();

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-card shadow-[0_1px_0_var(--line)]">
      <div role="toolbar" aria-label="Formatting" className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-line bg-cream/60 px-2 py-1.5">
        <select
          aria-label="Text style"
          value={active?.style ?? "normal"}
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "heading") chain()?.setHeading({ level: 2 }).run();
            else if (v === "subheading") chain()?.setHeading({ level: 3 }).run();
            else chain()?.setParagraph().run();
          }}
          className="h-8 rounded-md border border-transparent bg-transparent px-1.5 text-sm text-ink hover:border-line focus:border-accent focus:outline-none"
        >
          <option value="normal">Normal text</option>
          <option value="heading">Heading</option>
          <option value="subheading">Subheading</option>
        </select>
        {divider}
        {tool("Bold", active?.bold, () => chain()?.toggleBold().run(), icon(<><path d="M14 12a4 4 0 0 0 0-8H6v8" /><path d="M15 20a4 4 0 0 0 0-8H6v8Z" /></>))}
        {tool("Italic", active?.italic, () => chain()?.toggleItalic().run(), icon(<path d="M19 4h-9M14 20H5M15 4 9 20" />))}
        {tool("Underline", active?.underline, () => chain()?.toggleUnderline().run(), icon(<><path d="M6 4v6a6 6 0 0 0 12 0V4" /><path d="M4 20h16" /></>))}
        {tool("Strikethrough", active?.strike, () => chain()?.toggleStrike().run(), icon(<><path d="M16 4H9a3 3 0 0 0-2.83 4" /><path d="M14 12a4 4 0 0 1 0 8H6" /><path d="M4 12h16" /></>))}
        {divider}
        {tool("Bullet list", active?.bullets, () => chain()?.toggleBulletList().run(), icon(<><path d="M9 6h12M9 12h12M9 18h12" /><path d="M4 6h.01M4 12h.01M4 18h.01" strokeWidth="3" /></>))}
        {tool("Numbered list", active?.numbers, () => chain()?.toggleOrderedList().run(), icon(<><path d="M10 6h11M10 12h11M10 18h11" /><path d="M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" /></>))}
        {onAddImage && (
          <>
            {divider}
            {/* A label opens the file picker, so no button-to-input wiring is needed. */}
            <label
              title={uploading ? "Adding image…" : "Add image"}
              aria-label={uploading ? "Adding image…" : "Add image"}
              onMouseDown={(e) => e.preventDefault()}
              className={`grid h-8 w-7 cursor-pointer place-items-center rounded-md ${uploading ? "bg-accent-soft text-accent-dark" : "text-muted hover:bg-panel hover:text-ink"}`}
            >
              {icon(<><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" /></>)}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  void addImage(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </>
        )}
      </div>
      <div className="min-h-0 flex-1 cursor-text overflow-y-auto px-4 py-3" onClick={() => editor?.commands.focus()}>
        <EditorContent editor={editor} />
      </div>
      {actions && <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-cream/40 px-3 py-2">{actions}</div>}
    </div>
  );
}
