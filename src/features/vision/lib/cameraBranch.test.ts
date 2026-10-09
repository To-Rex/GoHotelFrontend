import { describe, expect, it } from "vitest"

import {
  assignableHere,
  cameraPlace,
  defaultDeviceBranchId,
  needsMoveConfirm,
  sortCamerasForBranch,
} from "./cameraBranch"

const HERE = "b-here"
const OTHER = "b-other"

const cams = [
  { id: "c1", branch_id: OTHER },
  { id: "c2", branch_id: HERE },
  { id: "c3", branch_id: null },
  { id: "c4", branch_id: HERE },
  { id: "c5" },
]

describe("cameraPlace", () => {
  it("shu filial / boshqa filial / biriktirilmagan", () => {
    expect(cameraPlace({ id: "x", branch_id: HERE }, HERE)).toBe("here")
    expect(cameraPlace({ id: "x", branch_id: OTHER }, HERE)).toBe("elsewhere")
    expect(cameraPlace({ id: "x", branch_id: null }, HERE)).toBe("unassigned")
    expect(cameraPlace({ id: "x" }, HERE)).toBe("unassigned")
  })

  it("sozlovchi filiali noma'lum bo'lsa biriktirilganlar 'boshqa' hisoblanadi", () => {
    expect(cameraPlace({ id: "x", branch_id: HERE }, undefined)).toBe("elsewhere")
  })
})

describe("sortCamerasForBranch", () => {
  it("avval biriktirilmaganlar, keyin shu filial, keyin boshqalar; guruh ichida tartib saqlanadi", () => {
    expect(sortCamerasForBranch(cams, HERE).map((c) => c.id)).toEqual(["c3", "c5", "c2", "c4", "c1"])
  })

  it("asl massivni o'zgartirmaydi", () => {
    const copy = [...cams]
    sortCamerasForBranch(cams, HERE)
    expect(cams).toEqual(copy)
  })
})

describe("needsMoveConfirm", () => {
  it("biriktirilmagan kamerani biriktirish — tasdiqsiz", () => {
    expect(needsMoveConfirm({ id: "x", branch_id: null }, HERE)).toBe(false)
  })

  it("boshqa filialdan ko'chirish yoki biriktirishni bekor qilish — tasdiq bilan", () => {
    expect(needsMoveConfirm({ id: "x", branch_id: OTHER }, HERE)).toBe(true)
    expect(needsMoveConfirm({ id: "x", branch_id: HERE }, null)).toBe(true)
  })

  it("o'sha filialni qayta tanlash — tasdiqsiz", () => {
    expect(needsMoveConfirm({ id: "x", branch_id: HERE }, HERE)).toBe(false)
  })
})

describe("defaultDeviceBranchId", () => {
  const branches = [{ id: HERE }, { id: OTHER }]

  it("sozlovchi turgan filial sukutda tanlanadi", () => {
    expect(defaultDeviceBranchId(HERE, branches)).toBe(HERE)
  })

  it("filial ro'yxatda bo'lmasa yoki noma'lum bo'lsa — tanlanmagan", () => {
    expect(defaultDeviceBranchId("b-gone", branches)).toBe("")
    expect(defaultDeviceBranchId(undefined, branches)).toBe("")
    expect(defaultDeviceBranchId(HERE, [])).toBe("")
  })
})

describe("assignableHere", () => {
  it("faqat biriktirilmaganlar — boshqa filial kameralari ommaviy ko'chirilmaydi", () => {
    expect(assignableHere(cams, HERE).map((c) => c.id)).toEqual(["c3", "c5"])
  })

  it("sozlovchi filiali noma'lum bo'lsa hech narsa", () => {
    expect(assignableHere(cams, undefined)).toEqual([])
  })
})
