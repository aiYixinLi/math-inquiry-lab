export type CakePartitionKind =
  | "circular-sectors"
  | "parallel-strips"
  | "rectangular-grid"

export type StripOrientation = "vertical" | "horizontal"

export interface CakePieceGeometry {
  id: string
  area: number
  originalOuterBoundary: number
  newCutBoundary: number
  totalPerimeter: number
}

export interface CircularSectorPiece extends CakePieceGeometry {
  angleDegrees: number
  arcLength: number
}

export interface ParallelStripPiece extends CakePieceGeometry {
  index: number
  stripSize: number
  width: number
  height: number
}

export interface RectangularGridPiece extends CakePieceGeometry {
  rowIndex: number
  columnIndex: number
  width: number
  height: number
}

export interface CakeFairnessMetrics {
  targetArea: number
  maxRelativeAreaDeviation: number
  areaRange: number
  perimeterRange: number
  outerBoundaryRange: number
  internalCutLength: number
  totalPieceArea: number
  totalPiecePerimeter: number
  areaConservationError: number
  perimeterIdentityError: number
  areaConserved: boolean
  perimeterIdentitySatisfied: boolean
}

export interface CakePartition<
  TPiece extends CakePieceGeometry = CakePieceGeometry,
> {
  kind: CakePartitionKind
  totalArea: number
  originalOuterPerimeter: number
  internalCutLength: number
  pieces: TPiece[]
  metrics: CakeFairnessMetrics
}

export interface CircularSectorPartitionInput {
  radius: number
  anglesDegrees: readonly number[]
}

export interface EqualCircularSectorPartitionInput {
  radius: number
  pieceCount: number
}

export interface ParallelStripPartitionInput {
  width: number
  height: number
  orientation: StripOrientation
  stripSizes: readonly number[]
}

export interface EqualParallelStripPartitionInput {
  width: number
  height: number
  orientation: StripOrientation
  pieceCount: number
}

export interface RectangularGridPartitionInput {
  width: number
  height: number
  rowHeights: readonly number[]
  columnWidths: readonly number[]
}

export interface EqualRectangularGridPartitionInput {
  width: number
  height: number
  rows: number
  columns: number
}
