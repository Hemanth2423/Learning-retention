"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export function StarButton({ topicId }: { topicId: Id<"topics"> }) {
  const starred = useQuery(api.stars.isStarred, { topicId });
  const toggle = useMutation(api.stars.toggle);
  return (
    <button
      type="button"
      aria-pressed={!!starred}
      onClick={() => toggle({ topicId })}
      className={`btn-ghost ${starred ? "border-accent text-accent" : ""}`}
      title={starred ? "Remove from your review list" : "Add to your review list"}
    >
      <span aria-hidden className="text-lg leading-none">{starred ? "★" : "☆"}</span>
      {starred ? "Starred" : "Star"}
    </button>
  );
}
