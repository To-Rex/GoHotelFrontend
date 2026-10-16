/* Qarz toast eslatmasi "darvozasi".

   Bron oynasida jarima yozilishi bilan bron qarzdor bo'lib qoladi va
   navbar'dagi eslatma darhol chiqib ketardi. Aslida toast FAQAT bron
   oynasi to'lov qabul qilmasdan yopilganda ko'rinishi kerak:

   * oyna ochilganda `holdDebtToast(id)` — o'sha bron haqida toast
     to'xtatiladi (yozuv qarzlar ro'yxatida baribir ko'rinadi);
   * oyna yopilganda `releaseDebtToast(id, paid)`:
       - `paid = true` (oynada to'lov qabul qilindi) — toast chiqmaydi;
       - `paid = false` — id "kutilayotgan" ro'yxatga tushadi va
         DebtsMenu hali ham qarzdor bo'lsa darhol ko'rsatadi.

   Modul darajasidagi sof holat — server holatiga tegmaydi, faqat UI. */

const held = new Set<string>()
let pending: Set<string> = new Set()
const listeners = new Set<() => void>()

/** Bron oynasi ochildi — shu bron haqida toast to'xtatiladi. */
export const holdDebtToast = (id: string | null | undefined): void => {
  if (id) held.add(id)
}

/** Oyna yopildi. `paid` — oyna ichida to'lov qabul qilinganmi. */
export const releaseDebtToast = (id: string | null | undefined, paid: boolean): void => {
  if (!id) return
  held.delete(id)
  if (!paid) pending.add(id)
  listeners.forEach((listener) => listener())
}

export const isDebtToastHeld = (id: string): boolean => held.has(id)

/** Kutilayotgan id larni bir marta o'qib, ro'yxatni bo'shatadi. */
export const takePendingDebtToasts = (): Set<string> => {
  const current = pending
  pending = new Set()
  return current
}

/** Darvoza holati o'zgargani (release) — DebtsMenu qayta baholashi uchun. */
export const onDebtToastGateChange = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
