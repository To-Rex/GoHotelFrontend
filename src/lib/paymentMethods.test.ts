import { describe, it, expect } from "vitest"
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  canonicalMethod,
  paymentMethodLabel,
} from "./paymentMethods"

/* To'lov usullari.

   Xodim to'rtta usuldan birini tanlaydi. Bazada esa eski kodlar ham bor —
   ular ilgari tanlanardi va yo'qolib ketmasligi kerak. */

describe("PAYMENT_METHODS", () => {
  it("aynan to'rtta usul", () => {
    expect(PAYMENT_METHODS.map((m) => m.value)).toEqual([
      "CASH",
      "CARD",
      "ONLINE",
      "BANK_TRANSFER",
    ])
  })

  it("har birining nomi bor", () => {
    for (const m of PAYMENT_METHODS) {
      expect(PAYMENT_METHOD_LABELS[m.value]).toBe(m.label)
    }
  })
})

describe("canonicalMethod", () => {
  it("kanonik kodlar o'zgarmaydi", () => {
    for (const m of PAYMENT_METHODS) {
      expect(canonicalMethod(m.value)).toBe(m.value)
    }
  })

  it("eski kodlar o'z usuliga yig'iladi", () => {
    // Bazada shu kodlar bor — ular hisobotdan tushib qolmasligi kerak
    expect(canonicalMethod("CREDIT_CARD")).toBe("CARD")
    expect(canonicalMethod("DEBIT_CARD")).toBe("CARD")
    expect(canonicalMethod("MOBILE_PAYMENT")).toBe("ONLINE")
    expect(canonicalMethod("TRANSFER")).toBe("BANK_TRANSFER")
  })

  it("notanish va bo'sh kod yo'qolmaydi", () => {
    expect(canonicalMethod(null)).toBe("OTHER")
    expect(canonicalMethod("")).toBe("OTHER")
    expect(canonicalMethod("BITCOIN")).toBe("OTHER")
  })

  it("katta-kichik harf va bo'shliq muhim emas", () => {
    expect(canonicalMethod(" cash ")).toBe("CASH")
    expect(canonicalMethod("credit_card")).toBe("CARD")
  })
})

describe("paymentMethodLabel", () => {
  it("eski kod ham o'qiladigan nom bilan chiqadi", () => {
    expect(paymentMethodLabel("MOBILE_PAYMENT")).toBe("Online to'lov")
    expect(paymentMethodLabel("CREDIT_CARD")).toBe("Bank kartasi")
  })

  it("notanish kod o'z holicha ko'rinadi — jimgina yo'qolmaydi", () => {
    expect(paymentMethodLabel("BITCOIN")).toBe("BITCOIN")
  })

  it("bo'sh qiymat chiziqcha", () => {
    expect(paymentMethodLabel(null)).toBe("—")
  })
})
