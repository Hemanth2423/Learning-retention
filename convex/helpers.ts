import { getAuthUserId } from "@convex-dev/auth/server";
import { QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Every function calls this: the user always comes from the session, never from the browser.
export async function requireUser(ctx: QueryCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Please log in first.");
  return userId;
}

// Returns the course only if it belongs to this user.
export async function getOwnCourse(ctx: QueryCtx, userId: Id<"users">, courseId: Id<"courses">) {
  const course = await ctx.db.get(courseId);
  return course && course.userId === userId ? course : null;
}
