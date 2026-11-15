"use client";

import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ReactNode } from "react";

export type NoteValue = { content: string; plainText: string };

// A small rich-text editor: bold, italic, bullet and numbered lists. Saved as the editor's JSON plus a plain-text copy.
export function NoteEditor({
  initial,
  onChange,
  autoFocus,
  actions,
}: {
  initial: string | null;
  onChange: (value: NoteValue) => void;
  autoFocus?: boolean;
  actions?: ReactNode; // e.g. a Validate button, shown at the right of the toolbar
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        strike: false,
        horizontalRule: false,
        link: false,
        underline: false,
      }),
      Placeholder.configure({ placeholder: "What did you take away? A few sentences is enough." }),
    ],
    content: initial ? JSON.parse(initial) : "",
    immediatelyRender: false, // the page is server-rendered first
    autofocus: autoFocus ? "end" : false,
    editorProps: { attributes: { class: "note-editor", "aria-label": "Reflection note" } },
    onUpdate: ({ editor }) => onChange({ content: JSON.stringify(editor.getJSON()), plainText: editor.getText({ blockSeparator: "\n" }) }),
  });

  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: !!editor?.isActive("bold"),
      italic: !!editor?.isActive("italic"),
      bullets: !!editor?.isActive("bulletList"),
      numbers: !!editor?.isActive("orderedList"),
    }),
  });

  const tool = (label: string, on: boolean | undefined, run: () => void, content: ReactNode) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={!!on}
      // Keep the cursor in the note while a button is pressed.
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
      className={`flex h-8 w-8 items-center justify-center rounded-md text-sm ${on ? "bg-accent-soft font-semibold" : "text-muted hover:bg-accent-soft hover:text-ink"}`}
    >
      {content}
    </button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div role="toolbar" aria-label="Formatting" className="flex shrink-0 items-center gap-1 border-b border-line px-3 py-2">
        {tool("Bold", active?.bold, () => editor?.chain().focus().toggleBold().run(), <span className="font-bold">B</span>)}
        {tool("Italic", active?.italic, () => editor?.chain().focus().toggleItalic().run(), <span className="italic">I</span>)}
        {tool("Bullet list", active?.bullets, () => editor?.chain().focus().toggleBulletList().run(), "•")}
        {tool("Numbered list", active?.numbers, () => editor?.chain().focus().toggleOrderedList().run(), "1.")}
        <div className="ml-auto">{actions}</div>
      </div>
      <div className="min-h-0 flex-1 cursor-text overflow-y-auto p-4" onClick={() => editor?.commands.focus()}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
