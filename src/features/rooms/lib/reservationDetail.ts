import type { RoomReservation, ReservationOccupant } from "../api/rooms"

/**
 * Bandlov tafsiloti uchun formatlash va hisob-kitob.
 *
 * Komponentdan ajratilgan, chunki bu yerda testga arziydigan nozikliklar
 * bor: soatlik va kunlik bron muddatni butunlay boshqacha saqlaydi, sana
 * maydonlari yo'q yoki buzuq bo'lishi mumkin (eski yozuvlar), qarz esa
 * manfiy chiqmasligi kerak.
 */

const pad = (n: number) => String(n).padStart(2, "0")

/**
 * "02.09.2026, 14:30" — sana va vaqt.
 *
 * O'qib bo'lmaydigan qiymatda null: "Invalid Date" ko'rsatgandan ko'ra
 * qatorni umuman chizmagan ma'qul.
 */
export function formatDateTime(value?: string | null): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`
}

/** "02.09.2026" — faqat sana. */
export function formatDate(value?: string | null): string | null {
  if (!value) return null
  // "2026-09-02" ko'rinishidagi sof sana mintaqa siljishisiz o'qilsin
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (plain) return `${plain[3]}.${plain[2]}.${plain[1]}`
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}

/** "14:30" — ISO qiymatdan soat. */
export function timeOf(value?: string | null): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function isHourly(res: RoomReservation): boolean {
  return (res.booking_type || "").toUpperCase() === "HOURLY"
}

/** Kunlik bron uchun kechalar soni. Soatlikda 0. */
export function nightCount(res: RoomReservation): number {
  if (isHourly(res)) return 0
  const a = new Date(res.check_in_date).getTime()
  const b = new Date(res.check_out_date).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.max(Math.round((b - a) / 86_400_000), 0)
}

/** Soatlik bron davomiyligi, soatlarda. Kunlikda 0. */
export function hourCount(res: RoomReservation): number {
  if (!isHourly(res)) return 0
  const a = res.check_in_datetime ? new Date(res.check_in_datetime).getTime() : NaN
  const b = res.check_out_datetime ? new Date(res.check_out_datetime).getTime() : NaN
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.max(Math.round(((b - a) / 3_600_000) * 10) / 10, 0)
}

/**
 * Muddat matni: kunlikda sanalar, soatlikda sana va aniq oralig'i.
 *
 * Sana o'qilmasa xom qiymat qaytadi — yozuv yo'qolib qolgandan ko'ra
 * xomi ko'ringani yaxshi.
 */
export function stayLabel(res: RoomReservation): string {
  if (isHourly(res)) {
    const day = formatDate(res.check_in_date) || res.check_in_date
    const from = timeOf(res.check_in_datetime)
    const to = timeOf(res.check_out_datetime)
    return from && to ? `${day}, ${from} – ${to}` : day
  }
  const from = formatDate(res.check_in_date) || res.check_in_date
  const to = formatDate(res.check_out_date) || res.check_out_date
  return `${from} → ${to}`
}

/** Qarz. Ortiqcha to'langan bo'lsa 0 — manfiy qarz mantiqsiz. */
export function debtOf(res: RoomReservation): number {
  return Math.max(Number(res.total_amount || 0) - Number(res.paid_amount || 0), 0)
}

/** Ortiqcha to'langan qism (qaytarilishi kerak bo'lgani). */
export function overpaidOf(res: RoomReservation): number {
  return Math.max(Number(res.paid_amount || 0) - Number(res.total_amount || 0), 0)
}

/**
 * Xonada turganlar, kartochkalari bilan.
 *
 * Server `occupants` ni qaytaradi. U kelmasa — eski javob yoki eski
 * keshlangan yozuv bo'lsa — bronning o'zidagi ism va telefondan yig'iladi.
 * Shu tufayli oyna server yangilanmagan holatda ham bo'sh qolmaydi.
 */
export function occupantsOf(res: RoomReservation): ReservationOccupant[] {
  if (res.occupants && res.occupants.length) return res.occupants

  const fallback: ReservationOccupant[] = []
  if (res.guest_name || res.guest_phone) {
    fallback.push({
      guest_id: res.guest_id,
      name: res.guest_name,
      is_primary: true,
      phone: res.guest_phone,
    })
  }
  for (const c of res.companions || []) {
    const name = (c?.name || "").trim()
    if (name) fallback.push({ guest_id: c.guest_id, name, is_primary: false })
  }
  return fallback
}
