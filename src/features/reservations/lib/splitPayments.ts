/**
 * Bo'lib to'lash: birinchi qator qolgan summani ko'rsatadi.
 *
 * Xodim odatda jami summani birinchi qatorga yozadi ("500 000, naqd"), so'ng
 * mijoz "200 000 ini karta bilan" deydi. Ilgari ikkinchi qatorga 200 000
 * yozilsa jami 700 000 bo'lib ketardi va xodim birinchi qatorni QO'LDA
 * kamaytirishi kerak edi — bu esa unutiladi va bron ortiqcha to'langan
 * bo'lib qolardi.
 *
 * Shuning uchun JAMI summa alohida saqlanadi, birinchi qator esa undan
 * qo'shimcha qatorlar ayirilgani — ya'ni "qolgani" — bo'lib hisoblanadi.
 *
 * Nega ayirma bilan emas, jami bilan: birinchi qator NOLGA tushib qolishi
 * mumkin (qo'shimcha qatorga undan kattaroq summa kiritilsa). O'shanda
 * ayirmaga tayangan hisob orqaga qaytmasdi — qator o'chirilganda birinchi
 * qator eski holatiga emas, noto'g'ri songa aylanardi. Jami saqlansa, u
 * har doim tiklanadi.
 */

/** Maydondagi matnni songa o'giradi. Bo'sh yoki buzuq qiymat — 0. */
export function parseAmount(value: string | number | null | undefined): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Qo'shimcha qatorlardagi summalar yig'indisi. */
export function extrasTotal(
  extras: ReadonlyArray<{ amount: string }>
): number {
  return extras.reduce((sum, p) => sum + parseAmount(p.amount), 0)
}

/**
 * Birinchi qatorda ko'rsatiladigan summa.
 *
 * Manfiy chiqmaydi: qo'shimcha qatorlar jamidan oshib ketsa birinchisi
 * nolga tushadi va jami narxdan oshadi — buni oyna allaqachon "narxdan
 * oshiq!" deb ogohlantiradi. Xodimning kiritganini o'zgartirib
 * yubormaymiz. Jami summaning o'zi saqlanib qolgani uchun qator
 * kamaytirilsa yoki o'chirilsa birinchisi to'liq tiklanadi.
 */
export function remainderForFirst(
  intendedTotal: number,
  extras: ReadonlyArray<{ amount: string }>
): number {
  return Math.max(intendedTotal - extrasTotal(extras), 0)
}
