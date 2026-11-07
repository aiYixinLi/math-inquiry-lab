import { finalizeCakePartition } from "./metrics"
import type {
  CakePartition,
  CircularSectorPartitionInput,
  CircularSectorPiece,
  EqualCircularSectorPartitionInput,
} from "./types"
import {
  validatePositiveFinite,
  validatePositiveInteger,
  validateSectorAngles,
} from "./validation"

export function createCircularSectorPartition({
  radius,
  anglesDegrees,
}: CircularSectorPartitionInput): CakePartition<CircularSectorPiece> {
  validatePositiveFinite(radius, "radius")
  validateSectorAngles(anglesDegrees)

  const sectorCount = anglesDegrees.length
  const pieces = anglesDegrees.map((angleDegrees, index) => {
    const area = (angleDegrees / 360) * Math.PI * radius ** 2
    const arcLength = (angleDegrees / 360) * 2 * Math.PI * radius
    const newCutBoundary = sectorCount === 1 ? 0 : 2 * radius

    return {
      id: `sector-${index + 1}`,
      angleDegrees,
      arcLength,
      area,
      originalOuterBoundary: arcLength,
      newCutBoundary,
      totalPerimeter: arcLength + newCutBoundary,
    }
  })

  return finalizeCakePartition({
    kind: "circular-sectors",
    pieces,
    totalArea: Math.PI * radius ** 2,
    originalOuterPerimeter: 2 * Math.PI * radius,
  })
}

export function createEqualCircularSectorPartition({
  radius,
  pieceCount,
}: EqualCircularSectorPartitionInput): CakePartition<CircularSectorPiece> {
  validatePositiveInteger(pieceCount, "pieceCount")

  return createCircularSectorPartition({
    radius,
    anglesDegrees: Array.from({ length: pieceCount }, () => 360 / pieceCount),
  })
}
