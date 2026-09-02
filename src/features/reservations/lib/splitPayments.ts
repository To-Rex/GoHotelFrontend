/**
 * Bo'lib to'lash: birinchi qator qolgan summani ko'rsatadi.
 *
 * Xodim odatda jami summani birinchi qatorga yozadi ("500 000, naqd"), so'ng
 * mijoz "200 000 ini karta bilan" deydi. Ilgari ikkinchi qatorga 200 000
 * yozilsa jami 700 000 bo'lib ketardi va xodim birinchi qatorni QO'LDA
 * kamaytirishi kerak edi — bu esa unutiladi va bron ortiqcha to'langan
 * bo'lib qolardi.
 *
 * Endi keyingi qatorlarga kiritilgan summa birinchisidan ayriladi, ya'ni
 * JAMI o'zgarmaydi. Birinchi qator "qolgani" bo'lib ishlaydi.
 */

/** Maydondagi matnni songa o'giradi. Bo'sh yoki buzuq qiymat — 0. */
export function parseAmount(value: string | number | null | undefined): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Qo'shimcha qatordagi o'zgarishdan keyin birinchi qatorning yangi summasi.
 *
 * Ayirma bo'yicha ishlaydi: qator 100 000 dan 150 000 ga o'zgarsa,
 * birinchisidan 50 000 ayriladi. Qator kamaysa — aksincha, qaytariladi.
 *
 * Manfiy chiqmaydi: birinchi qatorda yetarli pul bo'lmasa u nolga tushadi
 * va jami narxdan oshadi — buni oyna allaqachon "narxdan oshiq!" deb
 * ogohlantiradi. Xodimning kiritganini o'zgartirib yubormaymiz.
 */
export function rebalanceFirstAmount(
  currentFirst: number,
  previousExtra: number,
  nextExtra: number
): number {
  const delta = nextExtra - previousExtra
  return Math.max(currentFirst - delta, 0)
}

/**
 * Qator o'chirilganda birinchi qatorga qaytariladigan summa.
 *
 * Shu tufayli "jami o'zgarmaydi" qoidasi o'chirishda ham buzilmaydi: xodim
 * karta qatorini olib tashlasa, pul naqdga qaytadi va jami avvalgidek
 * qoladi. Aks holda u birinchi qatorni qo'lda tiklashi kerak bo'lardi.
 */
export function restoreFirstAmount(
  currentFirst: number,
  removedExtra: number
): number {
  return Math.max(currentFirst + removedExtra, 0)
}
