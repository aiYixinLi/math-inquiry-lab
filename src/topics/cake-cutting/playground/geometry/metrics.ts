import type {
  CakeFairnessMetrics,
  CakePartition,
  CakePartitionKind,
  CakePieceGeometry,
} from "./types"
import { nearlyEqual, validatePositiveFinite } from "./validation"

export interface CalculateFairnessMetricsInput {
  pieces: readonly CakePieceGeometry[]
  totalArea: number
  originalOuterPerimeter: number
}

interface FinalizePartitionInput<TPiece extends CakePieceGeometry> {
  kind: CakePartitionKind
  pieces: TPiece[]
  totalArea: number
  originalOuterPerimeter: number
}

export function calculateFairnessMetrics({
  pieces,
  totalArea,
  originalOuterPerimeter,
}: CalculateFairnessMetricsInput): CakeFairnessMetrics {
  validatePositiveFinite(totalArea, "totalArea")
  validatePositiveFinite(originalOuterPerimeter, "originalOuterPerimeter")

  if (pieces.length === 0) {
    throw new RangeError("pieces must contain at least one piece")
  }

  validatePieces(pieces)

  const targetArea = totalArea / pieces.length
  const totalPieceArea = sumBy(pieces, (piece) => piece.area)
  const totalPiecePerimeter = sumBy(
    pieces,
    (piece) => piece.totalPerimeter,
  )
  const totalNewCutBoundary = sumBy(
    pieces,
    (piece) => piece.newCutBoundary,
  )
  const internalCutLength = totalNewCutBoundary / 2
  const expectedPerimeterSum =
    originalOuterPerimeter + 2 * internalCutLength
  const areaConservationError = Math.abs(totalPieceArea - totalArea)
  const perimeterIdentityError = Math.abs(
    totalPiecePerimeter - expectedPerimeterSum,
  )

  return {
    targetArea,
    maxRelativeAreaDeviation: Math.max(
      ...pieces.map((piece) => Math.abs(piece.area - targetArea) / targetArea),
    ),
    areaRange: range(pieces.map((piece) => piece.area)),
    perimeterRange: range(pieces.map((piece) => piece.totalPerimeter)),
    outerBoundaryRange: range(
      pieces.map((piece) => piece.originalOuterBoundary),
    ),
    internalCutLength,
    totalPieceArea,
    totalPiecePerimeter,
    areaConservationError,
    perimeterIdentityError,
    areaConserved: nearlyEqual(totalPieceArea, totalArea),
    perimeterIdentitySatisfied: nearlyEqual(
      totalPiecePerimeter,
      expectedPerimeterSum,
    ),
  }
}

export function finalizeCakePartition<TPiece extends CakePieceGeometry>({
  kind,
  pieces,
  totalArea,
  originalOuterPerimeter,
}: FinalizePartitionInput<TPiece>): CakePartition<TPiece> {
  const metrics = calculateFairnessMetrics({
    pieces,
    totalArea,
    originalOuterPerimeter,
  })

  if (!metrics.areaConserved) {
    throw new Error(
      `Cake partition violates area conservation by ${metrics.areaConservationError}`,
    )
  }

  if (!metrics.perimeterIdentitySatisfied) {
    throw new Error(
      `Cake partition violates the perimeter identity by ${metrics.perimeterIdentityError}`,
    )
  }

  return {
    kind,
    totalArea,
    originalOuterPerimeter,
    internalCutLength: metrics.internalCutLength,
    pieces,
    metrics,
  }
}

function validatePieces(pieces: readonly CakePieceGeometry[]): void {
  pieces.forEach((piece, index) => {
    validatePositiveFinite(piece.area, `pieces[${index}].area`)

    for (const [name, value] of [
      ["originalOuterBoundary", piece.originalOuterBoundary],
      ["newCutBoundary", piece.newCutBoundary],
      ["totalPerimeter", piece.totalPerimeter],
    ] as const) {
      if (!Number.isFinite(value) || value < 0) {
        throw new RangeError(`pieces[${index}].${name} must be non-negative`)
      }
    }

    if (
      !nearlyEqual(
        piece.totalPerimeter,
        piece.originalOuterBoundary + piece.newCutBoundary,
      )
    ) {
      throw new RangeError(
        `pieces[${index}].totalPerimeter must equal its outer and cut boundaries`,
      )
    }
  })
}

function sumBy<T>(items: readonly T[], select: (item: T) => number): number {
  return items.reduce((sum, item) => sum + select(item), 0)
}

function range(values: readonly number[]): number {
  return Math.max(...values) - Math.min(...values)
}
