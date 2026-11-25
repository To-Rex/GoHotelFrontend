/* So'rovlar jurnali — o'zbek naqshi va koshinkori ranglari.

   Ranglar Samarqand-Buxoro koshinlaridan: feruza (firuza), lojuvard
   (lazurit), tilla (oltin), anor. Holat sinflari shu tartibda bo'yaladi va
   to'q panel sirtida (#0f1216) dataviz validatoridan o'tgan: yorug'lik
   oralig'i, to'yinganlik, rang ko'rmaslikda qo'shni juftlar ajralishi,
   oddiy ko'zga ajralishi, sirtga nisbatan kontrast — hammasi PASS.
   Rang hech qachon yolg'iz kelmaydi: yonida kod yozuvi va yulduz belgisi. */

import type { StatusClass } from "./apiLogFilters"

export const UZ = {
  feruza: "#1fa694",
  lojuvard: "#6a86ea",
  tilla: "#bf8a24",
  anor: "#d63f6b",
  /** Oqish fil suyagi — sarlavha va asosiy raqamlar uchun */
  ivory: "#f1e9d8",
  /** Panel sirti */
  surface: "#0f1216",
} as const

export const CLASS_COLOR: Record<StatusClass, string> = {
  "2xx": UZ.feruza,
  "3xx": UZ.lojuvard,
  "4xx": UZ.tilla,
  "5xx": UZ.anor,
}

/** Kod rangi — sinfiga qarab (noma'lum sinf — kulrang). */
export const statusColor = (code: number): string =>
  CLASS_COLOR[`${Math.floor(code / 100)}xx` as StatusClass] ?? "#8a93a3"

export const METHOD_COLOR: Record<string, string> = {
  GET: UZ.lojuvard,
  POST: UZ.feruza,
  PUT: UZ.tilla,
  PATCH: UZ.tilla,
  DELETE: UZ.anor,
}

/** Davomiylik rangi: tez — feruza, sekinlashgan — tilla, juda sekin — anor. */
export const durationColor = (ms: number): string =>
  ms >= 1000 ? UZ.anor : ms >= 300 ? UZ.tilla : UZ.feruza

/** Sakkiz qirrali yulduz (girih, ikki kvadrat ustma-ust — {8/2}) uchlari.
 *  Ichki radius ikki kvadrat tomonlari kesishgan nuqtaga to'g'ri keladi,
 *  shuning uchun shakl "chizilgan" emas, aynan koshindagidek chiqadi. */
export function octagramPoints(cx: number, cy: number, r: number, rotate = 0): string {
  const inner = (r * Math.cos(Math.PI / 4)) / Math.cos(Math.PI / 8)
  const pts: string[] = []
  for (let i = 0; i < 16; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 8 + (rotate * Math.PI) / 180
    const rad = i % 2 === 0 ? r : inner
    pts.push(`${round(cx + rad * Math.cos(a))},${round(cy + rad * Math.sin(a))}`)
  }
  return pts.join(" ")
}

/** Romb (kichik naqsh unsuri). */
export const rhombusPoints = (cx: number, cy: number, rx: number, ry = rx): string =>
  [`${cx},${cy - ry}`, `${cx + rx},${cy}`, `${cx},${cy + ry}`, `${cx - rx},${cy}`].join(" ")

const round = (v: number) => Math.round(v * 100) / 100
