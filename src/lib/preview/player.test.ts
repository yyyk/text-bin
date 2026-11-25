import { readFileSync } from "node:fs"
import { beforeAll, describe, expect, it } from "vitest"
import { Font, initText } from "text-shape"
import type { AtlasFont } from "@/lib/atlas/font"
import { TestContext, testFont, testSettings } from "@/lib/atlas/test-context"
import { createPlayer } from "./player"

let font: AtlasFont
beforeAll(async () => {
  await initText()
  font = testFont(
    Font.fromBytes(readFileSync("public/fonts/Montserrat-Regular.ttf")),
  )
})

const player = () => createPlayer(() => new TestContext(), testSettings, font)

describe("createPlayer", () => {
  it("counts frames over cycles", () => {
    const p = player()
    const cycle = p.engine().cycleFrames
    p.seek(cycle + 10)
    expect(p.position()).toBe(cycle + 10)
    expect(p.engine().cycle()).toBe(2)
    expect(p.engine().frame()).toBe(10)
  })

  it("goes back to a frame with the same result as playing up to it", () => {
    const a = player()
    a.seek(400)
    const b = player()
    b.seek(700)
    b.seek(400)
    expect(b.position()).toBe(400)
    expect(b.engine().stats()).toEqual(a.engine().stats())
    expect(b.engine().sizes()).toEqual(a.engine().sizes())
  })

  it("starts over on restart", () => {
    const p = player()
    p.seek(100)
    p.restart()
    expect(p.position()).toBe(0)
    expect(p.engine().frame()).toBe(0)
  })
})
