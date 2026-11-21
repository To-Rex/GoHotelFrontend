import { tr } from "@/i18n"
import type { Accessor } from "@/lib/tableState"
import type { CostStatus, MissingCostBatch, ShopProfit, ShopProfitProduct } from "../api/shopProfit"
import type { Option } from "./financeFilters"

/* Do'kon foydasi paneli uchun sof qoidalar: ko'rinish matnlari, saralash,
   ishora (foyda / zarar) va tannarx kiritish oynasi tartibi. Hisob-kitobning
   o'zi serverda (`shop_profit_service.py`) — bu yerda faqat ko'rsatish. */

export type Tone = "pos" | "neg" | "zero"

/** Foyda — yashil, zarar — qizil, nol — kulrang (tiyin farqi nol) */
export const toneOf = (n: number | null | undefined): Tone => {
  const v = Number(n || 0)
  if (Math.abs(v) < 0.5) return "zero"
  return v > 0 ? "pos" : "neg"
}

export const TONE_TEXT: Record<Tone, string> = {
  pos: "text-emerald-700",
  neg: "text-red-600",
  zero: "text-gray-500",
}

const fmt = (n: number) => Math.round(Number(n || 0)).toLocaleString()

/** "+52,000" / "−2,000" / "0" — ishorasi bilan */
export function signed(n: number): string {
  const tone = toneOf(n)
  if (tone === "zero") return "0"
  return `${tone === "pos" ? "+" : "−"}${fmt(Math.abs(n))}`
}

/** Marja: "41.9%" (bir xona), yo'q bo'lsa "—" */
export function marginText(m: number | null | undefined): string {
  if (m === null || m === undefined || Number.isNaN(Number(m))) return "—"
  return `${Number(m).toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 0 })}%`
}

/** Davrda do'konda biror harakat bo'lganmi (sotuv yoki ombor tuzatishi) */
export const hasActivity = (p: ShopProfit): boolean =>
  p.sales.count > 0 || p.writeoff.count + p.shortage.count + p.surplus.count > 0

/** Tannarx holati belgisi — mahsulot qatorida */
export function costStatusBadge(status: CostStatus): { label: string; className: string; title: string } | null {
  switch (status) {
    case "estimated":
      return {
        label: tr("taxminiy"),
        className: "bg-sky-50 text-sky-700 ring-sky-200",
        title: tr("Partiyada tannarx yo'q — mahsulotning o'rtacha tannarxi olindi"),
      }
    case "partial":
      return {
        label: tr("qisman"),
        className: "bg-amber-50 text-amber-700 ring-amber-200",
        title: tr("Sotuvning bir qismida tannarx yo'q — u qism foydaga kirmagan"),
      }
    case "unknown":
      return {
        label: tr("tannarx yo'q"),
        className: "bg-amber-50 text-amber-700 ring-amber-200",
        title: tr("Tannarx kiritilmagan — foyda hisoblanmadi"),
      }
    default:
      return null
  }
}

/** Yo'qotishlar kartasi ostidagi tarkib: "spisaniye 13,000 · kamomad 12,000" */
export function lossParts(p: ShopProfit): string[] {
  const parts: string[] = []
  if (p.writeoff.count > 0) parts.push(tr("spisaniye {{amount}}", { amount: fmt(p.writeoff.cost) }))
  if (p.shortage.count > 0) parts.push(tr("kamomad {{amount}}", { amount: fmt(p.shortage.cost) }))
  if (p.surplus.count > 0) parts.push(tr("ortiqcha +{{amount}}", { amount: fmt(p.surplus.cost) }))
  return parts
}

export interface FormulaPart {
  label: string
  value: number
  /** Qanday qo'shiladi: birinchisi — o'zi, qolganlari ± */
  sign: "first" | "minus" | "plus"
}

/** Sof foyda qayerdan chiqqani — banner ostidagi satr */
export function netFormula(p: ShopProfit): FormulaPart[] {
  const parts: FormulaPart[] = [{ label: tr("yalpi foyda"), value: p.gross_profit, sign: "first" }]
  if (p.writeoff.count > 0) parts.push({ label: tr("spisaniye"), value: p.writeoff.cost, sign: "minus" })
  if (p.shortage.count > 0) parts.push({ label: tr("kamomad"), value: p.shortage.cost, sign: "minus" })
  if (p.surplus.count > 0) parts.push({ label: tr("ortiqcha"), value: p.surplus.cost, sign: "plus" })
  return parts
}

/* --- Mahsulotlar jadvali -------------------------------------------- */

export const PRODUCT_SEARCH: ReadonlyArray<Accessor<ShopProfitProduct>> = [(r) => r.name]

/** Ustun → qiymat (SortableHead column nomlari bilan bir xil) */
export const PRODUCT_SORTS: Record<string, Accessor<ShopProfitProduct>> = {
  name: (r) => r.name,
  sold_qty: (r) => r.sold_qty,
  revenue: (r) => r.revenue,
  cost: (r) => r.cost,
  profit: (r) => r.profit,
  margin: (r) => (r.margin === null ? Number.NEGATIVE_INFINITY : r.margin),
  losses: (r) => r.losses,
  net: (r) => r.net,
}

/** Mobil saralash */
export const PRODUCT_SORT_OPTIONS: ReadonlyArray<Option> = [
  { value: "net:desc", label: tr("Natija — eng foydali avval") },
  { value: "net:asc", label: tr("Natija — eng zararli avval") },
  { value: "revenue:desc", label: tr("Sotuv — kattasi avval") },
  { value: "sold_qty:desc", label: tr("Sotilgan — ko'pi avval") },
  { value: "margin:desc", label: tr("Marja — yuqorisi avval") },
  { value: "margin:asc", label: tr("Marja — pasti avval") },
  { value: "name:asc", label: tr("Nomi — A dan Z gacha") },
]

/** Tannarxi umuman noma'lum mahsulot: foyda "0" emas, "—" (hisoblanmagan) */
export const profitUnknown = (r: Pick<ShopProfitProduct, "cost_status">): boolean => r.cost_status === "unknown"

/** Natija ham noma'lum: tannarx yo'q va yo'qotish ham yo'q */
export const netUnknown = (r: Pick<ShopProfitProduct, "cost_status" | "losses">): boolean =>
  profitUnknown(r) && toneOf(r.losses) === "zero"

/** Zarar keltirgan mahsulot (sof natija manfiy) — qator qizil fonda */
export const isLossRow = (r: ShopProfitProduct): boolean => toneOf(r.net) === "neg"

/* --- Tannarxni kiritish oynasi -------------------------------------- */

/** Avval shu davrda sotilganlari (foydaga darhol ta'sir qiladi), keyin
 *  ko'p qolgani, keyin yangisi */
export function orderMissing(rows: ReadonlyArray<MissingCostBatch>): MissingCostBatch[] {
  return [...rows].sort(
    (a, b) =>
      b.sold_in_period - a.sold_in_period ||
      b.remaining - a.remaining ||
      String(b.created_at || "").localeCompare(String(a.created_at || ""))
  )
}

/** Kiritilgan tannarx bilan bir dona foydasi va marjasi (oldindan ko'rish) */
export function unitPreview(cost: number | null, salePrice: number): { profit: number; margin: number } | null {
  if (cost === null || !(salePrice > 0)) return null
  const profit = salePrice - cost
  return { profit, margin: (profit / salePrice) * 100 }
}
