import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/lib/paymentMethods"
import type { Accessor } from "@/lib/tableState"
import type { Expense } from "@/types/api"
import { tr } from "@/i18n"
import { nameKey } from "./categoryStyle"
import { parseAmountInput } from "./categoryStyle"
import type { ExpenseGroup } from "./expenseGroups"

/* Xarajatlar ro'yxatining filtrlari va saralash qoidalari.

   Hammasi brauzerda, guruhlar (bitta xarajat = bitta guruh) ustida:
   ro'yxat davr bo'yicha serverdan to'liq keladi (1000 tagacha), shuning
   uchun qidiruv, filtr va saralash darhol, so'rovsiz ishlaydi. Toifa
   filtri bir nechta toifani birga oladi (solishtirish uchun), xodim va
   to'lov turi — bittadan, summa — oraliq. */

/** Toifasiz xarajat hisobotdagidek "Boshqa" ga yig'iladi (server ham shunday) */
export const categoryOf = (e: Pick<Expense, "category">): string =>
  e.category || /* i18n:skip */ "Boshqa"

/** Qisman (aralash) to'lov filtrdagi "to'lov turi" qiymati */
export const MIXED = "MIXED"

export interface ExpenseFilters {
  /** Toifa nomlari (bo'sh — hammasi); taqqoslash nameKey bilan */
  categories: string[]
  /** Kiritgan xodim (`created_by`), null — hammasi */
  user: string | null
  /** To'lov turi kodi yoki MIXED (qisman), null — hammasi */
  method: string | null
  /** Summa oralig'i — formatlangan satrlar ("150 000"), bo'sh — chegarasiz */
  minAmount: string
  maxAmount: string
}

export const EMPTY_FILTERS: ExpenseFilters = {
  categories: [],
  user: null,
  method: null,
  minAmount: "",
  maxAmount: "",
}

/** Nechta filtr yoqilgan (qidiruv bundan tashqari — u o'z maydonida ko'rinadi) */
export function activeFilterCount(f: ExpenseFilters): number {
  return (
    (f.categories.length > 0 ? 1 : 0) +
    (f.user ? 1 : 0) +
    (f.method ? 1 : 0) +
    (parseAmountInput(f.minAmount) !== null || parseAmountInput(f.maxAmount) !== null ? 1 : 0)
  )
}

export function toggleCategory(f: ExpenseFilters, name: string): ExpenseFilters {
  const key = nameKey(name)
  const has = f.categories.some((c) => nameKey(c) === key)
  return {
    ...f,
    categories: has ? f.categories.filter((c) => nameKey(c) !== key) : [...f.categories, name],
  }
}

export const hasCategory = (f: ExpenseFilters, name: string): boolean =>
  f.categories.some((c) => nameKey(c) === nameKey(name))

/** Guruhning to'lov turi: bitta kod yoki MIXED */
export const methodOf = (g: ExpenseGroup<Expense>): string =>
  g.isSplit ? MIXED : g.main.payment_method

/** To'lov turi nomi — filtr va saralash uchun ("Aralash" ham shu yerda) */
export const methodLabelOf = (g: ExpenseGroup<Expense>): string =>
  g.isSplit ? tr("Aralash") : PAYMENT_METHOD_LABELS[g.main.payment_method] || g.main.payment_method

/** To'lov turi filtri variantlari: kanonik to'rtlik + qisman */
export const METHOD_FILTER_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  ...PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label })),
  { value: MIXED, label: tr("Aralash (qisman)") },
]

/** Eski to'lov kodlari ham o'z kanonik turiga tushadi (CREDIT_CARD → CARD) */
function canonical(code: string | null | undefined): string {
  const key = String(code || "").toUpperCase()
  switch (key) {
    case "CREDIT_CARD":
    case "DEBIT_CARD":
      return "CARD"
    case "MOBILE_PAYMENT":
      return "ONLINE"
    case "TRANSFER":
      return "BANK_TRANSFER"
    default:
      return key
  }
}

/** Filtrlarni guruhlarga qo'llaydi (qidiruv va saralash — tableView da). */
export function applyExpenseFilters(
  groups: readonly ExpenseGroup<Expense>[],
  f: ExpenseFilters
): ExpenseGroup<Expense>[] {
  const categoryKeys = new Set(f.categories.map(nameKey))
  const min = parseAmountInput(f.minAmount)
  const max = parseAmountInput(f.maxAmount)
  return groups.filter((g) => {
    if (categoryKeys.size > 0 && !categoryKeys.has(nameKey(categoryOf(g.main)))) return false
    if (f.user && g.main.created_by !== f.user) return false
    if (f.method) {
      if (f.method === MIXED) {
        if (!g.isSplit) return false
      } else if (g.isSplit || canonical(g.main.payment_method) !== f.method) {
        return false
      }
    }
    if (min !== null && g.amount < min) return false
    if (max !== null && g.amount > max) return false
    return true
  })
}

export interface ExpenseUserOption {
  id: string
  name: string
  count: number
}

/** Davrdagi xarajatlarni kiritgan xodimlar — filtr ro'yxati uchun */
export function userOptions(groups: readonly ExpenseGroup<Expense>[]): ExpenseUserOption[] {
  const byId = new Map<string, ExpenseUserOption>()
  for (const g of groups) {
    const id = g.main.created_by
    const existing = byId.get(id)
    if (existing) {
      existing.count += 1
      continue
    }
    byId.set(id, { id, name: g.main.created_by_name || tr("Noma'lum"), count: 1 })
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "uz"))
}

/* --- Qidiruv va saralash ------------------------------------------- */

/** Qidiruv maydonlari: nomi, izohi, toifa (bazadagi va tarjimasi), xodim,
 *  to'lov turi, summa raqamlari */
export const SEARCH_FIELDS: ReadonlyArray<Accessor<ExpenseGroup<Expense>>> = [
  (g) => g.main.title,
  (g) => g.main.notes,
  (g) => categoryOf(g.main),
  (g) => tr(categoryOf(g.main)),
  (g) => g.main.created_by_name,
  (g) => methodLabelOf(g),
  (g) => String(Math.round(g.amount)),
]

/** Ustun nomi → qiymat. Nomlar jadval sarlavhasi va mobil saralash bilan bir xil */
export const SORT_ACCESSORS: Record<string, Accessor<ExpenseGroup<Expense>>> = {
  // Sana bir xil bo'lsa kiritilgan vaqt hal qiladi
  expense_date: (g) => `${g.main.expense_date || ""}T${g.main.created_at || ""}`,
  title: (g) => g.main.title,
  category: (g) => tr(categoryOf(g.main)),
  payment_method: (g) => methodLabelOf(g),
  created_by_name: (g) => g.main.created_by_name,
  amount: (g) => g.amount,
}

/** Mobil saralash tanlovi: "ustun:yo'nalish" */
export const SORT_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "expense_date:desc", label: tr("Sana — yangisi avval") },
  { value: "expense_date:asc", label: tr("Sana — eskisi avval") },
  { value: "amount:desc", label: tr("Summa — kattasi avval") },
  { value: "amount:asc", label: tr("Summa — kichigi avval") },
  { value: "title:asc", label: tr("Nomi — A dan Z gacha") },
  { value: "category:asc", label: tr("Toifa — A dan Z gacha") },
  { value: "created_by_name:asc", label: tr("Xodim — A dan Z gacha") },
]
