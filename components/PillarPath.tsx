import Link from "next/link";

export type PathStep = { _id: string; order: number; title: string; lessonStatus: string; mastered?: boolean };

// The course's learning path as a stepper: where you are, what's done, what's next.
export function PillarPath({ steps, currentId }: { steps: PathStep[]; currentId: string }) {
  return (
    <nav aria-label="Course path">
      <ol className="flex gap-1 overflow-x-auto pb-1">
        {steps.map((s) => {
          const current = s._id === currentId;
          return (
            <li key={s._id} className="min-w-24 flex-1">
              <Link
                href={`/topics/${s._id}`}
                aria-current={current ? "step" : undefined}
                title={s.title}
                className="group block"
              >
                <span
                  className={`block h-1.5 rounded-full ${
                    s.mastered ? "bg-good" : current ? "bg-accent" : s.lessonStatus === "ready" ? "bg-ink/40" : "bg-line"
                  }`}
                />
                <span className={`mt-1.5 block truncate text-xs ${current ? "font-semibold text-ink" : "text-muted group-hover:text-ink"}`}>
                  {s.mastered ? "✓ " : `${s.order + 1}. `}
                  {s.title}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
