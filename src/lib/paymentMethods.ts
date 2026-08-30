/* To'lov usullari — YAGONA ro'yxat.

   Xodim to'rtta usuldan birini tanlaydi. Ro'yxat shu yerda bitta bo'lgani
   uchun bron oynasi, do'kon, xarajatlar va hisobotlar bir-biridan chetga
   chiqib ketmaydi.

   Bazada eski kodlar ham bor (CREDIT_CARD, DEBIT_CARD, MOBILE_PAYMENT,
   TRANSFER) — ular ilgari tanlanardi. Eski yozuvlar yo'qolmasligi kerak,
   shuning uchun ular quyida kanonik usulga yig'iladi va hisobotlarda o'z
   o'rnida ko'rinadi. */

export const PAYMENT_METHODS = [
  { value: "CASH", label: "Naqd pul" },
  { value: "CARD", label: "Bank kartasi" },
  { value: "ONLINE", label: "Online to'lov" },
  { value: "BANK_TRANSFER", label: "Bank o'tkazmasi" },
] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"]

/** Kod -> nom. Eski kodlar ham bor: tarix o'qilishi kerak. */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Naqd pul",
  CARD: "Bank kartasi",
  ONLINE: "Online to'lov",
  BANK_TRANSFER: "Bank o'tkazmasi",
  // Eski kodlar — endi tanlanmaydi, lekin bazadagi yozuvlarda uchraydi
  CREDIT_CARD: "Bank kartasi",
  DEBIT_CARD: "Bank kartasi",
  MOBILE_PAYMENT: "Online to'lov",
  TRANSFER: "Bank o'tkazmasi",
  MIXED: "Aralash",
}

/** Eski kodni kanonik usulga keltirish (hisobot ustunlari uchun). */
export const canonicalMethod = (method?: string | null): PaymentMethod | "OTHER" => {
  const key = String(method || "").trim().toUpperCase()
  switch (key) {
    case "CASH":
      return "CASH"
    case "CARD":
    case "CREDIT_CARD":
    case "DEBIT_CARD":
      return "CARD"
    case "ONLINE":
    case "MOBILE_PAYMENT":
      return "ONLINE"
    case "BANK_TRANSFER":
    case "TRANSFER":
      return "BANK_TRANSFER"
    default:
      return "OTHER"
  }
}

/** Ko'rsatish uchun nom (notanish kod o'z holicha chiqadi — yo'qolmaydi). */
export const paymentMethodLabel = (method?: string | null): string => {
  if (!method) return "—"
  return PAYMENT_METHOD_LABELS[String(method).toUpperCase()] || String(method)
}
