import { describe, expect, it } from "vitest"
import { METHOD_LABEL, paymentMethodsLabel } from "./myReport"

/* "Bronlarim"dagi "To'lov turi" ustuni matni. Qidiruv va saralash ham
   shu matn bo'yicha ishlaydi — u barqaror va o'qiladigan bo'lishi kerak. */
describe("paymentMethodsLabel", () => {
  it("to'lov yo'q — null (ustunda «—»)", () => {
    expect(paymentMethodsLabel({ payment_methods: [] })).toBeNull()
  })

  it("eski backend maydonni bermasa ham buzilmaydi", () => {
    expect(paymentMethodsLabel({})).toBeNull()
    expect(paymentMethodsLabel({ payment_methods: undefined })).toBeNull()
  })

  it("bitta usul — to'lov oynasidagi nomi", () => {
    expect(
      paymentMethodsLabel({ payment_methods: [{ method: "cash", amount: 250000 }] })
    ).toBe("Naqd pul")
  })

  it("bo'lib to'langan — usullar server tartibida (summasi kattasi birinchi)", () => {
    expect(
      paymentMethodsLabel({
        payment_methods: [
          { method: "cash", amount: 150000 },
          { method: "card", amount: 100000 },
        ],
      })
    ).toBe("Naqd pul · Bank kartasi")
  })

  it("noma'lum kod yo'qolmaydi — o'zi ko'rsatiladi", () => {
    expect(
      paymentMethodsLabel({
        payment_methods: [{ method: "crypto" as never, amount: 1 }],
      })
    ).toBe("crypto")
  })

  it("nomlar hisobot ustunlari bilan bir xil", () => {
    expect(METHOD_LABEL.cash).toBe("Naqd pul")
    expect(METHOD_LABEL.card).toBe("Bank kartasi")
    expect(METHOD_LABEL.online).toBe("Online to'lov")
    expect(METHOD_LABEL.bank_transfer).toBe("Bank o'tkazmasi")
    expect(METHOD_LABEL.other).toBe("Boshqa")
  })
})
