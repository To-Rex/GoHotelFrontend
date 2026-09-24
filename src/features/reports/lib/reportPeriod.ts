/* "Mening hisobotim"da davr tanlash kimga qanchalik ochiq.

   Qabulxona va boshqa xodimlar faqat o'z smenasini ko'radi — "Bugun" va
   "Kecha". Haftalik/oylik kesim va ixtiyoriy sana oralig'i — boshqaruv
   ko'rsatkichi, u administrator va menejerga tegishli. Cheklov shu
   sahifaga xos (mobil ilovadagi hisobot va API o'zgarmaydi). */

/** Cheklangan xodimga ochiq davr kalitlari — `buildDatePresets` kalitlari */
export const QUICK_PERIOD_KEYS: readonly string[] = ["today", "yesterday"]

/** Ko'rsatiladigan tugmalar: to'liq huquqda hammasi, aks holda faqat tezkorlar */
export function visiblePresets<T extends { key: string }>(
  presets: readonly T[],
  fullRangeAccess: boolean
): T[] {
  if (fullRangeAccess) return [...presets]
  return presets.filter((p) => QUICK_PERIOD_KEYS.includes(p.key))
}

/** Amaldagi tanlov.

    To'liq huquqda tanlov o'z holicha (null — qo'lda kiritilgan oraliq).
    Cheklangan xodimda ko'rinmaydigan kalit yoki qo'lda oraliq "Bugun"ga
    qaytariladi — holat ruxsat kelishidan oldin o'zgargan bo'lsa ham
    (masalan eski sessiya), so'rov hech qachon yopiq davrga ketmaydi. */
export function effectivePresetKey(
  presetKey: string | null,
  visible: readonly { key: string }[],
  fullRangeAccess: boolean
): string | null {
  if (fullRangeAccess) return presetKey
  if (presetKey && visible.some((p) => p.key === presetKey)) return presetKey
  return "today"
}
