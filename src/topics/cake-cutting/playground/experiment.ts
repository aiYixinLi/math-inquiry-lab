import {
  createCircularSectorPartition,
  createEqualCircularSectorPartition,
  createParallelStripPartition,
  createRectangularGridPartition,
  type CakePartition,
} from "./geometry"

export type CakeShape = "circle" | "square"
export type CakeExperimentTemplate =
  | "equal-sectors"
  | "adjustable-sectors"
  | "parallel-strips"
  | "rectangular-grid"
export type CakeFairnessCriterion = "area" | "outer" | "perimeter" | "cost"

export interface CakeExperimentParameters {
  readonly shape: CakeShape
  readonly template: CakeExperimentTemplate
  readonly size: number
  readonly people: number
  readonly firstSectorAngle: number
  readonly firstStripPercent: number
  readonly gridRows: number
  readonly firstRowPercent: number
  readonly firstColumnPercent: number
  readonly criterion: CakeFairnessCriterion
  readonly allowedDeviationPercent: number
}

export interface CakeExperimentLayout {
  readonly circleAngles?: readonly number[]
  readonly rowHeights?: readonly number[]
  readonly columnWidths?: readonly number[]
}

export interface CakeExperimentSnapshot {
  readonly parameters: CakeExperimentParameters
  readonly partition: CakePartition
  readonly layout: CakeExperimentLayout
  readonly criterionDeviationPercent: number | null
  readonly meetsAllowedDeviation: boolean | null
}

export interface SavedCakePlan {
  readonly id: string
  readonly name: string
  readonly savedAt: string
  readonly signature: string
  readonly snapshot: CakeExperimentSnapshot
}

export function createCakeExperiment(
  parameters: CakeExperimentParameters,
): CakeExperimentSnapshot {
  const partitionAndLayout = createPartitionAndLayout(parameters)
  const criterionDeviationPercent = calculateCriterionDeviationPercent(
    partitionAndLayout.partition,
    parameters.criterion,
  )

  return {
    parameters,
    partition: partitionAndLayout.partition,
    layout: partitionAndLayout.layout,
    criterionDeviationPercent,
    meetsAllowedDeviation:
      criterionDeviationPercent === null
        ? null
        : criterionDeviationPercent <= parameters.allowedDeviationPercent,
  }
}

export function cakePlanSignature(
  parameters: CakeExperimentParameters,
): string {
  return JSON.stringify({
    shape: parameters.shape,
    template: parameters.template,
    size: parameters.size,
    people: parameters.people,
    firstSectorAngle: parameters.firstSectorAngle,
    firstStripPercent: parameters.firstStripPercent,
    gridRows: parameters.gridRows,
    firstRowPercent: parameters.firstRowPercent,
    firstColumnPercent: parameters.firstColumnPercent,
  })
}

export function planCriterionValue(
  plan: SavedCakePlan,
  criterion: CakeFairnessCriterion,
): number {
  const metrics = plan.snapshot.partition.metrics
  if (criterion === "area") return metrics.maxRelativeAreaDeviation * 100
  if (criterion === "outer") return metrics.outerBoundaryRange
  if (criterion === "perimeter") return metrics.perimeterRange
  return metrics.internalCutLength
}

function createPartitionAndLayout(
  parameters: CakeExperimentParameters,
): { partition: CakePartition; layout: CakeExperimentLayout } {
  const { people, size, template } = parameters

  if (!Number.isInteger(people) || people < 2 || people > 8) {
    throw new RangeError("people must be an integer from 2 through 8")
  }

  if (parameters.shape === "circle") {
    if (template !== "equal-sectors" && template !== "adjustable-sectors") {
      throw new RangeError("A circle requires a sector template")
    }

    const angles = template === "equal-sectors"
      ? Array.from({ length: people }, () => 360 / people)
      : adjustableParts(
          360,
          people,
          Math.max(10, Math.min(350, parameters.firstSectorAngle)),
        )
    const partition = template === "equal-sectors"
      ? createEqualCircularSectorPartition({ radius: size, pieceCount: people })
      : createCircularSectorPartition({ radius: size, anglesDegrees: angles })

    return { partition, layout: { circleAngles: angles } }
  }

  if (template === "parallel-strips") {
    const stripSizes = adjustableParts(
      size,
      people,
      size * Math.max(5, Math.min(90, parameters.firstStripPercent)) / 100,
    )
    return {
      partition: createParallelStripPartition({
        width: size,
        height: size,
        orientation: "vertical",
        stripSizes,
      }),
      layout: { rowHeights: [size], columnWidths: stripSizes },
    }
  }

  if (template !== "rectangular-grid") {
    throw new RangeError("A square requires a strip or grid template")
  }

  const rows = divisors(people).includes(parameters.gridRows)
    ? parameters.gridRows
    : 1
  const columns = people / rows
  const rowHeights = rows === 1
    ? [size]
    : adjustableParts(
        size,
        rows,
        size * Math.max(5, Math.min(90, parameters.firstRowPercent)) / 100,
      )
  const columnWidths = columns === 1
    ? [size]
    : adjustableParts(
        size,
        columns,
        size * Math.max(5, Math.min(90, parameters.firstColumnPercent)) / 100,
      )

  return {
    partition: createRectangularGridPartition({
      width: size,
      height: size,
      rowHeights,
      columnWidths,
    }),
    layout: { rowHeights, columnWidths },
  }
}

function adjustableParts(
  total: number,
  count: number,
  firstPart: number,
): number[] {
  if (count === 1) return [total]
  const boundedFirst = Math.max(total * 0.01, Math.min(total * 0.99, firstPart))
  const remainingPart = (total - boundedFirst) / (count - 1)
  return [boundedFirst, ...Array.from({ length: count - 1 }, () => remainingPart)]
}

export function divisors(value: number): number[] {
  return Array.from({ length: value }, (_, index) => index + 1).filter(
    (candidate) => value % candidate === 0,
  )
}

function calculateCriterionDeviationPercent(
  partition: CakePartition,
  criterion: CakeFairnessCriterion,
): number | null {
  if (criterion === "cost") return null
  if (criterion === "area") {
    return partition.metrics.maxRelativeAreaDeviation * 100
  }

  const values = partition.pieces.map((piece) =>
    criterion === "outer"
      ? piece.originalOuterBoundary
      : piece.totalPerimeter,
  )
  const target = values.reduce((sum, value) => sum + value, 0) / values.length
  return Math.max(...values.map((value) => Math.abs(value - target) / target)) * 100
}
