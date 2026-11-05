/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as auth from "../auth.js";
import type * as checks from "../checks.js";
import type * as courses from "../courses.js";
import type * as dashboard from "../dashboard.js";
import type * as gamification from "../gamification.js";
import type * as helpers from "../helpers.js";
import type * as http from "../http.js";
import type * as lessonRules from "../lessonRules.js";
import type * as lessonTypes from "../lessonTypes.js";
import type * as lessons from "../lessons.js";
import type * as llm from "../llm.js";
import type * as nextSteps from "../nextSteps.js";
import type * as processing from "../processing.js";
import type * as progress from "../progress.js";
import type * as questionFlow from "../questionFlow.js";
import type * as questionRules from "../questionRules.js";
import type * as reviews from "../reviews.js";
import type * as rewards from "../rewards.js";
import type * as spacing from "../spacing.js";
import type * as stars from "../stars.js";
import type * as topics from "../topics.js";
import type * as users from "../users.js";
import type * as validation from "../validation.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  auth: typeof auth;
  checks: typeof checks;
  courses: typeof courses;
  dashboard: typeof dashboard;
  gamification: typeof gamification;
  helpers: typeof helpers;
  http: typeof http;
  lessonRules: typeof lessonRules;
  lessonTypes: typeof lessonTypes;
  lessons: typeof lessons;
  llm: typeof llm;
  nextSteps: typeof nextSteps;
  processing: typeof processing;
  progress: typeof progress;
  questionFlow: typeof questionFlow;
  questionRules: typeof questionRules;
  reviews: typeof reviews;
  rewards: typeof rewards;
  spacing: typeof spacing;
  stars: typeof stars;
  topics: typeof topics;
  users: typeof users;
  validation: typeof validation;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
