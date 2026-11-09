import { describe, expect, it } from "vitest"

import type { PaymentMethodChange, PaymentRecord } from "@/types/api"
import {
  editBadgeText,
  editDetail,
  editExtra,
  editMeta,
  editMoment,
  editsTitle,
  isEditedPayment,
  parseSplitNote,
  paymentEdits,
  shortMethod,
} from "./paymentEdits"

const AT = "2026-11-05T09:00:00+00:00"

const change = (over: Partial<PaymentMethodChange>): PaymentMethodChange => ({
  old: "CASH",
  new: "ONLINE",
  by: "u1",
  by_name: "Aziz Karimov",
  at: AT,
  note: null,
  ...over,
})

const pay = (over: Partial<PaymentRecord>): Pick<PaymentRecord, "amount" | "method_changes" | "notes"> => ({
  amount: 50000,
  method_changes: null,
  notes: null,
  ...over,
})

describe("paymentEdits — necha puldan necha pulga", () => {
  it("tahrirlanmagan to'lov — bo'sh", () => {
    expect(paymentEdits(pay({}))).toEqual([])
    expect(isEditedPayment(pay({}))).toBe(false)
    expect(paymentEdits(pay({ method_changes: [] }))).toEqual([])
  })

  it("qisman tahrir: 100 000 naqd → 50 000 naqd + 50 000 online (yangi server)", () => {
    const [edit] = paymentEdits(
      pay({
        amount: 50000,
        method_changes: [
          change({
            kind: "partial",
            amount: 50000,
            new_payment_number: "PAY-B",
            total_before: 100000,
            total_after: 50000,
            note: " Yarmi online ",
          }),
        ],
      })
    )
    expect(edit).toEqual({
      kind: "partial",
      at: AT,
      byName: "Aziz Karimov",
      byRole: null,
      note: "Yarmi online",
      oldMethod: "CASH",
      newMethod: "ONLINE",
      moved: 50000,
      before: 100000,
      after: 50000,
      otherNumber: "PAY-B",
    })
    expect(editBadgeText(edit)).toBe("100,000 → 50,000")
    expect(editDetail(edit)).toBe("100,000 So'm Naqd pul → 50,000 So'm Naqd pul + 50,000 So'm Online to'lov")
    expect(editExtra(edit)).toBe("Ajralgan qism — PAY-B to'lovi")
  })

  it("eski yozuv (summalar yo'q) — hozirgi summadan orqaga hisoblanadi", () => {
    // 100 000 → (−30 000) 70 000 → (−20 000) 50 000
    const edits = paymentEdits(
      pay({
        amount: 50000,
        method_changes: [
          change({ kind: "partial", amount: 30000, new_payment_number: "PAY-B" }),
          change({ kind: "partial", amount: 20000, new: "CARD", new_payment_number: "PAY-C" }),
        ],
      })
    )
    expect(edits.map((e) => [e.before, e.after, e.moved])).toEqual([
      [100000, 70000, 30000],
      [70000, 50000, 20000],
    ])
    expect(edits.map(editBadgeText)).toEqual(["100,000 → 70,000", "70,000 → 50,000"])
  })

  it("butun tahrir: summa o'zgarmaydi, tur almashadi", () => {
    const [edit] = paymentEdits(
      pay({ amount: 250000, method_changes: [change({ kind: "full", amount: null, new: "CARD" })] })
    )
    expect(edit.kind).toBe("full")
    expect([edit.before, edit.after, edit.moved]).toEqual([250000, 250000, 250000])
    expect(editBadgeText(edit)).toBe("Naqd → Karta")
    expect(editDetail(edit)).toBe("250,000 So'm: Naqd pul → Bank kartasi")
    expect(editExtra(edit)).toBe("")
  })

  it("`kind` yo'q (eng eski yozuvlar) — butun tahrir", () => {
    const [edit] = paymentEdits(pay({ amount: 80000, method_changes: [change({ new: "CARD" })] }))
    expect(edit.kind).toBe("full")
    expect(edit.after).toBe(80000)
  })

  it("butun tahrirdan keyin qisman: summalar zanjiri to'g'ri", () => {
    const edits = paymentEdits(
      pay({
        amount: 60000,
        method_changes: [
          change({ kind: "full", new: "CARD" }),
          change({ kind: "partial", old: "CARD", new: "ONLINE", amount: 40000, new_payment_number: "PAY-B" }),
        ],
      })
    )
    expect(edits.map((e) => [e.kind, e.before, e.after])).toEqual([
      ["full", 100000, 100000],
      ["partial", 100000, 60000],
    ])
  })

  it("serverdagi aniq summalar hisoblab olinganidan ustun", () => {
    const [edit] = paymentEdits(
      pay({
        amount: 1,
        method_changes: [change({ kind: "partial", amount: 30000, total_before: 100000, total_after: 70000 })],
      })
    )
    expect([edit.before, edit.after]).toEqual([100000, 70000])
  })

  it("buzuq yozuvlar o'tkazib yuboriladi, yiqilmaydi", () => {
    const edits = paymentEdits(
      pay({
        amount: 50000,
        method_changes: [null, "x", change({ kind: "partial", amount: 50000 })] as unknown as PaymentMethodChange[],
      })
    )
    expect(edits).toHaveLength(1)
    expect(paymentEdits(pay({ method_changes: {} as unknown as PaymentMethodChange[] }))).toEqual([])
  })
})

