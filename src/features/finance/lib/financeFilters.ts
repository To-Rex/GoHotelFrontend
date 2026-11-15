import { tr } from "@/i18n"
import { PAYMENT_METHODS } from "@/lib/paymentMethods"
import { parseAmountInput } from "@/features/expenses/lib/categoryStyle"
import { compare, type Accessor, type SortDir } from "@/lib/tableState"
import type { PenaltyJournalItem } from "@/features/reservations/api/penalties"

/* Moliya sahifasi bo'limlarining filtrlari va saralash qoidalari.

   To'lovlar, hisob-fakturalar va do'kon savdolari sahifalab serverdan
   keladi — ularning filtrlari so'rov parametriga aylanadi (`*Params`),
   jami soni va summasi ham serverdan (butun natija bo'yicha, sahifa
   emas). Jarimalar davr bo'yicha to'liq keladi — ular brauzerda
   filtrlanadi va saralanadi.

   Davr almashganda filtrlar turadi (xarajatlar sahifasidagidek): xodim
   "Aziz qabul qilgan jarimalar"ni bir necha davrda ko'rib chiqishi
   mumkin. Filtr o'zgarsa jadval birinchi sahifaga qaytadi. */

/* --- Umumiy ---------------------------------------------------------- */

export interface Option {
  value: string
  label: string
}

/** Ro'yxatda bor bo'lsa olib tashlaydi, yo'q bo'lsa qo'shadi */
export function toggleValue(list: readonly string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

/** Summa oralig'i so'rov parametri — bo'sh yoki 0 yuborilmaydi */
function amountParams(minAmount: string, maxAmount: string) {
  return {
    min_amount: parseAmountInput(minAmount) ?? undefined,
    max_amount: parseAmountInput(maxAmount) ?? undefined,
  }
}

const hasAmount = (minAmount: string, maxAmount: string) =>
  parseAmountInput(minAmount) !== null || parseAmountInput(maxAmount) !== null

/** "Naqdsiz" — naqd puldan boshqa barcha turlar (bir tanlovda) */
export const NON_CASH = "NON_CASH"

/** To'lov turi tanlovi: to'rtta tur + "Naqdsiz" */
export const METHOD_OPTIONS: ReadonlyArray<Option> = [
  ...PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label })),
  { value: NON_CASH, label: tr("Naqdsiz (karta, online, o'tkazma)") },
]

/** Tanlangan to'lov turi -> serverga yuboriladigan kodlar ("CARD,ONLINE") */
export function methodParam(method: string | null): string | undefined {
  if (!method) return undefined
  if (method === NON_CASH) {
    return PAYMENT_METHODS.filter((m) => m.value !== "CASH")
      .map((m) => m.value)
      .join(",")
  }
  return method
}

/** Mobil saralash tanlovi qiymati: "ustun:yo'nalish" */
export function parseSortOption(value: string): { sortBy: string; sortDir: SortDir } {
  const [sortBy, dir] = value.split(":")
  return { sortBy, sortDir: dir === "asc" ? "asc" : "desc" }
}

/* --- To'lovlar ------------------------------------------------------- */

/** "Turi" filtri: belgilar bilan bir xil nom va rang (`paymentPurpose`) */
export type KindTone = "source" | "room" | "penalty" | "service" | "shop" | "debt" | "refund" | "extra"

export interface KindOption extends Option {
  tone: KindTone
}

export const PAYMENT_KIND_OPTIONS: ReadonlyArray<KindOption> = [
  { value: "RESERVATION", label: tr("Bron to'lovlari"), tone: "source" },
  { value: "SHOP", label: tr("Do'kon savdosi"), tone: "shop" },
  { value: "ROOM", label: tr("Xona"), tone: "room" },
  { value: "PENALTY", label: tr("Jarima"), tone: "penalty" },
  { value: "SERVICE", label: tr("Xizmat"), tone: "service" },
  { value: "DEBT", label: tr("Qarz to'lovi"), tone: "debt" },
  { value: "EXTRA", label: tr("Ortiqcha"), tone: "extra" },
  { value: "REFUND", label: tr("Qaytarim"), tone: "refund" },
]

