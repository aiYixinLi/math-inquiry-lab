import { AppFrame } from "../../app/layouts"
import { TOPICS } from "../../app/topic-registry"
import { APPLICATION_VERSION_LABEL } from "../../app/version"
import { useProgress } from "../../shared/progress"
import { TopicCard } from "./TopicCard"

export default function HomePage() {
  const progress = useProgress()

  return (
    <AppFrame pageLabel="数学探究实验室首页">
      <section className="home-screen">
        <header className="home-screen__intro">
          <div className="home-screen__intro-copy">
            <span className="home-screen__intro-kicker" aria-hidden="true">
              <i />探究起点 <b>START HERE</b>
            </span>
            <h1>从真实问题出发，建立可以检验的数学模型</h1>
            <p>选择一个课题，依次完成互动学习、模拟实验和测试反馈。</p>
          </div>
          <div className="home-screen__intro-route" aria-hidden="true">
            <span><i>01</i><b>互动学习</b></span>
            <span><i>02</i><b>模拟实验</b></span>
            <span><i>03</i><b>测试反馈</b></span>
          </div>
        </header>

        <div className="home-screen__topics">
          {TOPICS.map((topic) => (
            <TopicCard key={topic.id} topic={topic} progress={progress[topic.id]} />
          ))}
        </div>

        <footer className="home-screen__foot">
          <span><i />先声明模型条件和评价指标</span>
          <span><i />实验数据不等同于理论证明</span>
          <span><i />记录首次作答与订正过程</span>
          <strong>Web App {APPLICATION_VERSION_LABEL}</strong>
        </footer>
      </section>
    </AppFrame>
  )
}
