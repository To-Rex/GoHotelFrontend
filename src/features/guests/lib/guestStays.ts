import type { GuestStay } from "../api/guestHistory"

/**
 * Turish tarixini sana bo'yicha tekshirish.
 *
 * "Bu mehmon falon kuni kelganmi?" — resepsiya eng ko'p so'raydigan savol.
 * Javob ko'ringanidan nozikroq:
 *
 *   - kunlik bronda mehmon KIRISH kunidan CHIQISH kunigacha turadi, lekin
 *     chiqish kunining o'zida u endi xonada emas: 1-dan 3-gacha bo'lgan
 *     bron 1 va 2 kunlarni qamraydi, 3-kuni mehmon ketgan;
 *
 *   - soatlik bronda chiqish sanasi kirish sanasi bilan bir xil bo'lishi
 *     mumkin, ya'ni yuqoridagi qoida bo'sh oraliq berib qo'yardi;
 *
 *   - bekor qilingan va kelmagan bronlarda mehmon umuman kelmagan, ular
 *     "turgan" deb sanalmasligi kerak.
 *
 * Shuning uchun mantiq shu yerda va test bilan qulflangan.
 */

/** Turish haqiqatan bo'lganmi — bekor qilingan va kelmaganlar hisobga olinmaydi. */
export function isRealStay(stay: GuestStay): boolean {
  return stay.status !== "CANCELLED" && stay.status !== "NO_SHOW"
}

const isHourly = (stay: GuestStay) =>
  (stay.booking_type || "").toUpperCase() === "HOURLY"

/**
 * Bron vaqtidan "yyyy-MM-dd".
 *
 * DIQQAT: `new Date()` ISHLATILMAYDI. `check_in_datetime` va
 * `check_out_datetime` maydonlariga foydalanuvchi kiritgan DEVOR SOATI
 * yoziladi; mintaqaga qayta hisoblansa kun siljib ketardi — 19:17 dagi
 * bron ertangi kunga o'tib qolardi. Loyihaning qolgan qismi
 * (`reservations/lib/booking.ts`) ham bu maydonlarni matn sifatida
 * o'qiydi.
 */
function isoLocalDate(value?: string | null): string | null {
  if (!value) return null
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(value))
  return m ? m[1] : null
}

/**
 * Turish qamrab olgan kunlar oralig'i (ikkala chegara ham kiradi).
 *
 * Kunlik bronda chiqish kuni KIRMAYDI — mehmon o'sha kuni ketadi.
 *
 * Soatlik bronda esa `check_out_date` ga ishonib bo'lmaydi: bazada
 * `check_out_date > check_in_date` cheklovi bor, shuning uchun bir kunlik
 * soatlik bron uchun server u yerga ertangi kunni yozib qo'yadi. Haqiqiy
 * kunlar aniq vaqtlardan olinadi — shunda tunni kesib o'tgan bron ikkala
 * kunni ham to'g'ri qamraydi.
 */
export function stayDayRange(stay: GuestStay): [string, string] | null {
  const fromDate = stay.check_in_date || ""
  if (isHourly(stay)) {
    const from = isoLocalDate(stay.check_in_datetime) || fromDate
    if (!from) return null
    const to = isoLocalDate(stay.check_out_datetime) || from
    return [from, to < from ? from : to]
  }

  if (!fromDate) return null
  const out = stay.check_out_date || fromDate
  if (out <= fromDate) return [fromDate, fromDate]
  // Chiqish kunidan bir kun oldingisi — oxirgi tunab qolgan kun
  return [fromDate, previousDay(out) || fromDate]
}

/**
 * "yyyy-MM-dd" dan bir kun oldingisi.
 *
 * Hisob UTC'da: mahalliy `new Date("...T00:00:00")` mintaqaga qarab bir
 * kun orqaga surilib, oxirgi kun noto'g'ri chiqishi mumkin edi.
 */
function previousDay(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  const t = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) - 1))
  if (Number.isNaN(t.getTime())) return null
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

/**
 * Mehmon shu KUNI xonada bo'lganmi.
 */
export function stayCoversDate(stay: GuestStay, day: string): boolean {
  if (!day || !isRealStay(stay)) return false
  const range = stayDayRange(stay)
  if (!range) return false
  return day >= range[0] && day <= range[1]
}

/**
 * Turish berilgan sana oralig'iga tegadimi.
 *
 * KESISHISH bo'yicha: davrdan oldin kelib, davr ichida ketgan mehmon ham
 * javobga kiradi. Boshlanish sanasiga qarasak u tushib qolardi.
 * Chegara bo'sh bo'lsa o'sha tomondan cheklov yo'q.
 */
export function stayOverlapsRange(
  stay: GuestStay,
  from: string,
  to: string
): boolean {
  if (!isRealStay(stay)) return false
  const start = stay.check_in_date || ""
  const end = stay.check_out_date || start
  if (from && end && end < from) return false
  if (to && start && start > to) return false
  return true
}

export interface StayDateFilter {
  /** "yyyy-MM-dd", bo'sh — chegarasiz */
  from: string
  to: string
}

export const EMPTY_STAY_FILTER: StayDateFilter = { from: "", to: "" }

export function hasStayFilter(f: StayDateFilter): boolean {
  return !!f.from || !!f.to
}

/** Bitta kun tanlanganmi — javobni aniq shakllantirish uchun. */
export function isSingleDay(f: StayDateFilter): string | null {
  if (f.from && f.to && f.from === f.to) return f.from
  if (f.from && !f.to) return f.from
  if (!f.from && f.to) return f.to
  return null
}

/**
 * Filtrlangan ro'yxat.
 *
 * Bekor qilingan turishlar filtr QO'YILMAGANDA ko'rinadi — tarix to'liq
 * bo'lishi kerak. Filtr qo'yilganda esa savol "shu kuni kelganmi", ya'ni
 * bo'lmagan turishlar javobga kirmaydi.
 */
export function filterStays(
  stays: readonly GuestStay[],
  f: StayDateFilter
): GuestStay[] {
  if (!hasStayFilter(f)) return [...stays]
  const day = isSingleDay(f)
  return stays.filter((s) =>
    day ? stayCoversDate(s, day) : stayOverlapsRange(s, f.from, f.to)
  )
}

export interface PresenceVerdict {
  /** Shu davrda mehmon turganmi */
  present: boolean
  /** Bitta kun tekshirilgan bo'lsa — o'sha kun */
  day: string | null
  /** Topilgan turishlar soni */
  count: number
  /** Bitta kunda turgan bo'lsa — xona raqami */
  room: string | null
}

export function presenceVerdict(
  stays: readonly GuestStay[],
  f: StayDateFilter
): PresenceVerdict {
  const found = filterStays(stays, f)
  const day = isSingleDay(f)
  return {
    present: found.length > 0,
    day,
    count: found.length,
    room: found.length > 0 ? found[0].room_number || null : null,
  }
}
