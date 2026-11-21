import { tr } from "@/i18n"
import { formatWallClock } from "@/lib/hotelTime"

import type { ActionField, ActionStatus } from "../api/assistant"

/* Amal kartasi yordamchilari (sof funksiyalar — testlanadi). */

export const editable = (status: ActionStatus): boolean => status === "proposed" || status === "failed"

export function actionStatusMeta(status: ActionStatus): { label: string; cls: string } {
  switch (status) {
    case "proposed":
      return { label: tr("Tasdiq kutilmoqda"), cls: "bg-amber-50 text-amber-700" }
    case "executing":
      return { label: tr("Bajarilmoqda…"), cls: "bg-primary/10 text-primary" }
    case "executed":
      return { label: tr("Bajarildi"), cls: "bg-emerald-50 text-emerald-700" }
    case "failed":
      return { label: tr("Bajarilmadi"), cls: "bg-red-50 text-red-700" }
    case "rejected":
      return { label: tr("Rad etildi"), cls: "bg-muted text-muted-foreground" }
    case "undoing":
      return { label: tr("Qaytarilmoqda…"), cls: "bg-amber-50 text-amber-700" }
    case "undone":
      return { label: tr("Qaytarildi"), cls: "bg-muted text-muted-foreground" }
    case "undo_failed":
      return { label: tr("Qaytarilmadi"), cls: "bg-red-50 text-red-700" }
    case "expired":
      return { label: tr("Muddati o'tgan"), cls: "bg-muted text-muted-foreground" }
    default:
      return { label: tr("Holati noma'lum"), cls: "bg-muted text-muted-foreground" }
  }
}

/** Forma maydoniga beriladigan qiymat (input `value`). */
export function inputValue(field: ActionField, value: unknown): string {
  if (value === null || value === undefined) return ""
  if (field.kind === "datetime") return String(value).slice(0, 16)
  if (field.kind === "date") return String(value).slice(0, 10)
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

/** Ko'rish rejimidagi qiymat: tanlov nomi, bog'langan yozuv nomi, ... */
export function fieldDisplay(field: ActionField, value: unknown): string {
  if (field.display) return field.display
  if (value === null || value === undefined || value === "") return "—"
  if (field.kind === "select") {
    const opt = field.options?.find((o) => o.value === value)
    return opt ? tr(opt.label) : String(value)
  }
  if (field.kind === "checkbox") return value ? tr("Ha") : tr("Yo'q")
  if (field.kind === "id") return `#${String(value).slice(0, 8)}`
  if (field.kind === "json") {
    if (Array.isArray(value)) return tr("{{count}} ta", { count: value.length })
    return tr("{{count}} ta maydon", { count: Object.keys(value as object).length })
  }
  if (field.kind === "date") return formatWallClock(String(value)) || String(value)
  if (field.kind === "datetime") return formatWallClock(String(value), true) || String(value)
  return String(value)
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** Faqat o'zgargan maydonlar (bo'shatilgani — null). */
export function changedValues(
  fields: ActionField[],
  initial: Record<string, unknown>,
  values: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    const v = values[f.name]
    if (!same(v, initial[f.name])) out[f.name] = v === "" ? null : v
  }
  return Object.keys(out).length ? out : undefined
}

const RESULT_LABELS: Record<string, () => string> = {
  reservation_number: () => tr("Bron raqami"),
  number: () => tr("Raqam"),
  invoice_number: () => tr("Hisob-faktura"),
  payment_number: () => tr("To'lov raqami"),
  total_amount: () => tr("Jami"),
  amount: () => tr("Summa"),
  room_number: () => tr("Xona"),
  "penalty.amount": () => tr("Jarima"),
}

/** Bajarilgan amal natijasidan 1–3 ta muhim qiymat. */
export function resultSummary(result: Record<string, unknown> | null): { label: string; value: string | number }[] {
  if (!result) return []
  const out: { label: string; value: string | number }[] = []
  for (const [key, label] of Object.entries(RESULT_LABELS)) {
    const v = result[key]
    if (v === null || v === undefined || v === "") continue
    const n = typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v
    out.push({ label: label(), value: typeof n === "number" ? n : String(n) })
    if (out.length >= 3) break
  }
  return out
}

