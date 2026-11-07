import type {
  CandidateFloorStatistics,
  ElevatorModelInput,
  ElevatorOptimizationObjective,
  FloorDistribution,
  FloorFrequency,
  RandomSource,
} from "./types"

interface ValidatedDistribution {
  floorCount: number
  frequencies: FloorFrequency[]
  totalFrequency: number
}

interface ValidatedModel extends ValidatedDistribution {
  secondsPerFloor: number
  fixedTime: number
}

export class ElevatorModelValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ElevatorModelValidationError"
  }
}

/**
 * Calculates D(p), total estimated response time, mean estimated response time,
 * and the largest single-call estimated response time for one standby floor.
 */
export function calculateCandidateStatistics(
  input: ElevatorModelInput,
  candidateFloor: number,
): CandidateFloorStatistics {
  const model = validateModel(input)
  validateCandidateFloor(candidateFloor, model.floorCount)
  return calculateValidatedStatistics(model, candidateFloor)
}

/** Calculates statistics for every integer standby floor from 1 to floorCount. */
export function enumerateCandidateStatistics(
  input: ElevatorModelInput,
): CandidateFloorStatistics[] {
  const model = validateModel(input)
  const statistics: CandidateFloorStatistics[] = []

  for (let candidateFloor = 1; candidateFloor <= model.floorCount; candidateFloor += 1) {
    statistics.push(calculateValidatedStatistics(model, candidateFloor))
  }

  return statistics
}

/** Returns every tied optimum, ordered from the lowest floor to the highest. */
export function findOptimalFloors(
  input: ElevatorModelInput,
  objective: ElevatorOptimizationObjective,
): number[] {
  validateObjective(objective)
  const statistics = enumerateCandidateStatistics(input)
  const valueOf = objectiveValueSelector(objective)
  let bestValue = Number.POSITIVE_INFINITY
  let optimalFloors: number[] = []

  for (const candidate of statistics) {
    const value = valueOf(candidate)

    if (value < bestValue) {
      bestValue = value
      optimalFloors = [candidate.candidateFloor]
    } else if (value === bestValue) {
      optimalFloors.push(candidate.candidateFloor)
    }
  }

  return optimalFloors
}

/**
 * Returns all integer minimizers of the weighted absolute-distance sum.
 * If cumulative weight is exactly half at one observed floor, the complete
 * interval through the next positive-frequency floor is returned.
 */
export function weightedMedianCandidateFloors(
  distribution: FloorDistribution,
): number[] {
  const { frequencies, totalFrequency } = validateDistribution(distribution)
  const positiveFrequencies = frequencies.filter(({ frequency }) => frequency > 0)
  const halfWeight = totalFrequency / 2
  let cumulativeFrequency = 0

  for (let index = 0; index < positiveFrequencies.length; index += 1) {
    const current = positiveFrequencies[index]
    cumulativeFrequency += current.frequency

    if (cumulativeFrequency > halfWeight) {
      return [current.floor]
    }

    if (cumulativeFrequency === halfWeight) {
      const next = positiveFrequencies[index + 1]

      // Exact half weight implies that positive weight remains above current.
      if (next === undefined) {
        throw new ElevatorModelValidationError(
          "Unable to locate the upper weighted-median endpoint.",
        )
      }

      return inclusiveFloorRange(current.floor, next.floor)
    }
  }

  throw new ElevatorModelValidationError(
    "Unable to calculate weighted-median candidate floors.",
  )
}

/**
 * Generates one reusable weighted call sample. Reuse the returned floor list
 * when comparing standby floors so that sampling variation is held constant.
 */
export function generateWeightedCallSample(
  distribution: FloorDistribution,
  sampleSize: number,
  rng: RandomSource,
): number[] {
  const { frequencies, totalFrequency } = validateDistribution(distribution)

  if (!Number.isSafeInteger(sampleSize) || sampleSize < 0) {
    throw new ElevatorModelValidationError(
      `sampleSize must be a non-negative safe integer; received ${String(sampleSize)}.`,
    )
  }

  if (typeof rng !== "function") {
    throw new ElevatorModelValidationError("rng must be a function.")
  }

  const positiveFrequencies = frequencies.filter(({ frequency }) => frequency > 0)
  const sample: number[] = []

  for (let sampleIndex = 0; sampleIndex < sampleSize; sampleIndex += 1) {
    const randomValue = rng()

    if (
      typeof randomValue !== "number" ||
      !Number.isFinite(randomValue) ||
      randomValue < 0 ||
      randomValue >= 1
    ) {
      throw new ElevatorModelValidationError(
        `rng result at sample ${sampleIndex + 1} must be in [0, 1); received ${String(randomValue)}.`,
      )
    }

    const target = randomValue * totalFrequency
    let cumulativeFrequency = 0

    for (const entry of positiveFrequencies) {
      cumulativeFrequency += entry.frequency

      if (target < cumulativeFrequency) {
        sample.push(entry.floor)
        break
      }
    }
  }

  return sample
}

