export function ViewportGuard() {
  return (
    <div className="math-viewport-guard" role="status" aria-live="polite">
      <div className="math-viewport-guard__device" aria-hidden="true"><i /></div>
      <strong>请横屏使用数学探究实验室</strong>
      <span>旋转设备后，每个学习步骤、实验工作台和测试题均可在一个屏幕内完整显示。</span>
    </div>
  )
}