const KIND_VALUES = new Set(PAYMENT_KIND_OPTIONS.map((k) => k.value))

/** Jadvaldagi belgi bosilsa filtrga aylana oladimi (masalan "Boshqa" — yo'q) */
export const isFilterKind = (key: string) => KIND_VALUES.has(key)

export interface PaymentFilters {
  /** "Turi" — tanlanganlardan birortasiga mos (bo'sh — hammasi) */
  kinds: string[]
  /** To'lov turi kodi yoki NON_CASH, null — hammasi */
  method: string | null
  /** Pulni qabul qilgan xodim id si, null — hammasi */
  user: string | null
  minAmount: string
  maxAmount: string
  /** Faqat turi tahrirlangan to'lovlar */
  edited: boolean
}

export const EMPTY_PAYMENT_FILTERS: PaymentFilters = {
  kinds: [],
  method: null,
  user: null,
  minAmount: "",
  maxAmount: "",
  edited: false,
}

/** Nechta filtr yoqilgan (qidiruv bundan tashqari) */
export function paymentFilterCount(f: PaymentFilters): number {
  return (
    (f.kinds.length > 0 ? 1 : 0) +
    (f.method ? 1 : 0) +
    (f.user ? 1 : 0) +
    (hasAmount(f.minAmount, f.maxAmount) ? 1 : 0) +
    (f.edited ? 1 : 0)
  )
}

/** `GET /finance/payments` parametrlari — bo'shlari yuborilmaydi */
export function paymentFilterParams(f: PaymentFilters) {
  // Tartib barqaror — so'rov kaliti tanlash tartibiga bog'liq bo'lmasin
  const kinds = PAYMENT_KIND_OPTIONS.map((k) => k.value).filter((v) => f.kinds.includes(v))
  return {
    kinds: kinds.length ? kinds.join(",") : undefined,
    methods: methodParam(f.method),
    created_by: f.user || undefined,
    ...amountParams(f.minAmount, f.maxAmount),
    edited: f.edited || undefined,
  }
}

export const PAYMENT_SORT_OPTIONS: ReadonlyArray<Option> = [
  { value: "created_at:desc", label: tr("Vaqt — yangisi avval") },
  { value: "created_at:asc", label: tr("Vaqt — eskisi avval") },
  { value: "amount:desc", label: tr("Summa — kattasi avval") },
  { value: "amount:asc", label: tr("Summa — kichigi avval") },
  { value: "payment_method:asc", label: tr("To'lov turi bo'yicha") },
  { value: "created_by_name:asc", label: tr("Xodim — A dan Z gacha") },
  { value: "room_number:asc", label: tr("Xona raqami bo'yicha") },
  { value: "payment_number:desc", label: tr("Raqami bo'yicha") },
]

/* --- Hisob-fakturalar ------------------------------------------------ */

export interface InvoiceFilters {
  /** Faqat qoldig'i (qarzi) bor hujjatlar */
  debtOnly: boolean
  /** Faqat chegirmali hujjatlar */
  discountOnly: boolean
  minAmount: string
  maxAmount: string
}

export const EMPTY_INVOICE_FILTERS: InvoiceFilters = {
  debtOnly: false,
  discountOnly: false,
  minAmount: "",
  maxAmount: "",
}

export function invoiceFilterCount(f: InvoiceFilters): number {
  return (
    (f.debtOnly ? 1 : 0) + (f.discountOnly ? 1 : 0) + (hasAmount(f.minAmount, f.maxAmount) ? 1 : 0)
  )
}

export function invoiceFilterParams(f: InvoiceFilters) {
  return {
    debt_only: f.debtOnly || undefined,
    discount_only: f.discountOnly || undefined,
    ...amountParams(f.minAmount, f.maxAmount),
  }
}

