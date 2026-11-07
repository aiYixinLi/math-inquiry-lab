import { lazy, Suspense, useEffect, useState } from "react"
import { HashRouter, Route, Routes, useLocation } from "react-router-dom"
import HomePage from "./pages/home/HomePage"
import NotFoundPage from "./pages/not-found/NotFoundPage"
import { TOPICS, type TopicModule } from "./app/topic-registry"
import { migrateLegacyBlindBoxSession } from "./shared/data"

let startupMigrationPromise: ReturnType<typeof migrateLegacyBlindBoxSession> | null = null

function startLegacyBlindBoxMigration() {
  startupMigrationPromise ??= migrateLegacyBlindBoxSession()
  return startupMigrationPromise
}

const BlindBoxLearningPage = lazy(() =>
  import("./topics/blind-box/learn/BlindBoxLearningPage"),
)
const BlindBoxPlaygroundPage = lazy(() =>
  import("./topics/blind-box/playground/BlindBoxPlaygroundPage"),
)
const BlindBoxQuizPage = lazy(() =>
  import("./topics/blind-box/quiz/BlindBoxQuizPage"),
)
const ElevatorLearningPage = lazy(() =>
  import("./topics/elevator/learn/ElevatorLearningPage"),
)
const ElevatorPlaygroundPage = lazy(() =>
  import("./topics/elevator/playground/ElevatorPlaygroundPage"),
)
const ElevatorQuizPage = lazy(() =>
  import("./topics/elevator/quiz/ElevatorQuizPage"),
)
const CakeLearningPage = lazy(() =>
  import("./topics/cake-cutting/learn/CakeLearningPage"),
)
const CakePlaygroundPage = lazy(() =>
  import("./topics/cake-cutting/playground/CakePlaygroundPage"),
)
const CakeQuizPage = lazy(() =>
  import("./topics/cake-cutting/quiz/CakeQuizPage"),
)
const LadderPage = lazy(() =>
  import("./topics/blind-box/ladder/LadderPage"),
)
const FreeConditionPage = lazy(() =>
  import("./topics/blind-box/free-condition/FreeConditionPage"),
)

function RouteLoading() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <span aria-hidden="true" />
      <strong>正在装载数学探究模块</strong>
    </div>
  )
}

const MODULE_TITLE: Record<TopicModule, string> = {
  learn: "互动学习",
  playground: "模拟实验",
  quiz: "测试与反馈",
}

function RouteMetadata() {
  const { pathname } = useLocation()

  useEffect(() => {
    if (pathname === "/") {
      document.title = "数学探究实验室"
      return
    }
    for (const topic of TOPICS) {
      for (const module of Object.keys(topic.routes) as TopicModule[]) {
        if (topic.routes[module] === pathname) {
          document.title = `${MODULE_TITLE[module]}｜${topic.title}｜数学探究实验室`
          return
        }
      }
      for (const page of topic.extraPages ?? []) {
        if (page.route === pathname) {
          document.title = `${page.label}｜${topic.title}｜数学探究实验室`
          return
        }
      }
    }
    document.title = "页面未找到｜数学探究实验室"
  }, [pathname])

  return null
}

function StartupDataMigration() {
  const [message, setMessage] = useState("")

  useEffect(() => {
    let active = true
    void startLegacyBlindBoxMigration()
      .then((result) => {
        if (!active) return
        if (result.status === "migrated") {
          setMessage("已将原盲盒会话安全复制到新应用命名空间；原记录仍被保留。")
          window.setTimeout(() => active && setMessage(""), 4200)
        } else if (result.status === "storage-unavailable") {
          setMessage("检测到原盲盒记录，但暂时无法复制；原记录未被修改，仍可在盲盒实验中导出。")
        }
      })
      .catch(() => {
        // Migration is fail-safe: the legacy data remains the active source.
      })
    return () => {
      active = false
    }
  }, [])

  return message ? <div className="migration-notice" role="status">{message}</div> : null
}

export default function App() {
  return (
    <HashRouter>
      <RouteMetadata />
      <StartupDataMigration />
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/topics/blind-box/learn" element={<BlindBoxLearningPage />} />
          <Route path="/topics/blind-box/playground" element={<BlindBoxPlaygroundPage />} />
          <Route path="/topics/blind-box/quiz" element={<BlindBoxQuizPage />} />
          <Route path="/topics/blind-box/ladder" element={<LadderPage />} />
          <Route path="/topics/blind-box/free-condition" element={<FreeConditionPage />} />
          <Route path="/topics/elevator/learn" element={<ElevatorLearningPage />} />
          <Route path="/topics/elevator/playground" element={<ElevatorPlaygroundPage />} />
          <Route path="/topics/elevator/quiz" element={<ElevatorQuizPage />} />
          <Route path="/topics/cake-cutting/learn" element={<CakeLearningPage />} />
          <Route path="/topics/cake-cutting/playground" element={<CakePlaygroundPage />} />
          <Route path="/topics/cake-cutting/quiz" element={<CakeQuizPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </HashRouter>
  )
}
