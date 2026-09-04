import type { DocumentScan } from "../api/scans"

/**
 * Qaysi skan bandlov oynasini O'ZI ochishi kerak.
 *
 * Uch shart bir vaqtda bajarilishi kerak, va uchalasi ham amaliy
 * muammodan kelib chiqqan:
 *
 * 1. **Yopilmagan** — ko'rib chiqilgan yozuv qayta ochilmaydi.
 * 2. **Shu sessiyada ochilmagan** — server javobi kechikib, ro'yxat
 *    o'sha yozuv bilan yana kelishi mumkin; oyna ikki marta ochilmasin.
 * 3. **Kuzatuv boshlangandan keyin kelgan** — sahifa yangilanganda bir
 *    soat oldingi skan ekranga otilib chiqsa, xodim nima bo'layotganini
 *    tushunmasdi. Eskilari menyuda turaveradi.
 */
export function pickAutoOpen(
  scans: DocumentScan[],
  options: { since: number; opened: ReadonlySet<string> }
): DocumentScan | null {
  const fresh = scans.filter(
    (scan) =>
      !scan.acknowledged &&
      !options.opened.has(scan.id) &&
      !!scan.created_at &&
      new Date(scan.created_at).getTime() >= options.since
  )
  if (fresh.length === 0) return null
  // Bir vaqtda bir nechta kelsa — eng yangisi. Server ham shu tartibda
  // qaytaradi, lekin bu yerda tayanmaymiz: tartib API shartnomasi emas.
  return fresh.reduce((newest, scan) =>
    new Date(scan.created_at!).getTime() > new Date(newest.created_at!).getTime()
      ? scan
      : newest
  )
}
