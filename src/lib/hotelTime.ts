/* Mehmonxona vaqti — chek va hujjatlardagi sana/soat.

   Serverdagi vaqt belgilari (`created_at`, `paid_at`) UTC DAQIQA: ularni
   ekranga chiqarishda mahalliy soatga o'tkazish kerak. Brauzer buni
   KOMPYUTERNING vaqt zonasi bilan qiladi — kassa kompyuterida zona
   noto'g'ri (masalan UTC) bo'lsa chekdagi "Sana" 5 soat orqada chiqadi.
   Chek — hujjat, u kompyuterga bog'liq bo'lmasligi kerak: vaqt doim
   mehmonxona zonasida (serverdagi APP_TZ_OFFSET_MINUTES bilan bir xil,
   Toshkent +05:00, yozgi vaqt yo'q).

   Soatlik bron vaqtlari (`check_in_datetime`, `check_out_datetime`) esa
   boshqa: ilova ularni zonasiz yuboradi ("2026-11-05T14:00:00") va server
   shu devor soatini o'zgartirmay saqlaydi, qaytarganda esa "+00:00"
   belgisini qo'shadi. Bu belgi YOLG'ON — vaqtni o'tkazib bo'lmaydi,
   matndan o'qiladi (`new Date()` 5 soat qo'shib yuboradi). Ilovaning
   qolgan ekranlari ham shunday qiladi (reservationDetail.ts). */

/** Mehmonxona zonasi: UTC dan necha daqiqa oldinda (serverdagi standart). */
export const HOTEL_UTC_OFFSET_MINUTES = 300

const pad = (n: number) => String(n).padStart(2, "0")

const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/i

export interface ClockText {
  /** "05.11.2026" */
  date: string
  /** "05.11" */
  short: string
  /** "14:05" — faqat sana bo'lsa null */
  time: string | null
  /** "2026-11-05" — kunlarni solishtirish uchun */
  ymd: string
}

/** Haqiqiy daqiqa (UTC belgi) → mehmonxona devor soati.
 *  Zonasiz matn UTC deb olinadi (serverdagi `local_date_of` qoidasi). */
export function hotelClock(iso?: string | Date | null): ClockText | null {
  if (!iso) return null
  let d: Date
  if (iso instanceof Date) {
    d = iso
  } else {
    const text = String(iso).trim()
    d = new Date(HAS_ZONE.test(text) || !text.includes("T") ? text : `${text}Z`)
  }
  if (Number.isNaN(d.getTime())) return null
  const t = new Date(d.getTime() + HOTEL_UTC_OFFSET_MINUTES * 60_000)
  const y = t.getUTCFullYear()
  const M = pad(t.getUTCMonth() + 1)
  const D = pad(t.getUTCDate())
  return {
    date: `${D}.${M}.${y}`,
    short: `${D}.${M}`,
    time: `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`,
    ymd: `${y}-${M}-${D}`,
  }
}

/** "05.11.2026 14:05" (yoki faqat sana) — mehmonxona zonasida; bo'sh/xato → "". */
export const formatHotelMoment = (iso?: string | Date | null, withTime = true): string => {
  const c = hotelClock(iso)
  if (!c) return ""
  return withTime ? `${c.date} ${c.time}` : c.date
}

/** Devor soati: matn qanday yozilgan bo'lsa shunday — zona belgisi
 *  e'tiborga olinmaydi. "2026-11-05", "2026-11-05T14:00:00+00:00" ... */
export function wallClock(iso?: string | null): ClockText | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(String(iso ?? "").trim())
  if (!m) return null
  const [, y, M, D, h, mm] = m
  return {
    date: `${D}.${M}.${y}`,
    short: `${D}.${M}`,
    time: h ? `${h}:${mm}` : null,
    ymd: `${y}-${M}-${D}`,
  }
}

/** "05.11.2026 14:00" — devor soati; vaqt so'ralsa-yu matnda bo'lmasa, faqat sana. */
export const formatWallClock = (iso?: string | null, withTime = false): string => {
  const c = wallClock(iso)
  if (!c) return ""
  return withTime && c.time ? `${c.date} ${c.time}` : c.date
}
