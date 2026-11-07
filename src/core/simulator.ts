import {
  STYLE_IDS,
  STYLE_LABELS,
  type ActiveRound,
  type DrawEvent,
  type RoundResult,
  type StyleId,
} from "../types"
import { DotNetRandom, type RandomSource } from "./random"

type StyleCounts = ActiveRound["countsByStyle"]
type StageWaits = ActiveRound["stageWaits"]

export function createActiveRound(roundIndex = 1): ActiveRound {
  assertPositiveInteger(roundIndex, "roundIndex")

  return {
    roundIndex,
    sequence: [],
    events: [],
    countsByStyle: [0, 0, 0, 0, 0, 0],
    collected: [],
    missing: [...STYLE_IDS],
    stageWaits: [0, 0, 0, 0, 0, 0],
    stageStartedAt: 0,
    completed: false,
  }
}

/** Records one revealed blind-box style without mutating the prior round. */
export function drawNext(round: ActiveRound, styleId: StyleId): ActiveRound {
  assertStyleId(styleId)

  if (round.completed) {
    throw new Error("Cannot draw after a round has completed")
  }

  const countsByStyle = [...round.countsByStyle] as StyleCounts
  countsByStyle[styleId - 1] += 1

  const wasCollected = round.collected.includes(styleId)
  const isNew = !wasCollected
  const collected = isNew
    ? [...round.collected, styleId].sort(compareStyleIds)
    : [...round.collected]
  const missing = STYLE_IDS.filter((id) => !collected.includes(id))
  const index = round.sequence.length + 1
  const stageWaits = [...round.stageWaits] as StageWaits
  let stageStartedAt = round.stageStartedAt

  if (isNew) {
    const reachedStage = collected.length - 1
    stageWaits[reachedStage] = index - round.stageStartedAt
    stageStartedAt = index
  }

  const event: DrawEvent = {
    index,
    styleId,
    styleLabel: STYLE_LABELS[styleId - 1],
    isNew,
    countsAfter: [...countsByStyle] as StyleCounts,
    collectedAfter: [...collected],
    missingAfter: [...missing],
    distinctCountAfter: collected.length,
    newProbabilityBefore: round.missing.length / STYLE_IDS.length,
  }

  return {
    roundIndex: round.roundIndex,
    sequence: [...round.sequence, styleId],
    events: [...round.events, event],
    countsByStyle,
    collected,
    missing,
    stageWaits,
    stageStartedAt,
    completed: collected.length === STYLE_IDS.length,
  }
}

export function toRoundResult(round: ActiveRound): RoundResult {
  if (!round.completed) {
    throw new Error("Cannot create a result from an incomplete round")
  }

  const lastEvent = round.events.at(-1)

  if (lastEvent === undefined || !lastEvent.isNew) {
    throw new Error("A completed round must end with the sixth new style")
  }

  return {
    roundIndex: round.roundIndex,
    sequence: [...round.sequence],
    events: round.events.map(cloneEvent),
    countsByStyle: [...round.countsByStyle] as StyleCounts,
    totalPurchases: round.sequence.length,
    duplicateCount: round.sequence.length - STYLE_IDS.length,
    lastNewStyleId: lastEvent.styleId,
    stageWaits: [...round.stageWaits] as StageWaits,
    completed: true,
  }
}

export function simulateRound(
  random: RandomSource,
  roundIndex = 1,
): RoundResult {
  let round = createActiveRound(roundIndex)

  while (!round.completed) {
    const styleId = random.next(1, STYLE_IDS.length + 1) as StyleId
    round = drawNext(round, styleId)
  }

  return toRoundResult(round)
}

export function simulateRounds(
  roundCount: number,
  seedOrRandom: number | RandomSource,
  startRoundIndex = 1,
): RoundResult[] {
  assertNonNegativeInteger(roundCount, "roundCount")
  assertPositiveInteger(startRoundIndex, "startRoundIndex")

  const random =
    typeof seedOrRandom === "number"
      ? new DotNetRandom(seedOrRandom)
      : seedOrRandom
  const results: RoundResult[] = []

  for (let offset = 0; offset < roundCount; offset += 1) {
    results.push(simulateRound(random, startRoundIndex + offset))
  }

  return results
}

function cloneEvent(event: DrawEvent): DrawEvent {
  return {
    ...event,
    countsAfter: [...event.countsAfter] as StyleCounts,
    collectedAfter: [...event.collectedAfter],
    missingAfter: [...event.missingAfter],
  }
}

function compareStyleIds(left: StyleId, right: StyleId): number {
  return left - right
}

function assertStyleId(value: number): asserts value is StyleId {
  if (!STYLE_IDS.includes(value as StyleId)) {
    throw new RangeError("styleId must be an integer from 1 through 6")
  }
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer`)
  }
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`)
  }
}
