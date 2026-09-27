/**
 * Third-party reviews of the model. Empty until a CPA, fractional CFO,
 * counsel, or advisor signs a scope. The page explains how a review is
 * recorded and offers a "request the diligence package" action.
 */
export type ReviewRole = "cpa" | "fractional-cfo" | "counsel" | "advisor";
export type ReviewStatus = "planned" | "in-progress" | "signed";

export interface ModelReview {
  reviewer: string;
  firm: string;
  role: ReviewRole;
  /** Registry groups covered, or "all". */
  scope: readonly string[] | "all";
  date: string;
  statement: string;
  status: ReviewStatus;
}

export const REVIEWS: readonly ModelReview[] = [];
