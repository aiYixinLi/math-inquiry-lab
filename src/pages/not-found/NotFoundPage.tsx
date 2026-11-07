import { Link } from "react-router-dom"
import { AppFrame } from "../../app/layouts"

export default function NotFoundPage() {
  return (
    <AppFrame pageLabel="页面未找到">
      <section className="not-found-screen">
        <span>404</span>
        <h1>没有找到这个探究页面</h1>
        <p>请返回首页，从三个数学课题中重新选择学习路径。</p>
        <Link to="/">返回数学探究实验室</Link>
      </section>
    </AppFrame>
  )
}
