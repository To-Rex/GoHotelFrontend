import { describe, expect, it } from "vitest"

import { CLASS_COLOR, UZ, durationColor, octagramPoints, rhombusPoints, statusColor } from "./ornament"

const parse = (pts: string) => pts.split(" ").map((p) => p.split(",").map(Number) as [number, number])

describe("o'zbek naqshi — geometriya va ranglar", () => {
  it("sakkiz qirrali yulduz: 16 nuqta, uchlari tashqi, botiqlari ichki radiusda", () => {
    const pts = parse(octagramPoints(12, 12, 11))
    expect(pts).toHaveLength(16)
    const dist = ([x, y]: [number, number]) => Math.hypot(x - 12, y - 12)
    const inner = (11 * Math.cos(Math.PI / 4)) / Math.cos(Math.PI / 8)
    pts.forEach((p, i) => expect(dist(p)).toBeCloseTo(i % 2 === 0 ? 11 : inner, 1))
    // Birinchi uch — tepada (ikki kvadrat: biri tik, biri 45° burilgan)
    expect(pts[0]).toEqual([12, 1])
  })

  it("burilgan yulduz va romb", () => {
    const rotated = parse(octagramPoints(0, 0, 10, 22.5))
    expect(Math.atan2(rotated[0][1], rotated[0][0]) * (180 / Math.PI)).toBeCloseTo(-67.5, 0)
    expect(rhombusPoints(10, 5, 4, 3)).toBe("10,2 14,5 10,8 6,5")
  })

  it("holat sinfi ranglari koshin tartibida", () => {
    expect(CLASS_COLOR).toEqual({ "2xx": UZ.feruza, "3xx": UZ.lojuvard, "4xx": UZ.tilla, "5xx": UZ.anor })
    expect(statusColor(201)).toBe(UZ.feruza)
    expect(statusColor(422)).toBe(UZ.tilla)
    expect(statusColor(503)).toBe(UZ.anor)
    expect(statusColor(99)).toBe("#8a93a3")
  })

  it("davomiylik rangi: tez, sekinlashgan, juda sekin", () => {
    expect(durationColor(12)).toBe(UZ.feruza)
    expect(durationColor(300)).toBe(UZ.tilla)
    expect(durationColor(1500)).toBe(UZ.anor)
  })
})
