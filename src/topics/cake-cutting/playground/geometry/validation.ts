export const GEOMETRY_TOLERANCE = 1e-9

export function nearlyEqual(
  actual: number,
  expected: number,
  tolerance = GEOMETRY_TOLERANCE,
): boolean {
  const scale = Math.max(1, Math.abs(actual), Math.abs(expected))
  return Math.abs(actual - expected) <= tolerance * scale
}

export function validatePositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`)
  }
}

export function validatePositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`)
  }
}

export function validateRectangleDimensions(
  width: number,
  height: number,
): void {
  validatePositiveFinite(width, "width")
  validatePositiveFinite(height, "height")
}

export function validateSectorAngles(
  anglesDegrees: readonly number[],
  tolerance = GEOMETRY_TOLERANCE,
): void {
  if (anglesDegrees.length === 0) {
    throw new RangeError("anglesDegrees must contain at least one angle")
  }

  anglesDegrees.forEach((angle, index) => {
    validatePositiveFinite(angle, `anglesDegrees[${index}]`)
  })

  validatePartsSum(anglesDegrees, 360, "anglesDegrees", tolerance)
}

export function validateSplitSizes(
  splitSizes: readonly number[],
  totalSize: number,
  name = "splitSizes",
  tolerance = GEOMETRY_TOLERANCE,
): void {
  validatePositiveFinite(totalSize, "totalSize")

  if (splitSizes.length === 0) {
    throw new RangeError(`${name} must contain at least one size`)
  }

  splitSizes.forEach((size, index) => {
    validatePositiveFinite(size, `${name}[${index}]`)
  })

  validatePartsSum(splitSizes, totalSize, name, tolerance)
}

export function validateGridSplits(
  width: number,
  height: number,
  rowHeights: readonly number[],
  columnWidths: readonly number[],
  tolerance = GEOMETRY_TOLERANCE,
): void {
  validateRectangleDimensions(width, height)
  validateSplitSizes(rowHeights, height, "rowHeights", tolerance)
  validateSplitSizes(columnWidths, width, "columnWidths", tolerance)
}

function validatePartsSum(
  parts: readonly number[],
  expected: number,
  name: string,
  tolerance: number,
): void {
  const actual = parts.reduce((sum, part) => sum + part, 0)

  if (!nearlyEqual(actual, expected, tolerance)) {
    throw new RangeError(
      `${name} must sum to ${expected}; received ${actual}`,
    )
  }
}
