import { tr } from "@/i18n"
import { canonicalMethod, paymentMethodLabel } from "@/lib/paymentMethods"
import type { ShiftMethodRow } from "../api/shifts"

/* Smena to'lov usullari yig'indisi.

   Naqdsiz pul kassaga kirmaydi va smenadan smenaga o'tmaydi — u sessiya
   ko'rsatkichi, shuning uchun har yangi smenada tabiiy 0 dan boshlanadi.
   Shu sababli UCHALA asosiy naqdsiz usul HAR DOIM qaytadi (0 bo'lsa ham):
   ekranda "yangi smena 0 dan boshlanganini" bir qarashda ko'rish muhim.
   Boshqa (notanish) kodlar FAQAT mavjud bo'lsa qo'shiladi — aks holda
   doimiy "Boshqa usul 0" qatori faqat shovqin bo'lardi. */

export type NonCashKey = "CARD" | "ONLINE" | "BANK_TRANSFER" | "OTHER"

export interface NonCashBucket {
  key: NonCashKey
  label: string
  amount: number
}

const MAIN_ORDER: NonCashKey[] = ["CARD", "ONLINE", "BANK_TRANSFER"]

export const nonCashBuckets = (rows?: ShiftMethodRow[] | null): NonCashBucket[] => {
  const sums: Record<NonCashKey, number> = { CARD: 0, ONLINE: 0, BANK_TRANSFER: 0, OTHER: 0 }
  for (const row of rows || []) {
    const canonical = canonicalMethod(row.method)
    // Naqd kassa tarkibida alohida ko'rsatiladi — bu yerda takrorlanmaydi
    if (canonical === "CASH") continue
    sums[canonical] += Number(row.payments || 0) + Number(row.shop || 0)
  }
  const buckets = MAIN_ORDER.map((key) => ({
    key,
    label: paymentMethodLabel(key),
    amount: sums[key],
  }))
  if (sums.OTHER > 0) {
    buckets.push({ key: "OTHER", label: tr("Boshqa usul"), amount: sums.OTHER })
  }
  return buckets
}

/** Naqdsiz turlarda biror summa bormi (tarix sahifasida blokni yashirish
 *  uchun — 0 larni u yerda ko'rsatish shart emas). */
export const hasNonCashIncome = (rows?: ShiftMethodRow[] | null): boolean =>
  nonCashBuckets(rows).some((b) => b.amount > 0)
