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
import type * as courses from "../courses.js";
import type * as helpers from "../helpers.js";
import type * as http from "../http.js";
import type * as llm from "../llm.js";
import type * as processing from "../processing.js";
import type * as progress from "../progress.js";
import type * as quizzes from "../quizzes.js";
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
  courses: typeof courses;
  helpers: typeof helpers;
  http: typeof http;
  llm: typeof llm;
  processing: typeof processing;
  progress: typeof progress;
  quizzes: typeof quizzes;
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
