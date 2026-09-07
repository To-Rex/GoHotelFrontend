import { describe, expect, it } from "vitest"
import type { GuestFeedback } from "@/types/api"
import {
  countByStatus,
  defaultPriorityFor,
  filterFeedback,
  isClosed,
  nextStatuses,
  requiresResolution,
} from "./feedbackRules"

const item = (over: Partial<GuestFeedback>): GuestFeedback => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  hotel_id: "h",
  feedback_type: "REQUEST",
  status: "NEW",
  priority: "MEDIUM",
  subject: "Sochiq",
  body: "Qo'shimcha sochiq kerak",
  created_by: "u",
  ...over,
})

describe("holat o'tishlari (backend TRANSITIONS bilan bir xil)", () => {
  it("yangi murojaat ko'rib chiqishga olinadi yoki darhol yopiladi", () => {
    expect(nextStatuses("NEW")).toEqual(["IN_PROGRESS", "RESOLVED", "REJECTED"])
  })
  it("jarayondagi murojaat faqat yopiladi", () => {
    expect(nextStatuses("IN_PROGRESS")).toEqual(["RESOLVED", "REJECTED"])
  })
  it("yopilgani faqat qayta ochiladi", () => {
    expect(nextStatuses("RESOLVED")).toEqual(["IN_PROGRESS"])
    expect(nextStatuses("REJECTED")).toEqual(["IN_PROGRESS"])
  })
  it("yopishda javob shart, ochishda emas", () => {
    expect(requiresResolution("RESOLVED")).toBe(true)
    expect(requiresResolution("REJECTED")).toBe(true)
    expect(requiresResolution("IN_PROGRESS")).toBe(false)
    expect(isClosed("NEW")).toBe(false)
  })
})

describe("standart muhimlik", () => {
  it("shikoyat yuqori, qolganlari o'rta", () => {
    expect(defaultPriorityFor("COMPLAINT")).toBe("HIGH")
    expect(defaultPriorityFor("REQUEST")).toBe("MEDIUM")
    expect(defaultPriorityFor("SUGGESTION")).toBe("MEDIUM")
  })
})

describe("filtr va hisob", () => {
  const items = [
    item({ id: "a", status: "NEW", feedback_type: "COMPLAINT", room_number: "101" }),
    item({ id: "b", status: "IN_PROGRESS", guest_name: "Ali Valiyev" }),
    item({ id: "c", status: "RESOLVED", feedback_type: "SUGGESTION" }),
    item({ id: "d", status: "REJECTED", guest_phone: "+998901234567" }),
  ]

  it("'Ochiq' yopilganlarni yashiradi", () => {
    expect(filterFeedback(items, { tab: "OPEN", type: "ALL", query: "" }).map((i) => i.id)).toEqual(["a", "b"])
  })
  it("holat va tur bo'yicha", () => {
    expect(filterFeedback(items, { tab: "RESOLVED", type: "ALL", query: "" }).map((i) => i.id)).toEqual(["c"])
    expect(filterFeedback(items, { tab: "ALL", type: "COMPLAINT", query: "" }).map((i) => i.id)).toEqual(["a"])
  })
  it("qidiruv ism, telefon va xona raqamida ham ishlaydi", () => {
    expect(filterFeedback(items, { tab: "ALL", type: "ALL", query: "valiyev" }).map((i) => i.id)).toEqual(["b"])
    expect(filterFeedback(items, { tab: "ALL", type: "ALL", query: "1234" }).map((i) => i.id)).toEqual(["d"])
    expect(filterFeedback(items, { tab: "ALL", type: "ALL", query: "101" }).map((i) => i.id)).toEqual(["a"])
  })
  it("hisob: ochiq = yangi + jarayonda", () => {
    const c = countByStatus(items)
    expect(c.ALL).toBe(4)
    expect(c.OPEN).toBe(2)
    expect(c.NEW).toBe(1)
    expect(c.RESOLVED).toBe(1)
    expect(c.REJECTED).toBe(1)
  })
})