describe("ajralgan qator (split_from)", () => {
  it("qaysi to'lovdan, qancha va nimadan nimaga ajralgani", () => {
    const [edit] = paymentEdits(
      pay({
        amount: 50000,
        method_changes: [
          change({ kind: "split_from", amount: 50000, from_payment_number: "PAY-A", from_total: 100000 }),
        ],
      })
    )
    expect(edit.kind).toBe("split_from")
    expect([edit.before, edit.after, edit.moved]).toEqual([100000, 50000, 50000])
    expect(edit.otherNumber).toBe("PAY-A")
    expect(editBadgeText(edit)).toBe("Naqd → Online")
    expect(editDetail(edit)).toBe("PAY-A to'lovidan ajratildi: 50,000 So'm, Naqd pul → Online to'lov")
    expect(editExtra(edit)).toBe("Asl to'lov 100,000 So'm edi")
  })

  it("asl summa noma'lum (migratsiya yozgan eski qator) — qo'shimcha satr yo'q", () => {
    const [edit] = paymentEdits(
      pay({ method_changes: [change({ kind: "split_from", amount: 50000, from_payment_number: "PAY-A" })] })
    )
    expect(edit.before).toBeNull()
    expect(editExtra(edit)).toBe("")
  })

  it("ajralgan qator keyin o'zi tahrirlangan — tarix to'liq", () => {
    const edits = paymentEdits(
      pay({
        amount: 30000,
        method_changes: [
          change({ kind: "split_from", amount: 50000, from_payment_number: "PAY-A" }),
          change({ kind: "partial", old: "ONLINE", new: "CARD", amount: 20000, new_payment_number: "PAY-C" }),
        ],
      })
    )
    expect(edits.map((e) => e.kind)).toEqual(["split_from", "partial"])
    expect(edits[0].after).toBe(50000)
    expect([edits[1].before, edits[1].after]).toEqual([50000, 30000])
  })

  it("tarixsiz eski ajralgan qator — avtomatik izohdan tiklanadi", () => {
    const notes = "Qisman o'tkazildi: PAY-TST-20261103-AAAA dan 50000 So'm (CASH → ONLINE)"
    expect(parseSplitNote(notes)).toEqual({
      number: "PAY-TST-20261103-AAAA",
      amount: 50000,
      old: "CASH",
      new: "ONLINE",
    })
    const [edit] = paymentEdits(pay({ notes }))
    expect(edit.kind).toBe("split_from")
    expect(edit.otherNumber).toBe("PAY-TST-20261103-AAAA")
    expect(edit.at).toBeNull()
    expect(editMeta(edit)).toBe("")
    expect(isEditedPayment(pay({ notes }))).toBe(true)
  })

  it("tarixda kelib chiqishi bor bo'lsa izohdan ikkinchi marta qo'shilmaydi", () => {
    const edits = paymentEdits(
      pay({
        notes: "Qisman o'tkazildi: PAY-A dan 50000 So'm (CASH → ONLINE)",
        method_changes: [change({ kind: "split_from", amount: 50000, from_payment_number: "PAY-A" })],
      })
    )
    expect(edits).toHaveLength(1)
  })

  it("oddiy izoh ajralgan qator deb olinmaydi", () => {
    expect(parseSplitNote("Mehmon kechikdi")).toBeNull()
    expect(parseSplitNote(null)).toBeNull()
    expect(paymentEdits(pay({ notes: "Qisman o'tkazildi" }))).toEqual([])
  })
})

describe("matnlar", () => {
  it("qisqa usul nomlari — eski kodlar ham", () => {
    expect(shortMethod("CASH")).toBe("Naqd")
    expect(shortMethod("credit_card")).toBe("Karta")
    expect(shortMethod("MOBILE_PAYMENT")).toBe("Online")
    expect(shortMethod("TRANSFER")).toBe("O'tkazma")
    expect(shortMethod("CRYPTO")).toBe("CRYPTO")
    expect(shortMethod(null)).toBe("—")
  })

  it("kim · qachon · izoh; vaqt jadvaldagi kabi mahalliy", () => {
    const local = new Date(2026, 10, 5, 14, 20).toISOString()
    const [edit] = paymentEdits(
      pay({ method_changes: [change({ kind: "full", at: local, note: "Xato bosilgan" })] })
    )
    expect(editMoment(edit)).toBe("05.11.2026 14:20")
    expect(editMeta(edit)).toBe("Aziz Karimov · 05.11.2026 14:20 · Xato bosilgan")
    expect(editMoment({ at: "buzuq" })).toBe("")
  })

  it("belgi sarlavhasi: har tahrir alohida satrda", () => {
    const local = new Date(2026, 10, 5, 14, 20).toISOString()
    const edits = paymentEdits(
      pay({
        amount: 50000,
        method_changes: [
          change({ kind: "split_from", amount: 50000, from_payment_number: "PAY-A", at: local }),
          change({ kind: "full", old: "ONLINE", new: "CARD", at: local, by_name: null }),
        ],
      })
    )
    expect(editsTitle(edits)).toBe(
      "PAY-A to'lovidan ajratildi: 50,000 So'm, Naqd pul → Online to'lov — Aziz Karimov · 05.11.2026 14:20\n" +
        "50,000 So'm: Online to'lov → Bank kartasi — 05.11.2026 14:20"
    )
  })
})