export const INVOICE_SORT_OPTIONS: ReadonlyArray<Option> = [
  { value: "invoice_date:desc", label: tr("Sana — yangisi avval") },
  { value: "invoice_date:asc", label: tr("Sana — eskisi avval") },
  { value: "remaining:desc", label: tr("Qoldiq — kattasi avval") },
  { value: "total_amount:desc", label: tr("Summa — kattasi avval") },
  { value: "total_amount:asc", label: tr("Summa — kichigi avval") },
  { value: "paid_amount:desc", label: tr("To'langani — kattasi avval") },
  { value: "discount_amount:desc", label: tr("Chegirma — kattasi avval") },
  { value: "due_date:asc", label: tr("Muddati — yaqini avval") },
  { value: "status:asc", label: tr("Holati bo'yicha") },
  { value: "invoice_number:desc", label: tr("Raqami bo'yicha") },
]

/* --- Do'kon savdolari ------------------------------------------------ */

/** Savdo kimga: "reservation" — bronga yozilgan, "direct" — bronsiz */
export type SaleLink = "" | "reservation" | "direct"

export const SALE_LINK_OPTIONS: ReadonlyArray<{ value: SaleLink; label: string }> = [
  { value: "reservation", label: tr("Bronga yozilgan") },
  { value: "direct", label: tr("Bronsiz (to'g'ridan-to'g'ri)") },
]

export interface SaleFilters {
  method: string | null
  linked: SaleLink
  minAmount: string
  maxAmount: string
}

export const EMPTY_SALE_FILTERS: SaleFilters = {
  method: null,
  linked: "",
  minAmount: "",
  maxAmount: "",
}

export function saleFilterCount(f: SaleFilters): number {
  return (f.method ? 1 : 0) + (f.linked ? 1 : 0) + (hasAmount(f.minAmount, f.maxAmount) ? 1 : 0)
}

export function saleFilterParams(f: SaleFilters) {
  return {
    methods: methodParam(f.method),
    linked: f.linked || undefined,
    ...amountParams(f.minAmount, f.maxAmount),
  }
}

export const PAID_SALE_SORT_OPTIONS: ReadonlyArray<Option> = [
  { value: "paid_at:desc", label: tr("Vaqt — yangisi avval") },
  { value: "paid_at:asc", label: tr("Vaqt — eskisi avval") },
  { value: "total_amount:desc", label: tr("Summa — kattasi avval") },
  { value: "total_amount:asc", label: tr("Summa — kichigi avval") },
  { value: "payment_method:asc", label: tr("To'lov turi bo'yicha") },
  { value: "reservation_number:asc", label: tr("Bron raqami bo'yicha") },
]

export const DEBT_SALE_SORT_OPTIONS: ReadonlyArray<Option> = [
  { value: "created_at:desc", label: tr("Vaqt — yangisi avval") },
  { value: "created_at:asc", label: tr("Vaqt — eskisi avval") },
  { value: "remaining:desc", label: tr("Qarz — kattasi avval") },
  { value: "remaining:asc", label: tr("Qarz — kichigi avval") },
  { value: "reservation_number:asc", label: tr("Bron raqami bo'yicha") },
]

/* --- Jarimalar (brauzerda) ------------------------------------------ */

export type PenaltyStatus = "all" | "active" | "voided"

export const PENALTY_STATUS_OPTIONS: ReadonlyArray<{ value: PenaltyStatus; label: string }> = [
  { value: "all", label: tr("Faol va bekor qilingan") },
  { value: "active", label: tr("Faqat faol") },
  { value: "voided", label: tr("Faqat bekor qilingan") },
]

export interface PenaltyFilters {
  /** Jarima turlari (LATE_CHECKOUT / DAMAGE / OTHER), bo'sh — hammasi */
  kinds: string[]
  status: PenaltyStatus
  /** Yozgan xodim id si (`created_by`), null — hammasi */
  user: string | null
  minAmount: string
  maxAmount: string
}

