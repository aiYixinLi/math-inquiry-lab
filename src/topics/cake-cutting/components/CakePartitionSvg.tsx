const PALETTE = [
  "#ffad68",
  "#62e6ff",
  "#a98cff",
  "#5cf2b2",
  "#ff718b",
  "#ffd166",
  "#6fa8ff",
  "#c6ef71",
]

export type BoundaryMode = "all" | "outer" | "cut"

interface CirclePartitionSvgProps {
  readonly anglesDegrees: readonly number[]
  readonly boundaryMode?: BoundaryMode
  readonly title?: string
  readonly showLabels?: boolean
}

interface RectanglePartitionSvgProps {
  readonly width: number
  readonly height: number
  readonly rowHeights: readonly number[]
  readonly columnWidths: readonly number[]
  readonly boundaryMode?: BoundaryMode
  readonly title?: string
  readonly showLabels?: boolean
}

interface Point {
  x: number
  y: number
}

function polarPoint(
  centerX: number,
  centerY: number,
  radius: number,
  angleDegrees: number,
): Point {
  const radians = (angleDegrees * Math.PI) / 180
  return {
    x: centerX + radius * Math.cos(radians),
    y: centerY + radius * Math.sin(radians),
  }
}

function sectorPath(
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarPoint(centerX, centerY, radius, startAngle)
  const end = polarPoint(centerX, centerY, radius, endAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return [
    `M ${centerX} ${centerY}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`,
    "Z",
  ].join(" ")
}

export function CirclePartitionSvg({
  anglesDegrees,
  boundaryMode = "all",
  title = "圆形蛋糕扇形切分图",
  showLabels = true,
}: CirclePartitionSvgProps) {
  const center = 120
  const radius = 94
  let cursor = -90
  const sectors = anglesDegrees.map((angle, index) => {
    const start = cursor
    const end = cursor + angle
    cursor = end
    return { angle, end, index, start }
  })
  const showOuter = boundaryMode === "all" || boundaryMode === "outer"
  const showCut = boundaryMode === "all" || boundaryMode === "cut"

  return (
    <svg
      className="cake-partition-svg"
      viewBox="0 0 240 240"
      role="img"
      aria-label={title}
      data-boundary-mode={boundaryMode}
    >
      <title>{title}</title>
      <circle cx={center} cy={center} r={radius + 7} className="cake-svg-orbit" />
      {sectors.map(({ angle, end, index, start }) => {
        const labelPoint = polarPoint(center, center, radius * 0.57, start + angle / 2)
        return (
          <g key={`${start}-${end}`}>
            <path
              d={sectorPath(center, center, radius, start, end)}
              fill={PALETTE[index % PALETTE.length]}
              className="cake-svg-piece"
            />
            {showLabels && (
              <text x={labelPoint.x} y={labelPoint.y} className="cake-svg-label">
                {index + 1}
              </text>
            )}
          </g>
        )
      })}
      <circle
        cx={center}
        cy={center}
        r={radius}
        className={`cake-svg-outer ${showOuter ? "is-highlighted" : ""}`}
      />
      {sectors.map(({ start }, index) => {
        const end = polarPoint(center, center, radius, start)
        return (
          <line
            key={`ray-${index}`}
            x1={center}
            y1={center}
            x2={end.x}
            y2={end.y}
            className={`cake-svg-cut ${showCut ? "is-highlighted" : ""}`}
          />
        )
      })}
      <circle cx={center} cy={center} r="4" className="cake-svg-center" />
    </svg>
  )
}

export function RectanglePartitionSvg({
  width,
  height,
  rowHeights,
  columnWidths,
  boundaryMode = "all",
  title = "方形蛋糕矩形切分图",
  showLabels = true,
}: RectanglePartitionSvgProps) {
  const boxWidth = width >= height ? 190 : (190 * width) / height
  const boxHeight = height >= width ? 190 : (190 * height) / width
  const offsetX = (240 - boxWidth) / 2
  const offsetY = (240 - boxHeight) / 2
  const xScale = boxWidth / width
  const yScale = boxHeight / height
  const showOuter = boundaryMode === "all" || boundaryMode === "outer"
  const showCut = boundaryMode === "all" || boundaryMode === "cut"

  const rowOffsets = rowHeights.map((_, index) =>
    rowHeights.slice(0, index).reduce((sum, item) => sum + item, 0),
  )
  const columnOffsets = columnWidths.map((_, index) =>
    columnWidths.slice(0, index).reduce((sum, item) => sum + item, 0),
  )

  return (
    <svg
      className="cake-partition-svg"
      viewBox="0 0 240 240"
      role="img"
      aria-label={title}
      data-boundary-mode={boundaryMode}
    >
      <title>{title}</title>
      <rect
        x={offsetX - 7}
        y={offsetY - 7}
        width={boxWidth + 14}
        height={boxHeight + 14}
        rx="4"
        className="cake-svg-square-orbit"
      />
      {rowHeights.flatMap((rowHeight, rowIndex) =>
        columnWidths.map((columnWidth, columnIndex) => {
          const x = offsetX + columnOffsets[columnIndex] * xScale
          const y = offsetY + rowOffsets[rowIndex] * yScale
          const cellWidth = columnWidth * xScale
          const cellHeight = rowHeight * yScale
          const pieceIndex = rowIndex * columnWidths.length + columnIndex
          return (
            <g key={`${rowIndex}-${columnIndex}`}>
              <rect
                x={x}
                y={y}
                width={cellWidth}
                height={cellHeight}
                fill={PALETTE[pieceIndex % PALETTE.length]}
                className="cake-svg-piece"
              />
              {showLabels && (
                <text
                  x={x + cellWidth / 2}
                  y={y + cellHeight / 2}
                  className="cake-svg-label"
                >
                  {pieceIndex + 1}
                </text>
              )}
            </g>
          )
        }),
      )}
      <rect
        x={offsetX}
        y={offsetY}
        width={boxWidth}
        height={boxHeight}
        className={`cake-svg-outer ${showOuter ? "is-highlighted" : ""}`}
      />
      {columnOffsets.slice(1).map((columnOffset, index) => (
        <line
          key={`column-${index}`}
          x1={offsetX + columnOffset * xScale}
          y1={offsetY}
          x2={offsetX + columnOffset * xScale}
          y2={offsetY + boxHeight}
          className={`cake-svg-cut ${showCut ? "is-highlighted" : ""}`}
        />
      ))}
      {rowOffsets.slice(1).map((rowOffset, index) => (
        <line
          key={`row-${index}`}
          x1={offsetX}
          y1={offsetY + rowOffset * yScale}
          x2={offsetX + boxWidth}
          y2={offsetY + rowOffset * yScale}
          className={`cake-svg-cut ${showCut ? "is-highlighted" : ""}`}
        />
      ))}
    </svg>
  )
}
