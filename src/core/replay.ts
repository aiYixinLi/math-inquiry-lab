import {
  STYLE_IDS,
  type ReplaySnapshot,
  type RoundResult,
} from "../types"

type StyleCounts = ReplaySnapshot["countsByStyle"]

export function replaySnapshot(
  round: Pick<RoundResult, "events">,
  step: number,
): ReplaySnapshot {
  if (!Number.isFinite(step)) {
    throw new RangeError("step must be a finite number")
  }

  const clampedStep = Math.min(
    round.events.length,
    Math.max(0, Math.trunc(step)),
  )

  if (clampedStep === 0) {
    return {
      step: 0,
      countsByStyle: [0, 0, 0, 0, 0, 0],
      collected: [],
      missing: [...STYLE_IDS],
    }
  }

  const currentEvent = round.events[clampedStep - 1]

  return {
    step: clampedStep,
    countsByStyle: [...currentEvent.countsAfter] as StyleCounts,
    collected: [...currentEvent.collectedAfter],
    missing: [...currentEvent.missingAfter],
    currentEvent: {
      ...currentEvent,
      countsAfter: [...currentEvent.countsAfter] as StyleCounts,
      collectedAfter: [...currentEvent.collectedAfter],
      missingAfter: [...currentEvent.missingAfter],
    },
  }
}