export const EMPTY_PENALTY_FILTERS: PenaltyFilters = {
  kinds: [],
  status: "all",
  user: null,
  minAmount: "",
  maxAmount: "",
}

export function penaltyFilterCount(f: PenaltyFilters): number {
  return (
    (f.kinds.length > 0 ? 1 : 0) +
    (f.status !== "all" ? 1 : 0) +
    (f.user ? 1 : 0) +
    (hasAmount(f.minAmount, f.maxAmount) ? 1 : 0)
  )
}

export const isVoided = (p: Pick<PenaltyJournalItem, "voided_at">) => !!p.voided_at

export function applyPenaltyFilters(
  items: readonly PenaltyJournalItem[],
  f: PenaltyFilters
): PenaltyJournalItem[] {
  const min = parseAmountInput(f.minAmount)
  const max = parseAmountInput(f.maxAmount)
  return items.filter((p) => {
    if (f.kinds.length > 0 && !f.kinds.includes(String(p.kind))) return false
    if (f.status === "active" && isVoided(p)) return false
    if (f.status === "voided" && !isVoided(p)) return false
    if (f.user && p.created_by !== f.user) return false
    const amount = Number(p.amount) || 0
    if (min !== null && amount < min) return false
    if (max !== null && amount > max) return false
    return true
  })
}

/** Filtr natijasi: soni va FAOL jarimalar summasi (bekor qilingani jamiga kirmaydi) */
export function penaltyTotals(items: readonly PenaltyJournalItem[]) {
  let total = 0
  for (const p of items) if (!isVoided(p)) total += Number(p.amount) || 0
  return { count: items.length, total }
}

export interface UserOption {
  id: string
  name: string
  count: number
}

/** Davrda jarima yozgan xodimlar — filtr ro'yxati (ism bo'yicha) */
export function penaltyUserOptions(items: readonly PenaltyJournalItem[]): UserOption[] {
  const byId = new Map<string, UserOption>()
  for (const p of items) {
    if (!p.created_by) continue
    const existing = byId.get(p.created_by)
    if (existing) {
      existing.count += 1
    } else {
      byId.set(p.created_by, { id: p.created_by, name: p.created_by_name || tr("Noma'lum"), count: 1 })
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "uz"))
}

export const PENALTY_SEARCH_FIELDS: ReadonlyArray<Accessor<PenaltyJournalItem>> = [
  (p) => p.reservation_number,
  (p) => p.room_number,
  (p) => p.guest_name,
  (p) => p.note,
  (p) => p.created_by_name,
  (p) => p.void_reason,
  (p) => String(Math.round(Number(p.amount) || 0)),
]

/** Ustun nomi -> qiymat (jadval sarlavhalari bilan bir xil) */
export function penaltySortAccessors(
  kindLabel: (kind: string) => string
): Record<string, Accessor<PenaltyJournalItem>> {
  return {
    // Bir kunda yozilganlar vaqti bilan
    created_at: (p) => p.created_at || p.penalty_date || null,
    reservation_number: (p) => p.reservation_number,
    guest_name: (p) => p.guest_name,
    kind: (p) => kindLabel(String(p.kind)),
    created_by_name: (p) => p.created_by_name,
    amount: (p) => Number(p.amount) || 0,
  }
}

/* --- Umumiy: to'lov usullari jadvali -------------------------------- */

export interface MethodRow {
  key: string
  label: string
  pay: number
  shop: number
  income: number
  expense: number
  net: number
}

/** Usullar jadvali saralanmagan bo'lsa — tanish tartib (naqd, karta, ...) */
export function sortMethodRows<T extends MethodRow>(
  rows: readonly T[],
  sortBy: string,
  sortDir: SortDir
): T[] {
  const column = sortBy as keyof MethodRow
  if (!sortBy || !["label", "pay", "shop", "income", "expense", "net"].includes(sortBy)) {
    return [...rows]
  }
  const sign = sortDir === "asc" ? 1 : -1
  return [...rows].sort((a, b) => compare(a[column], b[column]) * sign || a.key.localeCompare(b.key))
}
