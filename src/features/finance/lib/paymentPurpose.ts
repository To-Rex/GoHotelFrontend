import { format } from "date-fns"

import { tr } from "@/i18n"
import type { PaymentPurposePart, PaymentRecord } from "@/types/api"

/* To'lov NIMA UCHUN olingani — Moliya → To'lovlar jadvalidagi har qator.

   Server har to'lovga haqlar taqsimotini (`parts`: xona / jarima / xizmat /
   ortiqcha / qaytarim / do'kon), bron ma'lumotini (xona, mehmon, raqam) va
   qarz belgisini (`after_checkout`) beradi. Bu yerda ular ekrandagi
   belgilar va matnlarga aylanadi — toza funksiyalar, test qilinadi. */

export type PurposeTone = "room" | "penalty" | "service" | "shop" | "debt" | "refund" | "extra" | "other"

export interface PurposeBadge {
  key: string
  label: string
  tone: PurposeTone
  /** Jarima turi va h.k. — belgi ustiga borganda ko'rinadi */
  title?: string
}

const KIND_LABELS: Record<string, string> = {
  ROOM: tr("Xona"),
  PENALTY: tr("Jarima"),
  SERVICE: tr("Xizmat"),
  EXTRA: tr("Ortiqcha"),
  REFUND: tr("Qaytarim"),
  SHOP: tr("Do'kon"),
  OTHER: tr("Boshqa"),
}

const KIND_TONES: Record<string, PurposeTone> = {
  ROOM: "room",
  PENALTY: "penalty",
  SERVICE: "service",
  EXTRA: "extra",
  REFUND: "refund",
  SHOP: "shop",
}

const KIND_ORDER = ["ROOM", "PENALTY", "SERVICE", "SHOP", "EXTRA", "REFUND", "OTHER"]

export const isShopPayment = (p: Pick<PaymentRecord, "source">) => p.source === "SHOP"

/** Qaysi haqlar yopilgani — bir turdagi qismlar bitta belgiga yig'iladi. */
export function purposeBadges(
  p: Pick<PaymentRecord, "parts" | "amount" | "source" | "after_checkout">
): PurposeBadge[] {
  const badges: PurposeBadge[] = []
  if (Number(p.amount) < 0) {
    badges.push({ key: "REFUND", label: KIND_LABELS.REFUND, tone: "refund" })
    return badges
  }
  if (p.after_checkout) {
    badges.push({ key: "DEBT", label: tr("Qarz to'lovi"), tone: "debt", title: tr("Mehmon chiqib ketgandan keyin to'langan") })
  }
  const byKind = new Map<string, { amount: number; labels: string[] }>()
  for (const part of p.parts ?? []) {
    const kind = KIND_ORDER.includes(part.kind) ? part.kind : "OTHER"
    const row = byKind.get(kind) ?? { amount: 0, labels: [] }
    row.amount += Number(part.amount) || 0
    if (part.label && !row.labels.includes(part.label)) row.labels.push(part.label)
    byKind.set(kind, row)
  }
  for (const kind of KIND_ORDER) {
    const row = byKind.get(kind)
    if (!row || row.amount <= 0) continue
    // Birgina haq bo'lsa summa belgida takrorlanmaydi — u "Summa" ustunida
    const several = byKind.size > 1
    badges.push({
      key: kind,
      label: several ? `${KIND_LABELS[kind]} ${fmt(row.amount)}` : KIND_LABELS[kind],
      tone: KIND_TONES[kind] ?? "other",
      title: kind === "PENALTY" || kind === "SERVICE" ? row.labels.join(", ") || undefined : undefined,
    })
  }
  if (badges.length === 0 && isShopPayment(p)) {
    badges.push({ key: "SHOP", label: KIND_LABELS.SHOP, tone: "shop" })
  }
  return badges
}

const fmt = (n: number) => Number(n || 0).toLocaleString()

/** Chekdagi mahsulotlar: "Coca-Cola ×2, Suv ×1". */
export function shopItemsText(items: PaymentRecord["items"]): string {
  return (items ?? [])
    .map((i) => (i.quantity > 1 ? `${i.product_name} ×${i.quantity}` : i.product_name))
    .join(", ")
}

/** Sarlavha: kimdan/nima uchun — "Xona 12 · Ali Valiyev" yoki do'konda mahsulotlar. */
export function purposeTitle(p: PaymentRecord): string {
  if (isShopPayment(p)) {
    const items = shopItemsText(p.items)
    return items ? tr("Do'kon: {{items}}", { items }) : tr("Do'kon savdosi")
  }
  const bits: string[] = []
  if (p.room_number) bits.push(tr("Xona {{room}}", { room: p.room_number }))
  if (p.guest_name) bits.push(p.guest_name)
  if (bits.length === 0 && p.reservation_number) bits.push(p.reservation_number)
  return bits.join(" · ") || tr("Bron to'lovi")
}

