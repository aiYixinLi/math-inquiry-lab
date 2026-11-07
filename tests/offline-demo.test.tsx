// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, expect, it, vi } from "vitest"
import FreeConditionPage from "../src/topics/blind-box/free-condition/FreeConditionPage"

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it("uses the recorded condition without contacting an AI service", async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
  render(<MemoryRouter initialEntries={["/topics/blind-box/free-condition"]}><FreeConditionPage /></MemoryRouter>)
  expect(screen.getByText(/公开演示使用预先录制的 AI 翻译/u)).toBeTruthy()
  expect(screen.queryByRole("button", { name: "实时翻译" })).toBeNull()
  expect(screen.queryByRole("button", { name: "找错练习" })).toBeNull()
  fireEvent.change(screen.getByRole("combobox", { name: "选一条录好的条件" }), { target: { value: "param-4-kinds" } })
  fireEvent.click(screen.getByRole("button", { name: "都没打破，只换了数字" }))
  fireEvent.click(screen.getByRole("button", { name: "回放 AI 的翻译" }))
  expect(screen.getByText(/一共 4 款，每款一样容易抽到/u)).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "更少" }))
  fireEvent.click(screen.getByRole("button", { name: "对，按这个计算" }))
  expect(await screen.findByText("8.33 盒")).toBeTruthy()
  expect(fetchMock).not.toHaveBeenCalled()
})