/* Server (o'zbekcha) yuboradigan amal nomlari, maydon va qiymat yorliqlari —
   ekranda tr(...) bilan tarjima qilinadi; ro'yxat tarjima tekshiruvi uchun
   (actions_service.py, catalog.py bilan bir xil). */
// i18n:keys
export const SERVER_LABELS = [
  "Yangi bron yaratish", "Bronni tahrirlash", "Mehmonni joylashtirish (check-in)", "Mehmonni chiqarish (check-out)",
  "Bronni uzaytirish", "Mehmonni boshqa xonaga ko'chirish", "Bronga xizmat qo'shish", "Jarima yozish",
  "Bronni bekor qilish", "Bronni \"kelmadi\" deb belgilash", "Chiqishni so'rash", "To'lov qabul qilish",
  "To'lov turini tahrirlash", "Xarajat yozish", "Xarajatni tahrirlash", "Do'kon savdosi", "Do'kon qarzini to'lash",
  "Xo'jalik vazifasi yaratish", "Vazifani xodimga biriktirish", "Vazifa holatini o'zgartirish", "Xona holatini o'zgartirish",
  "Muammo holatini o'zgartirish", "Mehmon qo'shish", "Mehmon ma'lumotlarini tahrirlash", "Murojaat (taklif/shikoyat) yozish",
  "Murojaat holatini o'zgartirish", "Xodimlarga xabar yuborish", "Xabarni bajarildi deb belgilash",
  "Xodimga bildirishnoma yuborish",
  "Mehmon", "Xona", "Filial", "Bron turi", "Kelish sanasi", "Ketish sanasi", "Kelish vaqti", "Ketish vaqti", "Kattalar",
  "Bolalar", "Chegirma (so'm)", "Chegirma (%)", "Izoh", "To'lov summasi", "To'lov usuli", "To'lovlar", "Hamrohlar",
  "Kutilayotgan hamrohlar", "Yangi ketish vaqti", "Yangi xona", "Xizmat", "Soni", "Xizmat sanasi", "Turi", "Summa",
  "Sabab", "Qaytariladigan summa", "Qaytarish usuli", "Qarz bilan chiqishni tasdiqlash", "Qarz izohi", "Hisob-faktura",
  "To'lov sanasi", "Raqam/havola", "Nomi", "Toifa", "Sana", "Mahsulotlar", "Bron", "Vazifa turi", "Muhimlik",
  "Mas'ul xodim", "Rejalangan sana", "Holat", "Ism", "Familiya", "Telefon", "Pasport raqami", "Fuqarolik",
  "Tug'ilgan sana", "Hujjat turi", "Hujjat raqami", "Manzil", "Murojaat turi", "Mavzu", "Matn", "Yechim", "Mehmon ismi",
  "Mehmon telefoni", "Xodim", "Bog'liq tur", "Bog'liq yozuv",
  "Naqd", "Karta", "Onlayn", "Bank o'tkazmasi", "Kredit karta", "Debet karta", "Mobil to'lov", "O'tkazma", "Kunlik",
  "Soatlik", "Talab", "Taklif", "Shikoyat", "Past", "O'rta", "Yuqori", "Kech chiqish", "Zarar", "Boshqa", "Yangi",
  "Jarayonda", "Hal qilindi", "Rad etildi", "Bo'sh", "Tozalanmoqda", "Ta'mirda", "Ishlamaydi", "Ochiq", "Bajarildi",
  "Bekor qilindi",
  "Ma'lumot o'qilmoqda", "Bo'lim qidirilmoqda", "Maydonlar tekshirilmoqda", "Hisoblanmoqda", "Jadval tayyorlanmoqda",
  "Grafik chizilmoqda", "Ko'rsatkichlar", "Excel fayl tayyorlanmoqda", "Havola", "Variantlar", "Amal tayyorlanmoqda",
  "Amallar ko'rilmoqda", "Qaytarish tayyorlanmoqda", "Reja yozilmoqda", "Rejalar ko'rilmoqda", "Reja yangilanmoqda",
  "Xavfsizlik qaydi", "Boshqa (OpenAI bilan mos API)",
  "Ma'lumotni o'chirish/buzish", "Qo'rqitish yoki bosim", "Qoidalarni chetlab o'tish", "Huquqni oshirish",
  "Maxfiy ma'lumot", "Rolidan tashqari so'rov",
] as const
