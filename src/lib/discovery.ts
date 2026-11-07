import type { DiscoveryState } from "../types"

function safeCompletedRounds(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0
}

/**
 * Normalizes persisted discovery data from earlier schemas.
 *
 * A legacy hypothesis without a submission-round baseline is anchored to the
 * rounds currently present. This prevents old results from immediately
 * satisfying the reveal gate. Malformed or missing unlock flags fail closed.
 */
export function normalizeDiscoveryState(
  discovery: DiscoveryState | undefined,
  completedRounds: number,
): DiscoveryState {
  const hypothesis = discovery?.hypothesis
  if (!hypothesis) {
    return { theoryUnlocked: false }
  }

  const currentRounds = safeCompletedRounds(completedRounds)
  const storedBaseline = hypothesis.completedRoundsAtSubmission
  const completedRoundsAtSubmission = Number.isFinite(storedBaseline)
    ? Math.min(currentRounds, safeCompletedRounds(storedBaseline))
    : currentRounds
  const theoryUnlocked = discovery?.theoryUnlocked === true

  return {
    hypothesis: {
      meanPurchases: hypothesis.meanPurchases,
      reason: hypothesis.reason,
      submittedAt: hypothesis.submittedAt,
      completedRoundsAtSubmission,
    },
    theoryUnlocked,
    ...(theoryUnlocked && typeof discovery?.theoryUnlockedAt === "string"
      ? { theoryUnlockedAt: discovery.theoryUnlockedAt }
      : {}),
    ...(theoryUnlocked &&
    (discovery?.theoryUnlockMethod === "student" ||
      discovery?.theoryUnlockMethod === "teacher")
      ? { theoryUnlockMethod: discovery.theoryUnlockMethod }
      : {}),
  }
}

export function canUnlockTheory(
  discovery: DiscoveryState,
  completedRounds: number,
): boolean {
  const hypothesis = discovery.hypothesis
  return Boolean(
    hypothesis &&
      discovery.theoryUnlocked !== true &&
      safeCompletedRounds(completedRounds) >
        hypothesis.completedRoundsAtSubmission,
  )
}
