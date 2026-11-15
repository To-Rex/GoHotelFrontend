/* "Mening hisobotim": davrni SOAT bilan toraytirish.

   Sana oralig'i avvalgidek (Bugun, Kecha, 7 kun, ixtiyoriy), ustiga
   ixtiyoriy "dan / gacha" soat: masalan smena 08:00–20:00. Server
   `time_from` / `time_to` ni oladi va oynani shunday quradi: boshlanish
   kuni `time_from` dan, tugash kuni `time_to` GACHA (shu daqiqa kirmaydi)
   — ketma-ket smenalar bir-biriga tushmaydi.

   TUNGI SMENA: bitta kun tanlangan va "gacha" soati "dan"dan kichik yoki
   teng bo'lsa (20:00 → 08:00) — tugash ERTASI kunga o'tadi. Kecha tanlab
   20:00–08:00 qo'yilsa — kechagi tungi smena chiqadi. Ko'p kunli davrda
   soatlar shunchaki birinchi kun boshi va oxirgi kun oxirini belgilaydi.

   Toza funksiyalar, test qilinadi. */

export interface ReportHours {
  /** "HH:MM" yoki bo'sh (kun boshi) */
  from: string
  /** "HH:MM" yoki bo'sh (kun oxiri) */
  to: string
}

export const EMPTY_HOURS: ReportHours = { from: "", to: "" }

/** Tez tanlovlar — smena oynalari */
export const HOUR_PRESETS: ReadonlyArray<ReportHours> = [
  { from: "08:00", to: "20:00" },
  { from: "20:00", to: "08:00" },
  { from: "09:00", to: "18:00" },
]

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

export const isHHMM = (value: string | null | undefined): boolean => !!value && HHMM.test(value)

export const hasHours = (h: ReportHours): boolean => isHHMM(h.from) || isHHMM(h.to)

const addDays = (iso: string, days: number): string => {
  const [y, m, d] = iso.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

export interface ResolvedWindow {
  /** Serverga yuboriladigan sanalar (tungi smenada `dateTo` ertasi kun) */
  dateFrom: string
  dateTo: string
  timeFrom?: string
  timeTo?: string
  /** Tugash ertasi kunga o'tdimi (tungi smena) */
  overnight: boolean
  /** Boshlanish tugashdan keyin — so'rov yuborilmaydi */
  invalid: boolean
}

/** Sana oralig'i + soatlar → serverga ketadigan oyna. */
export function resolveReportWindow(dateFrom: string, dateTo: string, hours: ReportHours): ResolvedWindow {
  const timeFrom = isHHMM(hours.from) ? hours.from : undefined
  const timeTo = isHHMM(hours.to) ? hours.to : undefined
  if (!timeFrom && !timeTo) {
    return { dateFrom, dateTo, overnight: false, invalid: false }
  }
  let to = dateTo
  let overnight = false
  // Bitta kun, ikkala soat bor va "gacha" ≤ "dan" — tungi smena
  if (dateFrom && dateFrom === dateTo && timeFrom && timeTo && timeTo <= timeFrom) {
    to = addDays(dateTo, 1)
    overnight = true
  }
  const start = `${dateFrom}T${timeFrom ?? "00:00"}`
  const end = timeTo ? `${to}T${timeTo}` : `${to}T23:59:59`
  return {
    dateFrom,
    dateTo: to,
    timeFrom,
    timeTo,
    overnight,
    invalid: !!dateFrom && !!to && start >= end,
  }
}

/** Mahalliy (mehmonxona) vaqtidagi "YYYY-MM-DDTHH:MM" ni taqqoslash uchun
 *  kalitga aylantiradi — ISO vaqtdan (UTC) offset bilan */
export function hotelLocalKey(iso: string | null | undefined, offsetMinutes: number): string | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return new Date(t + offsetMinutes * 60_000).toISOString().slice(0, 16)
}

/** Yozuv paytini oyna ichidami (mijoz tomonidagi ro'yxatlar uchun —
 *  server bilan bir xil: boshlanish kiradi, tugash daqiqasi kirmaydi). */
export function inWindow(
  iso: string | null | undefined,
  w: ResolvedWindow,
  offsetMinutes: number
): boolean {
  if (!w.timeFrom && !w.timeTo) return true
  const key = hotelLocalKey(iso, offsetMinutes)
  if (!key) return false
  const start = `${w.dateFrom}T${w.timeFrom ?? "00:00"}`
  if (key < start) return false
  if (w.timeTo) return key < `${w.dateTo}T${w.timeTo}`
  return key.slice(0, 10) <= w.dateTo
}

/** "08:00–20:00", tungi bo'lsa "20:00 → ertasi 08:00" uchun qismlar */
export function hoursLabel(w: ResolvedWindow): string {
  const from = w.timeFrom ?? "00:00"
  const to = w.timeTo ?? "23:59"
  return `${from}–${to}`
}
