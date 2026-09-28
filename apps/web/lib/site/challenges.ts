/**
 * Challenge progress for the challenge cards (Task D9 fix round 2).
 *
 * The engine (packages/api/src/index.js updateChallengeProgress) keeps
 * `UserChallenge.progress.current` against `requirements.count` (or
 * `target`). Spend challenges count cents. One-shot challenges (Early Bird,
 * a meal gift) have no count: they are either joined or done.
 */
export type ChallengeRequirements = { type?: string; count?: number; target?: number } | null | undefined;

export type Enrollment = { challengeId: string; progress?: { current?: number } | null; completedAt?: string | null; rewardClaimed?: boolean };

export type ChallengeProgress =
  | { state: "open" }
  | { state: "done" }
  | { state: "joined"; kind: "once" }
  | { state: "joined"; kind: "count" | "money"; current: number; target: number };

const ONCE = new Set(["early_order", "meal_gift"]);

export function challengeProgress(requirements: ChallengeRequirements, enrollment: Enrollment | null | undefined): ChallengeProgress {
  if (!enrollment) return { state: "open" };
  if (enrollment.completedAt) return { state: "done" };
  const type = requirements?.type || "";
  const target = Number(requirements?.target ?? requirements?.count ?? 1) || 1;
  if (ONCE.has(type) || target <= 1) return { state: "joined", kind: "once" };
  const current = Math.max(0, Math.min(target, Number(enrollment.progress?.current) || 0));
  return { state: "joined", kind: type === "spend_amount" ? "money" : "count", current, target };
}