function calculateValidatedStatistics(
  model: ValidatedModel,
  candidateFloor: number,
): CandidateFloorStatistics {
  let totalDistance = 0
  let maxDistance = 0

  for (const { floor, frequency } of model.frequencies) {
    const distance = Math.abs(floor - candidateFloor)
    const weightedDistance = frequency * distance

    if (!Number.isSafeInteger(weightedDistance)) {
      throw new ElevatorModelValidationError(
        "Weighted floor distance exceeds the supported safe-integer range.",
      )
    }

    totalDistance += weightedDistance

    if (!Number.isSafeInteger(totalDistance)) {
      throw new ElevatorModelValidationError(
        "totalDistance exceeds the supported safe-integer range.",
      )
    }

    if (frequency > 0) {
      maxDistance = Math.max(maxDistance, distance)
    }
  }

  const totalTime =
    model.totalFrequency * model.fixedTime +
    model.secondsPerFloor * totalDistance
  const meanTime = totalTime / model.totalFrequency
  const maxTime = model.fixedTime + model.secondsPerFloor * maxDistance

  if (![totalTime, meanTime, maxTime].every(Number.isFinite)) {
    throw new ElevatorModelValidationError(
      "Calculated response time exceeds the supported numeric range.",
    )
  }

  return {
    candidateFloor,
    totalDistance,
    totalTime,
    meanTime,
    maxTime,
  }
}

function validateModel(input: ElevatorModelInput): ValidatedModel {
  const distribution = validateDistribution(input)
  const secondsPerFloor = input.secondsPerFloor
  const fixedTime = input.fixedTime

  if (!Number.isFinite(secondsPerFloor) || secondsPerFloor <= 0) {
    throw new ElevatorModelValidationError(
      `secondsPerFloor must be a positive finite number; received ${String(secondsPerFloor)}.`,
    )
  }

  if (!Number.isFinite(fixedTime) || fixedTime < 0) {
    throw new ElevatorModelValidationError(
      `fixedTime must be a non-negative finite number; received ${String(fixedTime)}.`,
    )
  }

  return {
    ...distribution,
    secondsPerFloor,
    fixedTime,
  }
}

function validateDistribution(
  distribution: FloorDistribution,
): ValidatedDistribution {
  if (typeof distribution !== "object" || distribution === null) {
    throw new ElevatorModelValidationError("distribution must be an object.")
  }

  const floorCount = distribution.floorCount
  const sourceFrequencies = distribution.frequencies

  if (!Number.isSafeInteger(floorCount) || floorCount < 1) {
    throw new ElevatorModelValidationError(
      `floorCount must be a positive safe integer; received ${String(floorCount)}.`,
    )
  }

  if (!Array.isArray(sourceFrequencies) || sourceFrequencies.length === 0) {
    throw new ElevatorModelValidationError(
      "frequencies must be a non-empty array.",
    )
  }

  const seenFloors = new Set<number>()
  const frequencies: FloorFrequency[] = []
  let totalFrequency = 0

  sourceFrequencies.forEach((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      throw new ElevatorModelValidationError(
        `frequencies[${index}] must be an object.`,
      )
    }

    const { floor, frequency } = entry

    if (!Number.isSafeInteger(floor) || floor < 1 || floor > floorCount) {
      throw new ElevatorModelValidationError(
        `frequencies[${index}].floor must be a safe integer from 1 to ${floorCount}; received ${String(floor)}.`,
      )
    }

    if (!Number.isSafeInteger(frequency) || frequency < 0) {
      throw new ElevatorModelValidationError(
        `frequencies[${index}].frequency must be a non-negative safe integer; received ${String(frequency)}.`,
      )
    }

    if (seenFloors.has(floor)) {
      throw new ElevatorModelValidationError(
        `frequencies contains duplicate floor ${floor}.`,
      )
    }

    seenFloors.add(floor)
    frequencies.push({ floor, frequency })
    totalFrequency += frequency

    if (!Number.isSafeInteger(totalFrequency)) {
      throw new ElevatorModelValidationError(
        "Total frequency exceeds the supported safe-integer range.",
      )
    }
  })

  if (totalFrequency === 0) {
    throw new ElevatorModelValidationError(
      "At least one floor must have a positive frequency.",
    )
  }

  frequencies.sort((left, right) => left.floor - right.floor)

  return {
    floorCount,
    frequencies,
    totalFrequency,
  }
}

function validateCandidateFloor(candidateFloor: number, floorCount: number): void {
  if (
    !Number.isSafeInteger(candidateFloor) ||
    candidateFloor < 1 ||
    candidateFloor > floorCount
  ) {
    throw new ElevatorModelValidationError(
      `candidateFloor must be a safe integer from 1 to ${floorCount}; received ${String(candidateFloor)}.`,
    )
  }
}

function validateObjective(objective: ElevatorOptimizationObjective): void {
  if (objective !== "total" && objective !== "mean" && objective !== "max") {
    throw new ElevatorModelValidationError(
      `objective must be "total", "mean", or "max"; received ${String(objective)}.`,
    )
  }
}

function objectiveValueSelector(
  objective: ElevatorOptimizationObjective,
): (statistics: CandidateFloorStatistics) => number {
  switch (objective) {
    case "total":
      return ({ totalTime }) => totalTime
    case "mean":
      return ({ meanTime }) => meanTime
    case "max":
      return ({ maxTime }) => maxTime
  }
}

function inclusiveFloorRange(start: number, end: number): number[] {
  const floors: number[] = []

  for (let floor = start; floor <= end; floor += 1) {
    floors.push(floor)
  }

  return floors
}
