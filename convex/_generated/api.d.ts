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
import type * as chapters from "../chapters.js";
import type * as chat from "../chat.js";
import type * as chatRules from "../chatRules.js";
import type * as checks from "../checks.js";
import type * as conceptPrompts from "../conceptPrompts.js";
import type * as conceptRules from "../conceptRules.js";
import type * as concepts from "../concepts.js";
import type * as courses from "../courses.js";
import type * as dashboard from "../dashboard.js";
import type * as documentRules from "../documentRules.js";
import type * as documents from "../documents.js";
import type * as exportRules from "../exportRules.js";
import type * as folderRules from "../folderRules.js";
import type * as folders from "../folders.js";
import type * as gamification from "../gamification.js";
import type * as helpers from "../helpers.js";
import type * as highlightRules from "../highlightRules.js";
import type * as highlights from "../highlights.js";
import type * as http from "../http.js";
import type * as ingest from "../ingest.js";
import type * as lessonRules from "../lessonRules.js";
import type * as lessonTypes from "../lessonTypes.js";
import type * as lessons from "../lessons.js";
import type * as linkRules from "../linkRules.js";
import type * as links from "../links.js";
import type * as llm from "../llm.js";
import type * as locators from "../locators.js";
import type * as nextSteps from "../nextSteps.js";
import type * as notebook from "../notebook.js";
import type * as notebookRules from "../notebookRules.js";
import type * as placement from "../placement.js";
import type * as processing from "../processing.js";
import type * as progress from "../progress.js";
import type * as questionFlow from "../questionFlow.js";
import type * as questionRules from "../questionRules.js";
import type * as quizRules from "../quizRules.js";
import type * as quizzes from "../quizzes.js";
import type * as readingRules from "../readingRules.js";
import type * as reflectionRules from "../reflectionRules.js";
import type * as reflections from "../reflections.js";
import type * as reviews from "../reviews.js";
import type * as rewards from "../rewards.js";
import type * as sources_pdf from "../sources/pdf.js";
import type * as spacing from "../spacing.js";
import type * as stars from "../stars.js";
import type * as textSourceRules from "../textSourceRules.js";
import type * as textSources from "../textSources.js";
import type * as topics from "../topics.js";
import type * as users from "../users.js";
import type * as validation from "../validation.js";
import type * as xp from "../xp.js";
import type * as xpRules from "../xpRules.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  auth: typeof auth;
  chapters: typeof chapters;
  chat: typeof chat;
  chatRules: typeof chatRules;
  checks: typeof checks;
  conceptPrompts: typeof conceptPrompts;
  conceptRules: typeof conceptRules;
  concepts: typeof concepts;
  courses: typeof courses;
  dashboard: typeof dashboard;
  documentRules: typeof documentRules;
  documents: typeof documents;
  exportRules: typeof exportRules;
  folderRules: typeof folderRules;
  folders: typeof folders;
  gamification: typeof gamification;
  helpers: typeof helpers;
  highlightRules: typeof highlightRules;
  highlights: typeof highlights;
  http: typeof http;
  ingest: typeof ingest;
  lessonRules: typeof lessonRules;
  lessonTypes: typeof lessonTypes;
  lessons: typeof lessons;
  linkRules: typeof linkRules;
  links: typeof links;
  llm: typeof llm;
  locators: typeof locators;
  nextSteps: typeof nextSteps;
  notebook: typeof notebook;
  notebookRules: typeof notebookRules;
  placement: typeof placement;
  processing: typeof processing;
  progress: typeof progress;
  questionFlow: typeof questionFlow;
  questionRules: typeof questionRules;
  quizRules: typeof quizRules;
  quizzes: typeof quizzes;
  readingRules: typeof readingRules;
  reflectionRules: typeof reflectionRules;
  reflections: typeof reflections;
  reviews: typeof reviews;
  rewards: typeof rewards;
  "sources/pdf": typeof sources_pdf;
  spacing: typeof spacing;
  stars: typeof stars;
  textSourceRules: typeof textSourceRules;
  textSources: typeof textSources;
  topics: typeof topics;
  users: typeof users;
  validation: typeof validation;
  xp: typeof xp;
  xpRules: typeof xpRules;
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
