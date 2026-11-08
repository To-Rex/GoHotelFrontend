import { describe, expect, it } from "vitest"

import { groupExpenses, partsLabel } from "./expenseGroups"

const row = (id: string, amount: number, method: string, split_group: string | null = null) => ({
  id,
  amount,
  payment_method: method,
  split_group,
})

describe("groupExpenses", () => {
  it("oddiy qatorlar o'zgarmaydi, bo'laklar bitta guruhga yig'iladi", () => {
    const rows = [row("a", 5000, "CASH"), row("b1", 60000, "CASH", "g1"), row("c", 700, "CARD"), row("b2", 40000, "ONLINE", "g1")]
    const groups = groupExpenses(rows)
    expect(groups.map((g) => g.key)).toEqual(["a", "g1", "c"])
    const split = groups[1]
    expect(split.isSplit).toBe(true)
    expect(split.amount).toBe(100000)
    expect(split.main.id).toBe("b1")
    expect(split.parts.map((p) => p.id)).toEqual(["b1", "b2"])
    expect(groups[0].isSplit).toBe(false)
    expect(groups[0].amount).toBe(5000)
  })

  it("bo'laklar katta summadan kichikka tartiblanadi", () => {
    const groups = groupExpenses([row("x1", 40000, "ONLINE", "g"), row("x2", 60000, "CASH", "g")])
    expect(groups[0].parts.map((p) => p.id)).toEqual(["x2", "x1"])
    expect(partsLabel(groups[0])).toBe("Naqd pul 60,000 + Online to'lov 40,000")
    expect(partsLabel(groups[0], " · ")).toBe("Naqd pul 60,000 · Online to'lov 40,000")
  })

  it("bo'sh ro'yxat va noma'lum usul", () => {
    expect(groupExpenses([])).toEqual([])
    const [g] = groupExpenses([row("q", 10, "WEIRD")])
    expect(partsLabel(g)).toBe("WEIRD 10")
  })
})
