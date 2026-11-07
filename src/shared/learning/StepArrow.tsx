/** “上一步 / 下一步”按钮里的箭头：随按钮文字的颜色和字号走，只做装饰，读屏时按钮名字仍是文字本身。 */
export function StepArrow({ direction }: { readonly direction: "prev" | "next" }) {
  return (
    <svg className={`step-arrow is-${direction}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={direction === "prev" ? "M19 12H5M11 6l-6 6 6 6" : "M5 12h14M13 6l6 6-6 6"} />
    </svg>
  )
}
