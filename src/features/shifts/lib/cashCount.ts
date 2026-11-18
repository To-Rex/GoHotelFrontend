/* Kassani sanash dialogi — summa maydoni va farq hisobi (sof funksiyalar).

   Xodim pulni sanab kiritadi; kiritgani kutilgan summadan farq qilsa, farq
   uning hisobiga yoziladi. Shuning uchun maydon o'qilishi oson bo'lishi
   ("2550000" emas, "2 550 000") va farq TASDIQLASHDAN OLDIN ko'rinishi kerak. */

/** Maydonga sig'adigan eng uzun summa (raqamlar soni) — trillionlargacha.
 *  Undan uzuni `Number` aniqligidan chiqib ketardi. */
const MAX_DIGITS = 13

const digitsOf = (raw: string): string =>
  String(raw ?? "")
    .replace(/\D/g, "")
    .slice(0, MAX_DIGITS)

/** Brauzer tilidagi minglik ajratgich ("2,550,000" yoki "2 550 000").
 *  Maydondagi summa sahifadagi boshqa summalar (`toLocaleString`) bilan bir
 *  xil ko'rinishi uchun: yonma-yon turgan ikki raqam ikki xil yozilmasin.
 *  Har qanday bo'shliq (uzilmas, tor) oddiy bo'shliqqa keltiriladi. */
export const groupSeparator = (sample: string = (11111).toLocaleString()): string => {
  const separator = sample.replace(/\d/g, "")
  if (!separator || /^\s/.test(separator)) return " "
  return separator[0]
}

/** Kiritilayotgan summa: faqat raqamlar, minglik ajratgich bilan
 *  ("2550000" → "2 550 000"). Bosh nollar olib tashlanadi, lekin yolg'iz
 *  "0" saqlanadi — bo'sh kassa ham haqiqiy javob. */
export const formatCountInput = (raw: string, separator = " "): string => {
  const digits = digitsOf(raw).replace(/^0+(?=\d)/, "")
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator)
}

/** Maydondagi son; bo'sh (raqamsiz) maydon — `null`. `0` — haqiqiy qiymat. */
export const parseCountInput = (raw: string): number | null => {
  const digits = digitsOf(raw)
  return digits ? Number(digits) : null
}

/** Satrda `index` gacha nechta raqam borligi (kursor o'rnini saqlash uchun). */
export const digitsBefore = (text: string, index: number): number =>
  text.slice(0, Math.max(0, index)).replace(/\D/g, "").length

/** Formatlangan satrda kursor o'rni: undan oldin `count` ta raqam bo'ladi.
 *  Formatlash bo'shliq qo'shadi/oladi — kursor esa xodim yozayotgan raqam
 *  yonida qolishi kerak, aks holda o'rtadagi raqamni tuzatib bo'lmaydi. */
export const caretForDigits = (formatted: string, count: number): number => {
  if (count <= 0) return 0
  let seen = 0
  for (let i = 0; i < formatted.length; i++) {
    if (formatted[i] >= "0" && formatted[i] <= "9" && ++seen === count) return i + 1
  }
  return formatted.length
}

/** Sanalgan summaning kutilganiga nisbati.
 *  - `empty` — hali kiritilmagan
 *  - `match` — mos (1 so'mdan kichik farq — tiyinlar — hisobga olinmaydi)
 *  - `short` — kam (kamomad)
 *  - `over`  — ko'p (ortiqcha) */
export type CountState = "empty" | "match" | "short" | "over"

export interface CountCheck {
  state: CountState
  /** Farqning mutlaq qiymati (so'm) */
  diff: number
}

export const checkCount = (expected: number, counted: number | null): CountCheck => {
  if (counted === null) return { state: "empty", diff: 0 }
  const diff = counted - Number(expected || 0)
  if (Math.abs(diff) < 1) return { state: "match", diff: 0 }
  return { state: diff < 0 ? "short" : "over", diff: Math.abs(diff) }
}

/** Kassa tarkibining bir qatori. */
export interface BreakdownRow {
  key: "opening" | "payments" | "shop" | "expenses" | "carried"
  /** Musbat son; belgisi — `sign` */
  amount: number
  /** `0` — boshlang'ich summa (belgisiz), `1` — qo'shiladi, `-1` — ayiriladi */
  sign: 0 | 1 | -1
}

export interface BreakdownSource {
  opening_cash?: number | null
  payments_cash?: number | null
  shop_cash?: number | null
  expenses_cash?: number | null
}

/** Summa qanday yig'ilgani — faqat noldan farqli qatorlar (bo'sh qatorlar
 *  shovqin). `carried` — kesimdan keyingi xarajatga ketgan, topshirilmaydigan
 *  qism. Qatorlar yig'indisi topshiriladigan summaga teng. */
export const breakdownRows = (
  source: BreakdownSource | null | undefined,
  carried = 0
): BreakdownRow[] => {
  if (!source) return []
  const rows: BreakdownRow[] = [
    { key: "opening", amount: Number(source.opening_cash || 0), sign: 0 },
    { key: "payments", amount: Number(source.payments_cash || 0), sign: 1 },
    { key: "shop", amount: Number(source.shop_cash || 0), sign: 1 },
    { key: "expenses", amount: Number(source.expenses_cash || 0), sign: -1 },
    { key: "carried", amount: Number(carried || 0), sign: -1 },
  ]
  return rows.filter((row) => Math.abs(row.amount) >= 1)
}
