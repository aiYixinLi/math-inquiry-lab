import {
  THEORY_MEAN,
  type ExperimentSummary,
  type RoundResult,
} from "../types"

export function summarizeRounds(
  rounds: readonly RoundResult[],
): ExperimentSummary {
  const completedRounds = rounds.length
  const cumulativeMeans: number[] = []
  const histogram: ExperimentSummary["histogram"] = [0, 0, 0, 0, 0, 0]
  let totalPurchases = 0
  let totalDuplicates = 0
  let minPurchases = Number.POSITIVE_INFINITY
  let maxPurchases = Number.NEGATIVE_INFINITY
  let exactSixCount = 0

  rounds.forEach((round, index) => {
    totalPurchases += round.totalPurchases
    totalDuplicates += round.duplicateCount
    minPurchases = Math.min(minPurchases, round.totalPurchases)
    maxPurchases = Math.max(maxPurchases, round.totalPurchases)
    histogram[histogramIndex(round.totalPurchases)] += 1

    if (round.totalPurchases === 6) {
      exactSixCount += 1
    }

    cumulativeMeans.push(totalPurchases / (index + 1))
  })

  if (completedRounds === 0) {
    minPurchases = 0
    maxPurchases = 0
  }

  const meanPurchases =
    completedRounds === 0 ? 0 : totalPurchases / completedRounds

  return {
    completedRounds,
    totalPurchases,
    totalDuplicates,
    meanPurchases,
    meanDuplicates:
      completedRounds === 0 ? 0 : totalDuplicates / completedRounds,
    minPurchases,
    maxPurchases,
    range: maxPurchases - minPurchases,
    duplicateRate: totalPurchases === 0 ? 0 : totalDuplicates / totalPurchases,
    exactSixCount,
    exactSixRate: completedRounds === 0 ? 0 : exactSixCount / completedRounds,
    theoryMean: THEORY_MEAN,
    meanMinusTheory: meanPurchases - THEORY_MEAN,
    histogram,
    cumulativeMeans,
  }
}

function histogramIndex(totalPurchases: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (totalPurchases <= 9) return 0
  if (totalPurchases <= 13) return 1
  if (totalPurchases <= 17) return 2
  if (totalPurchases <= 21) return 3
  if (totalPurchases <= 25) return 4
  return 5
}

/** z value of a two-sided 95% normal confidence interval. */
export const Z_95 = 1.959_963_984_540_054

export interface SampleSummary {
  count: number
  mean: number
  /** Sample standard deviation (n − 1 in the denominator). */
  standardDeviation: number
  /** Standard error of the mean, standardDeviation / √n. */
  standardError: number
  /** Normal-approximation 95% confidence interval for the mean. */
  ci95: [number, number]
  min: number
  max: number
}

/** Mean, spread and 95% confidence interval of any numeric sample. */
export function summarizeSample(values: readonly number[]): SampleSummary {
  const count = values.length

  if (count === 0) {
    throw new RangeError("Cannot summarize an empty sample")
  }

  let sum = 0
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY

  for (const value of values) {
    sum += value
    min = Math.min(min, value)
    max = Math.max(max, value)
  }

  const mean = sum / count
  let squares = 0

  for (const value of values) {
    squares += (value - mean) ** 2
  }

  const standardDeviation = count > 1 ? Math.sqrt(squares / (count - 1)) : 0
  const standardError = standardDeviation / Math.sqrt(count)

  return {
    count,
    mean,
    standardDeviation,
    standardError,
    ci95: [mean - Z_95 * standardError, mean + Z_95 * standardError],
    min,
    max,
  }
}

/**
 * Smallest sample value x with “share of values ≤ x” ≥ level, the same
 * definition the theoretical quantiles use (e.g. “90% of people finish
 * within x boxes”).
 */
export function empiricalQuantile(
  values: readonly number[],
  level: number,
): number {
  if (values.length === 0) {
    throw new RangeError("Cannot take a quantile of an empty sample")
  }

  if (!(level > 0 && level <= 1)) {
    throw new RangeError("level must be in (0, 1]")
  }

  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.max(0, Math.ceil(level * sorted.length - 1e-9) - 1)
  return sorted[index] as number
}

/**
 * Distribution-free confidence interval for the level-quantile, read off the
 * order statistics: the count of values ≤ the true quantile is binomial, so
 * the ranks n·level ∓ z·√(n·level·(1 − level)) bracket it. For whole-number
 * data such as box counts the interval is slightly conservative.
 */
export function quantileInterval(
  values: readonly number[],
  level: number,
  z: number,
): [number, number] {
  if (values.length === 0) {
    throw new RangeError("Cannot take a quantile of an empty sample")
  }

  if (!(level > 0 && level < 1)) {
    throw new RangeError("level must be in (0, 1)")
  }

  const sorted = [...values].sort((left, right) => left - right)
  const count = sorted.length
  const center = count * level
  const spread = z * Math.sqrt(count * level * (1 - level))
  const rank = (value: number) => Math.min(count, Math.max(1, value))
  return [
    sorted[rank(Math.floor(center - spread)) - 1] as number,
    sorted[rank(Math.ceil(center + spread)) - 1] as number,
  ]
}

/**
 * Standard error of a sample share successes / count. Two successes and two
 * failures are added first (Agresti–Coull), so a share of exactly 0 or 1
 * does not get a zero standard error.
 */
export function proportionStandardError(successes: number, count: number): number {
  const adjusted = (successes + 2) / (count + 4)
  return Math.sqrt((adjusted * (1 - adjusted)) / (count + 4))
}
