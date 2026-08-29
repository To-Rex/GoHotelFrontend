import { format, addDays, parseISO } from "date-fns"

/* Bron hisob-kitobining umumiy qoidalari.

   Bu yerda faqat sof funksiyalar turadi va ularni bron sahifasi ham, "Yangi
   bandlov" dialogi ham, xonalar sahifasi ham o'qiydi — ya'ni band vaqt qanday
   hisoblanishi butun ilovada BITTA joyda yozilgan. */

/** Soatlik bronlar orasidagi majburiy tanaffus (daqiqa) — mijoz chiqib
 *  ketgach xonani tayyorlash uchun. Backenddagi HOURLY_TURNOVER_MINUTES
 *  bilan bir xil bo'lishi kerak. */
export const HOURLY_TURNOVER_MIN = 15

/** Soatlik bron uchun tayyor davomiyliklar (1 dan 12 soatgacha) */
export const DURATION_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1)

/** Qisman (bo'lib) to'lov qatorlari uchun to'lov usullari */
export const PAYMENT_METHOD_OPTIONS = [
  { value: "CASH", label: "Naqd pul" },
  { value: "CREDIT_CARD", label: "Kredit karta" },
  { value: "DEBIT_CARD", label: "Debit karta" },
  { value: "BANK_TRANSFER", label: "Bank o'tkazmasi" },
  { value: "MOBILE_PAYMENT", label: "Mobil to'lov" },
  { value: "ONLINE", label: "Onlayn" },
] as const

/** Tugagan bronlar yangi bronga to'siq emas — mehmon erta chiqib ketgan
 *  bo'lsa xona darhol yana band qilinadi */
export const NON_BLOCKING_STATUSES = ["CANCELLED", "CHECKED_OUT", "NO_SHOW"]

/** Passport raqami: faqat lotin bosh harflari va raqamlar. */
export function sanitizePassport(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "")
}

export function addDaysStr(dateStr: string, amount: number) {
  const d = parseISO(dateStr)
  return format(addDays(d, amount), "yyyy-MM-dd")
}

