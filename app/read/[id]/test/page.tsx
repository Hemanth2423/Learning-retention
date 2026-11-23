"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ConceptCheck } from "@/components/concept/ConceptCheck";
import { Bulb } from "@/components/icons/Bulb";
import { ReadingShell } from "@/components/ReadingShell";
import { XpStats } from "@/components/XpStats";
import { readableTitle, splitChapterTitle } from "@/components/reader/text";
import { RoundResult, TestRound } from "@/components/test/TestRound";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { chapterRanges } from "@/convex/chapters";
import type { PublicQuizQuestion } from "@/convex/quizRules";

type Round = { attemptId: Id<"quizAttempts">; questions: PublicQuizQuestion[]; review: boolean };

// "Test yourself" on one chapter: 5 multiple-choice questions, then the score and a review of the missed ones.
function TestView({ documentId, chapterKey }: { documentId: Id<"documents">; chapterKey: string }) {
  const router = useRouter();
  const doc = useQuery(api.documents.get, { documentId });
  const quiz = useQuery(api.quizzes.get, { documentId, chapterKey });
  const quota = useQuery(api.chat.quota, {});
  const prepare = useAction(api.quizzes.prepare);
  const start = useMutation(api.quizzes.start);
  const [round, setRound] = useState<Round | null>(null);
  const [done, setDone] = useState<RoundResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pathHref = `/read/${documentId}`;

  if (doc === undefined || quiz === undefined) return <p className="m-auto text-muted">Loading…</p>;
  const ranges = doc ? chapterRanges(doc.sections ?? [], doc.pageCount ?? 0) : [];
  const index = ranges.findIndex((r) => r.key === chapterKey);
  if (!doc || index < 0) {
    return (
      <div className="m-auto text-center">
        <p>We couldn&apos;t find that chapter.</p>
        <Link href={doc ? pathHref : "/read"} className="retro mt-4">
          ← Back
        </Link>
      </div>
    );
  }
  const range = ranges[index];
  const isParts = !doc.sections?.length;
  const split = splitChapterTitle(range.title);
  const eyebrow = isParts ? `PART ${index + 1}` : split.number ? `CHAPTER ${split.number}` : "TEST YOURSELF";
  const title = isParts ? `Pages ${range.startPage}–${range.endPage}` : readableTitle(split.title);

  const begin = async (review: boolean) => {
    if (!quiz) return;
    setBusy(true);
    setError(null);
    try {
      const { attemptId, indices } = await start({ quizId: quiz.quizId, review });
      setRound({ attemptId, questions: indices.map((i) => quiz.questions[i]), review });
      setDone(null);
    } catch {
      setError("We couldn't start the test. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const make = async () => {
    setBusy(true);
    setError(null);
    const res = await prepare({ documentId, chapterKey }).catch(() => ({ ok: false as const, message: "We couldn't make this test just now. Try again." }));
    setBusy(false);
    if (!res.ok) setError(res.message);
    // When it's ready, the test query updates and the Start button appears.
  };

  if (round && !done) {
    return <TestRound key={round.attemptId} attemptId={round.attemptId} questions={round.questions} onLeave={() => router.push(pathHref)} onDone={setDone} pageHref={(page) => `/read/${documentId}/book?page=${page}`} pageLabel={doc.sourceType === "pdf" ? "p." : "§"} />;
  }

  const header = (
    <header className="flex items-center gap-4 px-4 py-3 md:px-7">
      <Link href={pathHref} className="retro">
        ← Path
      </Link>
      <div className="ml-auto">
        <XpStats level={false} />
      </div>
    </header>
  );

  if (done) {
    const perfect = done.missed === 0;
    return (
      <div className="flex-1">
        {header}
        <div className="mx-auto max-w-[640px] px-4 pb-20 pt-8 text-center">
          <div className="inline-block rounded-md bg-ink px-5 py-3 font-game text-h2 text-ochre" style={{ boxShadow: "4px 4px 0 var(--accent)" }}>
            {round?.review ? "REVIEW COMPLETE" : "TEST COMPLETE"}
          </div>
          <p className="mt-6 font-game text-display leading-none">
            {done.score}/{done.total}
          </p>
          <p className="mt-3 text-h3 font-bold">
            {done.score} of {done.total} right{perfect ? " 🎉" : ""}
            <span className="ml-2 font-game text-ui text-good" title={done.xp === 0 && done.score > 0 ? "You earned XP for these answers on an earlier try" : undefined}>
              +{done.xp} XP
            </span>
          </p>
          <p className="mt-1 text-muted">
            {quiz?.best != null ? `Your best on this ${isParts ? "part" : "chapter"}: ${quiz.best}/${quiz.total}. It shows on the path.` : "Your best score shows on the path."}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            {!perfect && (
              <button className="chunky" onClick={() => begin(true)} disabled={busy}>
                Review {done.missed} missed question{done.missed === 1 ? "" : "s"}
              </button>
            )}
            <Link href={pathHref} className={`chunky ${perfect ? "" : "chunky-light"}`}>
              Back to the path
            </Link>
          </div>
          {perfect && (
            <button className="quiet mt-5" onClick={() => begin(false)} disabled={busy}>
              Take the full test again
            </button>
          )}
          {error && <p className="mt-4 text-ui text-bad">{error}</p>}
        </div>
      </div>
    );
  }

  // Before starting: what the test is, and (the first time) that making it uses one of today's AI questions.
  const noText = doc.hasText === false;
  const outOfQuestions = !quiz && quota !== undefined && quota.left <= 0;
  return (
    <div className="flex-1">
      {header}
      <div className="mx-auto max-w-[560px] px-4 pb-20 pt-10 text-center">
        <Bulb size={64} rays />
        <p className="mt-4 font-game text-label tracking-wider text-accent-dark">{eyebrow}</p>
        <h1 className="mt-1 font-serif text-h1 font-bold leading-tight">{title}</h1>
        <p className="mt-3 text-muted">
          5 questions · about 4 minutes
          {quiz?.best != null && (
            <>
              {" "}
              · Your best: <b className="text-ink">{quiz.best}/{quiz.total}</b>
            </>
          )}
        </p>
        <div className="mt-7">
          {noText ? (
            <p className="text-muted">Tests aren&apos;t available for scanned PDFs.</p>
          ) : quiz ? (
            <button className="chunky" onClick={() => begin(false)} disabled={busy} autoFocus>
              {busy ? "Starting…" : quiz.best != null ? "Take the test again" : "Start the test"}
            </button>
          ) : (
            <>
              <button className="chunky" onClick={make} disabled={busy || outOfQuestions} autoFocus>
                <Bulb size={20} /> {busy ? "Writing your questions…" : "Make my test"}
              </button>
              <p className="mt-3 text-meta text-muted">
                {outOfQuestions
                  ? "You've used today's 5 AI questions. Come back tomorrow to make this test."
                  : `Making it uses 1 of today's AI questions${quota ? ` (${quota.left} left)` : ""}. Taking it again is free.`}
              </p>
            </>
          )}
          {error && (
            <p role="alert" className="mt-4 text-ui text-bad">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// The concept check for one chapter. The earlier 5-question test stays available as the fallback.
function ConceptView({ documentId, chapterKey }: { documentId: Id<"documents">; chapterKey: string }) {
  const doc = useQuery(api.documents.get, { documentId });
  const scores = useQuery(api.quizzes.bestScores, { documentId });
  if (doc === undefined || scores === undefined) return <p className="m-auto text-muted">Loading…</p>;
  const ranges = doc ? chapterRanges(doc.sections ?? [], doc.pageCount ?? 0) : [];
  const index = ranges.findIndex((r) => r.key === chapterKey);
  if (!doc || index < 0) return <TestView documentId={documentId} chapterKey={chapterKey} />; // shows the not-found state
  if (doc.hasText === false) return <TestView documentId={documentId} chapterKey={chapterKey} />;
  const range = ranges[index];
  const isParts = !doc.sections?.length;
  const split = splitChapterTitle(range.title);
  return (
    <ConceptCheck
      documentId={documentId}
      chapterKey={chapterKey}
      eyebrow={isParts ? `PART ${index + 1}` : split.number ? `CHAPTER ${split.number}` : "THIS CHAPTER"}
      title={`${readableTitle(doc.title)} · ${isParts ? `Pages ${range.startPage}–${range.endPage}` : readableTitle(split.title)}`}
      isPdf={doc.sourceType === "pdf"}
      pageLabel={doc.sourceType === "pdf" ? "p." : "§"}
      oldBest={scores[chapterKey] ?? null}
    />
  );
}

function TestRoute() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const chapterKey = params.get("chapter") ?? "";
  const documentId = id as Id<"documents">;
  return <ReadingShell chrome={false}>{params.get("classic") ? <TestView documentId={documentId} chapterKey={chapterKey} /> : <ConceptView documentId={documentId} chapterKey={chapterKey} />}</ReadingShell>;
}

export default function TestPage() {
  return (
    <Suspense fallback={<p className="m-auto text-muted">Loading…</p>}>
      <TestRoute />
    </Suspense>
  );
}
