import { describe, expect, it } from "vitest"

import {
  canMarkLeft,
  canMarkReturned,
  canRemove,
  companionAddCheck,
  companionState,
  companionStatusLabel,
  freeSeats,
  insideCount,
  isPresent,
  presentCompanions,
  shortMoment,
} from "./companions"

/* Turish davomida hamrohlar: kim ichkarida, joy bormi, qaysi tugma chiqadi.
   Qoidalar serverdagi companion_ops bilan bir xil bo'lishi kerak. */

const NOW = new Date(2026, 8, 25, 15, 0)

const inside = { guest_id: "a", name: "Ali" }
const left = { guest_id: "b", name: "Vali", left_at: "2026-09-25T09:30:00+05:00" }
const added = { guest_id: "c", name: "Soli", added_at: "2026-09-24T12:00:00+05:00" }
const returned = { guest_id: "d", name: "Doli", returned_at: "2026-09-25T10:10:00+05:00" }

describe("presence", () => {
  it("eski yozuv (belgisiz) ichkarida hisoblanadi", () => {
    expect(isPresent(inside)).toBe(true)
    expect(isPresent(added)).toBe(true)
    expect(isPresent(null)).toBe(true)
  })

  it("ketgan yozuv ichkarida emas", () => {
    expect(isPresent(left)).toBe(false)
    expect(presentCompanions([inside, left, added])).toHaveLength(2)
    expect(presentCompanions(null)).toEqual([])
  })

  it("ichkaridagilar: asosiy mehmon + ketmagan hamrohlar", () => {
    expect(insideCount({ companions: null })).toBe(1)
    expect(insideCount({ companions: [inside, left] })).toBe(2)
  })
})

describe("freeSeats", () => {
  it("hamroh ketsa joy bo'shaydi", () => {
    expect(freeSeats({ adults: 2, companions: [inside] })).toBe(0)
    expect(freeSeats({ adults: 2, companions: [left] })).toBe(1)
  })

  it("manfiy chiqmaydi — mehmonlar soni kamaytirilgan bo'lsa ham", () => {
    expect(freeSeats({ adults: 1, companions: [inside, added] })).toBe(0)
  })

  it("adults buzuq bo'lsa 1 deb olinadi", () => {
    expect(freeSeats({ adults: 0, companions: null })).toBe(0)
    expect(freeSeats({ adults: Number.NaN, companions: null })).toBe(0)
  })
})

describe("companionAddCheck", () => {
  it("kirgan bronda bo'sh joy bo'lsa mumkin", () => {
    expect(
      companionAddCheck({ status: "CHECKED_IN", adults: 2, companions: [left] })
    ).toEqual({ ok: true })
  })

  it("kirishdan oldin ham mumkin", () => {
    expect(
      companionAddCheck({ status: "CONFIRMED", adults: 3, companions: [inside] })
    ).toEqual({ ok: true })
  })

  it("joy yo'q — sababi nima qilish kerakligini aytadi", () => {
    const r = companionAddCheck({ status: "CHECKED_IN", adults: 2, companions: [inside] })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain("mehmonlar soni 2")
  })

  it("chiqish jarayonida yoki yopilgan bronda mumkin emas", () => {
    expect(
      companionAddCheck({
        status: "CHECKED_IN",
        adults: 2,
        companions: null,
        checkout_requested_at: "2026-09-25T10:00:00",
      }).ok
    ).toBe(false)
    expect(companionAddCheck({ status: "CHECKED_OUT", adults: 2, companions: null }).ok).toBe(
      false
    )
    expect(companionAddCheck({ status: "CANCELLED", adults: 2, companions: null }).ok).toBe(
      false
    )
  })
})

describe("amallar", () => {
  it("ketganini belgilash — faqat kirgan bronda, ichkaridagi hamroh", () => {
    expect(canMarkLeft({ status: "CHECKED_IN" }, inside)).toBe(true)
    expect(canMarkLeft({ status: "CHECKED_IN" }, left)).toBe(false)
    expect(canMarkLeft({ status: "CONFIRMED" }, inside)).toBe(false)
  })

  it("qaytdi — faqat ketgan deb belgilangan hamroh", () => {
    expect(canMarkReturned({ status: "CHECKED_IN" }, left)).toBe(true)
    expect(canMarkReturned({ status: "CHECKED_IN" }, inside)).toBe(false)
  })

  it("o'chirish — faqat kirishdan oldin", () => {
    expect(canRemove({ status: "CONFIRMED" })).toBe(true)
    expect(canRemove({ status: "CHECKED_IN" })).toBe(false)
  })
})

describe("chip", () => {
  it("holat: ketdi ustun, keyin qaytdi, keyin qo'shildi", () => {
    expect(companionState(inside)).toBe("inside")
    expect(companionState(left)).toBe("left")
    expect(companionState(returned)).toBe("returned")
    expect(companionState(added)).toBe("added")
    expect(companionState({ ...returned, left_at: left.left_at })).toBe("left")
  })

  it("bugungi vaqt faqat soat, boshqa kun sana bilan", () => {
    expect(shortMoment("2026-09-25T09:30:00+05:00", NOW)).toMatch(/^\d{2}:\d{2}$/)
    expect(shortMoment("2026-09-24T12:00:00+05:00", NOW)).toMatch(/^\d{2}\.\d{2}, \d{2}:\d{2}$/)
    expect(shortMoment(null, NOW)).toBeNull()
    expect(shortMoment("buzuq", NOW)).toBeNull()
  })

  it("matn", () => {
    expect(companionStatusLabel(inside, NOW)).toBe("Ichkarida")
    expect(companionStatusLabel(left, NOW)).toMatch(/^Ketdi · /)
    expect(companionStatusLabel(returned, NOW)).toMatch(/^Qaytdi · /)
    expect(companionStatusLabel(added, NOW)).toMatch(/^Qo'shildi · /)
  })
})