export function dayDiff(startStr: string, endStr: string) {
  const start = parseISO(startStr)
  const end = parseISO(endStr)
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

export function todayStr(): string {
  return format(new Date(), "yyyy-MM-dd")
}

/** Backend xatosidan o'qiladigan matn (FastAPI 422 -> detail massiv bo'lishi mumkin). */
export function bookingErrorMessage(error: any): string {
  const detail = error?.response?.data?.detail
  if (typeof detail === "string") return detail
  if (Array.isArray(detail)) {
    return detail
      .map((d: any) => {
        const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : ""
        return field ? `${field}: ${d.msg}` : d.msg
      })
      .join("\n")
  }
  return "Xatolik yuz berdi. Iltimos qaytadan urinib ko'ring."
}

/** Vaqtni "HH:MM" ko'rinishiga normallash ("14:00:00" -> "14:00"). */
export function normalizeTime(t?: string): string {
  if (!t) return "00:00"
  const [h = "00", m = "00"] = t.split(":")
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`
}

/** Soatlik bron davomiyligi (soatlarda). Chiqish kirishdan kichik/teng
 *  bo'lsa keyingi kunga o'tadi (tunab qolish). */
export function hourlyDuration(inTime?: string, outTime?: string): number {
  if (!inTime || !outTime) return 0
  const [ih, im] = inTime.split(":").map(Number)
  const [oh, om] = outTime.split(":").map(Number)
  let mins = oh * 60 + om - (ih * 60 + im)
  if (mins <= 0) mins += 24 * 60
  return Math.max(1, Math.round((mins / 60) * 100) / 100)
}

/* Kalendarda bron egallagan kunlar uchun samarali sanalar. Soatlik bronda
   backend check_out_date ni majburan check_in + 1 kun qilib saqlaydi, shuning
   uchun kun oralig'i datetime maydonlaridan olinadi — aks holda 2 soatlik
   bron 2 kunni egallab ko'rinardi. */
export function resStartDate(r: any): string {
  if (r.booking_type === "HOURLY" && r.check_in_datetime) {
    return r.check_in_datetime.slice(0, 10)
  }
  return r.check_in_date
}

export function resEndDate(r: any): string {
  if (r.booking_type === "HOURLY" && r.check_out_datetime) {
    return r.check_out_datetime.slice(0, 10)
  }
  return r.check_out_date
}

/** Soatlik bron uchun "HH:MM - HH:MM" ko'rinishidagi vaqt. */
export function resTimeRange(r: any): string {
  if (r.booking_type !== "HOURLY" || !r.check_in_datetime || !r.check_out_datetime) return ""
  return `${r.check_in_datetime.slice(11, 16)} - ${r.check_out_datetime.slice(11, 16)}`
}

/** "HH:MM" -> kun boshidan o'tgan minutlar */
export function timeToMin(t: string): number {
  const [h = 0, m = 0] = t.split(":").map(Number)
  return h * 60 + m
}

export function minToTime(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/**
 * Berilgan xona va sana uchun band vaqt oraliqlari (minutlarda, boshlanish
 * bo'yicha saralangan). Tunab qoluvchi soatlik bronlar kun chegarasida
 * kesiladi. Har bir bron tugagach HOURLY_TURNOVER_MIN daqiqa tanaffus ham
 * "band" deb qo'shiladi — keyingi mijoz shu vaqtdan keyin kiradi.
 */
export function busyIntervalsFor(
  list: any[],
  roomId: string,
  dateStr: string
): Array<[number, number]> {
  const res: Array<[number, number]> = []
  for (const r of list) {
    if (
      r.room_id !== roomId ||
      NON_BLOCKING_STATUSES.includes(r.status) ||
      r.booking_type !== "HOURLY"
    )
      continue
    if (!r.check_in_datetime || !r.check_out_datetime) continue
    const ciDate = r.check_in_datetime.slice(0, 10)
    const coDate = r.check_out_datetime.slice(0, 10)
    const ciMin = timeToMin(r.check_in_datetime.slice(11, 16))
    const coMin = timeToMin(r.check_out_datetime.slice(11, 16))
    const coBuffered = Math.min(coMin + HOURLY_TURNOVER_MIN, 24 * 60)
    if (ciDate === dateStr && coDate === dateStr) res.push([ciMin, coBuffered])
    else if (ciDate === dateStr) res.push([ciMin, 24 * 60])
    else if (coDate === dateStr) res.push([0, coBuffered])
  }
  return res.sort((a, b) => a[0] - b[0])
}

/**
 * Birinchi bo'sh vaqt oralig'i: `preferStarts` dagi har bir boshlanishdan
 * izlanadi (odatda kunduzgi 08:00, so'ng kun boshi), davomiylik 2 → 1 → 0.5
 * soat tartibida sinaladi. Keyingi bron boshlanishidan oldin tanaffus ham
 * sig'ishi shart — ya'ni topilgan vaqt keyingi mijozning vaqtiga kirib
 * ketmaydi.
 */
export function findFreeSlot(
  busy: Array<[number, number]>,
  preferStarts: number[] = [8 * 60, 0]
): [number, number] | null {
  for (const preferStart of preferStarts) {
    for (const dur of [120, 60, 30]) {
      let cursor = preferStart
      let found: [number, number] | null = null
      for (const [bs, be] of busy) {
        if (bs - cursor >= dur + HOURLY_TURNOVER_MIN) {
          found = [cursor, cursor + dur]
          break
        }
        cursor = Math.max(cursor, be)
      }
      if (!found && 24 * 60 - cursor >= dur) found = [cursor, cursor + dur]
      if (found) return found
    }
  }
  return null
}

/* --------------------------------------------- xona bandligi (kunlik) -- */

/** Shu xonani berilgan kunda band qiladigan KUNLIK bron (bo'lmasa null). */
export function dailyBookingOn(list: any[], roomId: string, dateStr: string): any | null {
  for (const r of list) {
    if (r.room_id !== roomId || NON_BLOCKING_STATUSES.includes(r.status)) continue
    if (r.booking_type === "HOURLY") continue
    // Chiqish kuni band emas — o'sha kuni yangi mehmon kirishi mumkin
    if (resStartDate(r) <= dateStr && dateStr < resEndDate(r)) return r
  }
  return null
}

/**
 * Xona berilgan kundan boshlab qachon bo'shaydi.
 *
 * Kunlik bron bo'lsa uning chiqish kuni qaytadi; zanjir bo'lsa (bir mehmon
 * chiqqan kuni ikkinchisi kirsa) zanjirning oxirigacha suriladi.
 */
export function firstFreeDate(list: any[], roomId: string, fromDate: string): string {
  let cursor = fromDate
  // Zanjir uzunligi cheklangan — cheksiz aylanishdan himoya
  for (let i = 0; i < 400; i++) {
    const booking = dailyBookingOn(list, roomId, cursor)
    if (!booking) return cursor
    const next = resEndDate(booking)
    if (!next || next <= cursor) return addDaysStr(cursor, 1)
    cursor = next
  }
  return cursor
}

/**
 * Berilgan kirish sanasidan keyingi eng yaqin bron BOSHLANISHI.
 *
 * Yangi bronning chiqish sanasi shundan oshmasligi kerak — aks holda u
 * keyinroqqa bron qilgan boshqa mijozning vaqtiga kirib ketadi.
 * Hech narsa bo'lmasa null.
 */
export function nextBookingStart(
  list: any[],
  roomId: string,
  checkInDate: string
): string | null {
  let best: string | null = null
  for (const r of list) {
    if (r.room_id !== roomId || NON_BLOCKING_STATUSES.includes(r.status)) continue
    const start = resStartDate(r)
    // Kirish kunining o'zida boshlanadiganlar bu chegarani belgilamaydi —
    // ular kirish kunining bandligi sifatida alohida tekshiriladi
    if (!start || start <= checkInDate) continue
    if (best === null || start < best) best = start
  }
  return best
}

/**
 * Shu kunga KUNLIK bron qilib bo'ladimi.
 *
 * Kunlik bron butun kunni egallaydi, shuning uchun o'sha kundagi soatlik
 * bron ham to'siq bo'ladi — backend ham xuddi shunday hisoblaydi.
 */
export function dayIsBlocked(list: any[], roomId: string, dateStr: string): boolean {
  if (dailyBookingOn(list, roomId, dateStr)) return true
  return list.some(
    (r) =>
      r.room_id === roomId &&
      !NON_BLOCKING_STATUSES.includes(r.status) &&
      r.booking_type === "HOURLY" &&
      resStartDate(r) === dateStr
  )
}

/* ------------------------------------------------------- hamrohlar -- */

/** Xonaga kerakli hamrohlar soni (asosiy mehmondan tashqarisi). */
export const companionSlots = (adults: number): number =>
  Math.max(Math.floor(Number(adults) || 1) - 1, 0)

/**
 * Yana nechta mehmon kiritilishi kerak.
 *
 * Mehmonlar soni kamaytirilganda ortiqcha tanlovlar hisobga olinmaydi —
 * ular ro'yxatdan qirqiladi, shuning uchun natija hech qachon manfiy
 * bo'lmaydi.
 */
export const missingCompanions = (adults: number, chosen: number): number =>
  Math.max(companionSlots(adults) - Math.max(chosen, 0), 0)
