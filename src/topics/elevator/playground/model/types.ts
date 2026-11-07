/** Number of calls observed at one floor. Missing floors are treated as zero. */
export interface FloorFrequency {
  readonly floor: number
  readonly frequency: number
}

export interface FloorDistribution {
  /** Candidate standby floors are the integers from 1 through floorCount. */
  readonly floorCount: number
  readonly frequencies: readonly FloorFrequency[]
}

export interface ElevatorModelInput extends FloorDistribution {
  /** Travel time for one floor, in seconds. */
  readonly secondsPerFloor: number
  /** Fixed startup and door-opening time for every call, in seconds. */
  readonly fixedTime: number
}

export interface CandidateFloorStatistics {
  readonly candidateFloor: number
  readonly totalDistance: number
  readonly totalTime: number
  readonly meanTime: number
  readonly maxTime: number
}

export type ElevatorOptimizationObjective = "total" | "mean" | "max"

/** Must return a finite value in the half-open interval [0, 1). */
export type RandomSource = () => number
