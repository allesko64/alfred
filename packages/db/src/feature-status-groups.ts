import { featureStatusEnum } from "./schema/enums";

/**
 * Shared groupings over `featureStatusEnum.enumValues`, single-sourced here so
 * `workspace.router.ts`, `feature-dock.tsx`, `approval-client.tsx`, etc. don't
 * each maintain their own copy that can drift as the enum changes.
 *
 * NOTE: these are explicit lists (not pattern-derived) because the grouping
 * boundaries are business rules, not something inferable from the enum name.
 * Keep them in sync with `featureStatusEnum.enumValues` whenever it changes.
 */

/** Features actively moving through the pre-development pipeline (used for dashboard "active" counts). */
export const ACTIVE_STATUSES = [
  "CLARIFYING",
  "PRD_GENERATION",
  "PRD_READY",
  "TASK_GENERATION",
  "PLANNING",
  "IN_DEVELOPMENT",
] as const satisfies readonly (typeof featureStatusEnum.enumValues)[number][];

/** Statuses before a feature has entered AI review for the first time. */
export const PRE_REVIEW_STATUSES = [
  "DRAFT",
  "CLARIFYING",
  "PRD_GENERATION",
  "PRD_READY",
  "TASK_GENERATION",
  "PLANNING",
  "IN_DEVELOPMENT",
  "PR_LINKED",
  "REVIEWING",
  "CHANGES_REQUESTED",
  "RE_REVIEWING",
] as const satisfies readonly (typeof featureStatusEnum.enumValues)[number][];

/** Statuses before a feature has any development work started (still in planning/spec). */
export const PRE_DEVELOPMENT_STATUSES = [
  "DRAFT",
  "CLARIFYING",
  "PRD_GENERATION",
  "PRD_READY",
  "TASK_GENERATION",
  "PLANNING",
] as const satisfies readonly (typeof featureStatusEnum.enumValues)[number][];

/** Statuses before a feature has reached final approval. */
export const PRE_APPROVAL_STATUSES = [
  ...PRE_DEVELOPMENT_STATUSES,
  "IN_DEVELOPMENT",
  "PR_LINKED",
  "REVIEWING",
  "CHANGES_REQUESTED",
  "RE_REVIEWING",
  "REVIEW_PASSED",
] as const satisfies readonly (typeof featureStatusEnum.enumValues)[number][];

/** Statuses where a feature is currently undergoing AI review. */
export const IN_REVIEW_STATUSES = [
  "REVIEWING",
  "RE_REVIEWING",
] as const satisfies readonly (typeof featureStatusEnum.enumValues)[number][];
