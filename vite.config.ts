/// <reference types="vitest/config" />
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// 此公开版本固定使用预录回放，不连接翻译服务。
const nodeHasWebStorage = "localStorage" in globalThis
export default defineConfig({
  plugins: [react()],
  base: "./",
  define: { "import.meta.env.VITE_OFFLINE_DEMO": JSON.stringify("true") },
  test: { poolOptions: { forks: { execArgv: nodeHasWebStorage ? ["--no-experimental-webstorage"] : [] } } },
})
