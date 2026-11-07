import { finalizeCakePartition } from "./metrics"
import type {
  CakePartition,
  EqualParallelStripPartitionInput,
  EqualRectangularGridPartitionInput,
  ParallelStripPartitionInput,
  ParallelStripPiece,
  RectangularGridPartitionInput,
  RectangularGridPiece,
} from "./types"
import {
  validateGridSplits,
  validatePositiveInteger,
  validateRectangleDimensions,
  validateSplitSizes,
} from "./validation"

export function createParallelStripPartition({
  width,
  height,
  orientation,
  stripSizes,
}: ParallelStripPartitionInput): CakePartition<ParallelStripPiece> {
  validateRectangleDimensions(width, height)

  if (orientation !== "vertical" && orientation !== "horizontal") {
    throw new RangeError('orientation must be "vertical" or "horizontal"')
  }

  const totalAlongCutAxis = orientation === "vertical" ? width : height
  validateSplitSizes(stripSizes, totalAlongCutAxis, "stripSizes")

  const stripCount = stripSizes.length
  const pieces = stripSizes.map((stripSize, index) => {
    const isFirst = index === 0
    const isLast = index === stripCount - 1
    const pieceWidth = orientation === "vertical" ? stripSize : width
    const pieceHeight = orientation === "vertical" ? height : stripSize
    const parallelOuterBoundary = 2 * stripSize
    const perpendicularSide = orientation === "vertical" ? height : width
    const originalOuterBoundary =
      parallelOuterBoundary +
      (isFirst ? perpendicularSide : 0) +
      (isLast ? perpendicularSide : 0)
    const newCutBoundary =
      stripCount === 1
        ? 0
        : (isFirst ? perpendicularSide : 0) +
          (isLast ? perpendicularSide : 0) +
          (!isFirst && !isLast ? 2 * perpendicularSide : 0)

    return {
      id: `strip-${index + 1}`,
      index,
      stripSize,
      width: pieceWidth,
      height: pieceHeight,
      area: pieceWidth * pieceHeight,
      originalOuterBoundary,
      newCutBoundary,
      totalPerimeter: originalOuterBoundary + newCutBoundary,
    }
  })

  return finalizeCakePartition({
    kind: "parallel-strips",
    pieces,
    totalArea: width * height,
    originalOuterPerimeter: 2 * (width + height),
  })
}

export function createEqualParallelStripPartition({
  width,
  height,
  orientation,
  pieceCount,
}: EqualParallelStripPartitionInput): CakePartition<ParallelStripPiece> {
  validatePositiveInteger(pieceCount, "pieceCount")
  const totalAlongCutAxis = orientation === "vertical" ? width : height

  return createParallelStripPartition({
    width,
    height,
    orientation,
    stripSizes: Array.from(
      { length: pieceCount },
      () => totalAlongCutAxis / pieceCount,
    ),
  })
}

export function createRectangularGridPartition({
  width,
  height,
  rowHeights,
  columnWidths,
}: RectangularGridPartitionInput): CakePartition<RectangularGridPiece> {
  validateGridSplits(width, height, rowHeights, columnWidths)

  const rowCount = rowHeights.length
  const columnCount = columnWidths.length
  const pieces = rowHeights.flatMap((pieceHeight, rowIndex) =>
    columnWidths.map((pieceWidth, columnIndex) => {
      const originalOuterBoundary =
        (rowIndex === 0 ? pieceWidth : 0) +
        (rowIndex === rowCount - 1 ? pieceWidth : 0) +
        (columnIndex === 0 ? pieceHeight : 0) +
        (columnIndex === columnCount - 1 ? pieceHeight : 0)
      const newCutBoundary =
        (rowIndex > 0 ? pieceWidth : 0) +
        (rowIndex < rowCount - 1 ? pieceWidth : 0) +
        (columnIndex > 0 ? pieceHeight : 0) +
        (columnIndex < columnCount - 1 ? pieceHeight : 0)

      return {
        id: `cell-${rowIndex + 1}-${columnIndex + 1}`,
        rowIndex,
        columnIndex,
        width: pieceWidth,
        height: pieceHeight,
        area: pieceWidth * pieceHeight,
        originalOuterBoundary,
        newCutBoundary,
        totalPerimeter: originalOuterBoundary + newCutBoundary,
      }
    }),
  )

  return finalizeCakePartition({
    kind: "rectangular-grid",
    pieces,
    totalArea: width * height,
    originalOuterPerimeter: 2 * (width + height),
  })
}

export function createEqualRectangularGridPartition({
  width,
  height,
  rows,
  columns,
}: EqualRectangularGridPartitionInput): CakePartition<RectangularGridPiece> {
  validatePositiveInteger(rows, "rows")
  validatePositiveInteger(columns, "columns")

  return createRectangularGridPartition({
    width,
    height,
    rowHeights: Array.from({ length: rows }, () => height / rows),
    columnWidths: Array.from({ length: columns }, () => width / columns),
  })
}