const shortDate = (iso?: string | null) => {
  if (!iso) return ""
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : format(d, "dd.MM")
}

const parseMoment = (iso?: string | null): Date | null => {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Yashash muddati: kunlik — "01.11–03.11"; soatlik — aniq soatlar bilan
 *  ("03.11 14:00–17:00", kun almashsa "03.11 22:00–04.11 02:00"). */
export function stayText(p: Pick<PaymentRecord, "booking_type" | "check_in_date" | "check_out_date" | "check_in_datetime" | "check_out_datetime">): string {
  if (p.booking_type === "HOURLY") {
    const from = parseMoment(p.check_in_datetime)
    const to = parseMoment(p.check_out_datetime)
    if (from && to) {
      const sameDay = format(from, "yyyy-MM-dd") === format(to, "yyyy-MM-dd")
      const stay = sameDay
        ? `${format(from, "dd.MM HH:mm")}–${format(to, "HH:mm")}`
        : `${format(from, "dd.MM HH:mm")}–${format(to, "dd.MM HH:mm")}`
      return tr("{{stay}} (soatlik)", { stay })
    }
  }
  if (!p.check_in_date || !p.check_out_date) return ""
  const stay = `${shortDate(p.check_in_date)}–${shortDate(p.check_out_date)}`
  return p.booking_type === "HOURLY" ? tr("{{stay}} (soatlik)", { stay }) : stay
}

/** Ikkinchi qator: bron raqami va muddati (do'konda — bronga yozilgan bo'lsa). */
export function purposeDetail(p: PaymentRecord): string {
  const bits: string[] = []
  if (isShopPayment(p)) {
    if (p.room_number) bits.push(tr("Xona {{room}}", { room: p.room_number }))
    if (p.guest_name) bits.push(p.guest_name)
    if (p.reservation_number) bits.push(p.reservation_number)
    return bits.join(" · ")
  }
  if (p.reservation_number) bits.push(p.reservation_number)
  const stay = stayText(p)
  if (stay) bits.push(stay)
  return bits.join(" · ")
}

/** Hisobot sanasi (`payment_date`) — ekranda kun.oy.yil. */
export const formatReportDate = (iso?: string | null) => {
  if (!iso) return ""
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : format(d, "dd.MM.yyyy")
}

/* Avtomatik izohlar serverda inglizcha/uzun yoziladi — ekranda qisqa va
   o'zbekcha. Qo'lda yozilgan izoh o'z holicha qoladi. */
const AUTO_NOTES: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^Payment at reservation creation$/i, () => tr("Bron qilinganda to'langan")],
  [/^Qo'shimcha to'lov \(bron balansi bo'yicha\)(?: — bo'lib to'lash (\d+)\/(\d+))?$/, (m) =>
    m[1] ? tr("Qo'shimcha to'lov, bo'lib to'lash {{i}}/{{n}}", { i: m[1], n: m[2] }) : tr("Qo'shimcha to'lov")],
]

/** Izoh — avtomatik yozuvlar qisqa shaklda, qolgani aynan. */
export function humanNote(notes?: string | null): string {
  const text = (notes || "").trim()
  if (!text) return ""
  for (const [re, make] of AUTO_NOTES) {
    const m = text.match(re)
    if (m) return make(m)
  }
  return text
}

/** To'lov qabul qilingan daqiqa (mahalliy). */
export function paymentMoment(p: Pick<PaymentRecord, "created_at">): Date | null {
  if (!p.created_at) return null
  const d = new Date(p.created_at)
  return Number.isNaN(d.getTime()) ? null : d
}

export const formatMoment = (d: Date | null, withDate = true) =>
  d ? format(d, withDate ? "dd.MM.yyyy HH:mm" : "HH:mm") : "-"

/** Hisobot sanasi (`payment_date`) qabul qilingan kundan farq qilsa —
 *  masalan qo'lda kiritilgan sana — ko'rsatiladi. */
export function reportDateDiffers(p: Pick<PaymentRecord, "created_at" | "payment_date">): boolean {
  const d = paymentMoment(p)
  if (!d || !p.payment_date) return false
  return format(d, "yyyy-MM-dd") !== p.payment_date.slice(0, 10)
}

/** Bron kalendarda ochiladi — faqat hali yopilmagan bronlar uchun (yopilgan
 *  eski bronlar kalendar ro'yxatida bo'lmaydi). */
export function bookingLink(p: PaymentRecord): string | null {
  if (!p.reservation_id) return null
  const status = (p.reservation_status || "").toUpperCase()
  if (!["PENDING", "CONFIRMED", "CHECKED_IN"].includes(status)) return null
  return `/booking?reservation=${encodeURIComponent(p.reservation_id)}`
}

export type { PaymentPurposePart }
