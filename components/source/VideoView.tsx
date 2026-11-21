"use client";

import { useMutation } from "convex/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { errorMessage } from "@/components/FieldError";
import { NotebookPanel } from "@/components/notebook/NotebookPanel";
import { useNotebook } from "@/components/notebook/useNotebook";
import { RightPanel, StudyTab, StudyTabSpec } from "@/components/reader/RightPanel";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { chapterRanges } from "@/convex/chapters";
import { formatTime } from "@/convex/notebookRules";

type VideoDoc = Omit<Doc<"documents">, "fileId">;
const NO_HIGHLIGHTS: Doc<"highlights">[] = [];
const YOUTUBE_ORIGINS = ["https://www.youtube-nocookie.com", "https://www.youtube.com"];

// A one-paragraph note in the editor's saved format.
const plainNote = (text: string) => ({ content: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] }), plainText: text });

// Talks to YouTube's embedded player through its postMessage interface (no extra script): reads the current time,
// and jumps to a note's time.
function useYouTubePlayer() {
  const frame = useRef<HTMLIFrameElement>(null);
  const time = useRef(0);
  const [now, setNow] = useState(0);
  const send = useCallback((msg: object) => frame.current?.contentWindow?.postMessage(JSON.stringify(msg), "*"), []);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!YOUTUBE_ORIGINS.includes(e.origin) || typeof e.data !== "string") return;
      try {
        const data = JSON.parse(e.data) as { event?: string; info?: { currentTime?: number } };
        if (data.event === "infoDelivery" && typeof data.info?.currentTime === "number") {
          time.current = data.info.currentTime;
          setNow(Math.floor(data.info.currentTime));
        }
      } catch {
        /* not a player message */
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  const listen = useCallback(() => send({ event: "listening", id: "ingrain", channel: "widget" }), [send]);
  const seek = useCallback(
    (seconds: number) => {
      send({ event: "command", func: "seekTo", args: [seconds, true] });
      send({ event: "command", func: "playVideo", args: [] });
    },
    [send]
  );
  return { frame, time, now, listen, seek };
}

// A YouTube video, played by YouTube's own embedded player (privacy-enhanced domain), with the Notebook beside it.
// Quick notes keep the time they were written; clicking a time jumps the video there. No Ask, tests or XP for videos.
export function VideoView({ doc }: { doc: VideoDoc }) {
  const touch = useMutation(api.documents.saveProgress);
  const saveNote = useMutation(api.notebook.saveNote);
  const ranges = useMemo(() => chapterRanges(doc.sections ?? [], doc.pageCount ?? 1), [doc.sections, doc.pageCount]);
  const sections = useMemo(() => doc.sections ?? [], [doc.sections]);
  const notebook = useNotebook(doc._id);
  const { frame, time, now, listen, seek } = useYouTubePlayer();
  const [studyOpen, setStudyOpen] = useState(true);
  const [tab, setTab] = useState<StudyTab>("notebook");
  const [wide, setWide] = useState(false);
  const [quick, setQuick] = useState("");
  const [quickAt, setQuickAt] = useState<number | null>(null); // the time a quick note started being typed
  const [notice, setNotice] = useState<string | null>(null);
  const key = ranges[0]?.key ?? "video";

  useEffect(() => {
    void touch({ documentId: doc._id, page: 1 }).catch(() => {});
  }, [touch, doc._id]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function addQuick(e: React.FormEvent) {
    e.preventDefault();
    const text = quick.trim();
    if (!text) return;
    const seconds = Math.floor(quickAt ?? time.current);
    try {
      await saveNote({ documentId: doc._id, sectionKey: key, seconds, ...plainNote(text) });
      setQuick("");
      setQuickAt(null);
      setNotice(`Note saved at ${formatTime(seconds)}`);
    } catch (err) {
      setNotice(errorMessage(err));
    }
  }

  const tabs: StudyTabSpec[] = [
    {
      key: "notebook",
      label: "Notebook",
      icon: <span aria-hidden="true">📓</span>,
      count: notebook.notes.length,
      content: (
        <NotebookPanel
          state={notebook}
          highlights={NO_HIGHLIGHTS}
          ranges={ranges}
          sections={sections}
          currentKey={key}
          single
          canValidate={false}
          wide={wide}
          editingId={null}
          onEditComment={() => {}}
          onSetComment={() => {}}
          onRemoveHighlight={() => {}}
          onJumpHighlight={() => {}}
          onJumpPage={() => {}}
          onSeek={seek}
          onNotice={setNotice}
          kinds={["notes"]}
          emptyHint="Nothing here yet. Type a quick note under the video: it keeps the time, so you can jump back."
        />
      ),
    },
  ];

  return (
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-line bg-card/95 px-4 py-2.5">
        <Link href="/read" className="retro">
          ← Library
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate font-serif font-semibold" title={doc.title}>
            {doc.title}
          </p>
          <p className="truncate text-label text-muted">YouTube · {doc.siteName}</p>
        </div>
        <button className="retro" aria-expanded={studyOpen} onClick={() => setStudyOpen((o) => !o)}>
          📚 Study tools
        </button>
      </header>
      <div className="relative flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto max-w-[900px]">
            <div className="aspect-video overflow-hidden rounded-2xl bg-black shadow-[0_16px_34px_-22px_rgba(0,0,0,.7)]">
              {doc.videoId && (
                <iframe
                  ref={frame}
                  onLoad={listen}
                  src={`https://www.youtube-nocookie.com/embed/${doc.videoId}?rel=0&enablejsapi=1`}
                  title={doc.title}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              )}
            </div>
            <form onSubmit={addQuick} className="mt-3 flex items-center gap-2 rounded-xl border-[1.5px] border-line bg-card px-3 py-2 focus-within:border-ink focus-within:shadow-[0_3px_0_var(--ink)]">
              <span className="shrink-0 rounded-md bg-panel px-1.5 text-label font-semibold" aria-label="Video time">
                ⏱ {formatTime(quickAt ?? now)}
              </span>
              <input
                value={quick}
                onChange={(e) => {
                  if (!quick && e.target.value) setQuickAt(Math.floor(time.current)); // the note belongs where typing started
                  if (!e.target.value) setQuickAt(null);
                  setQuick(e.target.value);
                }}
                placeholder="Quick note at this moment… (Enter to save)"
                aria-label="Quick note at this moment in the video"
                maxLength={2000}
                className="min-w-0 flex-1 bg-transparent text-ui outline-none"
              />
              <button type="submit" className="chunky sm" disabled={!quick.trim()}>
                Save
              </button>
            </form>
            <h1 className="mt-4 font-serif text-h2 font-bold leading-snug">{doc.title}</h1>
            <p className="mt-1 text-meta text-muted">
              {doc.siteName} ·{" "}
              {doc.sourceUrl && (
                <a href={doc.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent-dark underline">
                  Open on YouTube ↗
                </a>
              )}
            </p>
          </div>
        </main>
        {studyOpen && <RightPanel underMenu={false} tab={tab} onTab={setTab} tabs={tabs} onClose={() => setStudyOpen(false)} wide={wide} onWide={setWide} />}
      </div>
      {notice && (
        <p role="alert" className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-lg bg-ink px-4 py-2 text-ui text-paper shadow-lg">
          {notice}
        </p>
      )}
    </div>
  );
}
