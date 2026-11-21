import { format } from "date-fns"

import { roleLabel } from "@/features/finance/lib/paymentEdits"
import { paymentMethodLabel } from "@/lib/paymentMethods"
import { tr } from "@/i18n"
import type { Expense, ExpenseEdit, ExpensePaymentLayoutPart } from "@/types/api"
import type { ExpenseUpdatePayload } from "../api/expenses"
import type { ExpenseGroup } from "./expenseGroups"

/* Xarajatni tahrirlash qoidalari — oyna, jadvaldagi belgi va tarix uchun.

   Kim tahrirlaydi: administrator, super admin va sozlovchi (server ham
   faqat shularga ruxsat beradi — `expense_service.can_edit_expenses`).
   Kim kiritgani va QACHON kiritilgani o'zgarmaydi: xarajat o'z smenasida,
   o'z xodimining hisobotida qoladi.

   Solishtirish serverdagi bilan bir xil (`diff_snapshots`): bitta turdagi
   xarajatda summa faqat "Summa" da, to'lov turi faqat turi almashsa
   o'zgaradi; bo'lingan xarajatda bo'laklar tarkibi solishtiriladi.
   Serverga faqat o'zgargan maydonlar yuboriladi. */

/** Tarixdagi maydonlar — ekrandagi tartibda */
export const EDIT_FIELDS = ["amount", "payment", "category", "title", "expense_date", "notes"] as const
export type EditField = (typeof EDIT_FIELDS)[number]

/** Solishtiriladigan qiymatlar (xarajat yoki oynadagi holat) */
export interface ExpenseValues {
  title: string
  amount: number
  category: string | null
  /** To'lov tarkibi — katta summadan kichikka */
  payment: ExpensePaymentLayoutPart[]
  /** yyyy-MM-dd */
  expense_date: string
  notes: string | null
}

const TOLERANCE = 0.005
const round2 = (n: number) => Math.round(Number(n || 0) * 100) / 100
const clean = (v?: string | null): string | null => {
  const t = String(v ?? "").trim()
  return t ? t : null
}
const fmt = (n: number) => Number(n || 0).toLocaleString()

/** To'lov tarkibi: kod katta harfda, katta summadan kichikka (server bilan bir xil) */
export function layoutOf(
  parts: ReadonlyArray<{ payment_method: string | null; amount: number }>
): ExpensePaymentLayoutPart[] {
  return parts
    .map((p) => ({
      payment_method: String(p.payment_method || "").trim().toUpperCase(),
      amount: round2(Number(p.amount || 0)),
    }))
    .sort((a, b) => b.amount - a.amount || a.payment_method.localeCompare(b.payment_method))
}

/** Ro'yxatdagi xarajat (guruh) qiymatlari */
export function valuesOfGroup(g: ExpenseGroup<Expense>): ExpenseValues {
  const e = g.main
  return {
    title: String(e.title || "").trim(),
    amount: round2(g.amount),
    category: clean(e.category),
    payment: layoutOf(g.parts),
    expense_date: String(e.expense_date || "").slice(0, 10),
    notes: clean(e.notes),
  }
}

const samePayment = (a: ExpensePaymentLayoutPart[], b: ExpensePaymentLayoutPart[]): boolean => {
  if (a.length === 1 && b.length === 1) return a[0].payment_method === b[0].payment_method
  if (a.length !== b.length) return false
  return a.every(
    (p, i) => p.payment_method === b[i].payment_method && Math.abs(p.amount - b[i].amount) <= TOLERANCE
  )
}

/** O'zgargan maydonlar: {maydon: {old, new}} — server tarixidagi shakl */
export function diffValues(before: ExpenseValues, after: ExpenseValues): ExpenseEdit["changes"] {
  const changes: ExpenseEdit["changes"] = {}
  if (Math.abs(before.amount - after.amount) > TOLERANCE) {
    changes.amount = { old: before.amount, new: after.amount }
  }
  if (!samePayment(before.payment, after.payment)) {
    changes.payment = { old: before.payment, new: after.payment }
  }
  if (before.category !== after.category) changes.category = { old: before.category, new: after.category }
  if (before.title !== after.title) changes.title = { old: before.title, new: after.title }
  if (before.expense_date !== after.expense_date) {
    changes.expense_date = { old: before.expense_date, new: after.expense_date }
  }
  if (before.notes !== after.notes) changes.notes = { old: before.notes, new: after.notes }
  return changes
}

export const changeCount = (changes: ExpenseEdit["changes"]): number =>
  EDIT_FIELDS.filter((f) => changes[f] !== undefined).length

/** Serverga yuboriladigan tahrir — faqat o'zgarganlar; o'zgarish yo'q bo'lsa null.
 *  Summa yoki tarkib o'zgarsa ikkalasi birga ketadi (bo'lingan xarajatda server
 *  bo'laklarni talab qiladi). */
export function buildUpdatePayload(
  before: ExpenseValues,
  after: ExpenseValues,
  note?: string | null
): ExpenseUpdatePayload | null {
  const changes = diffValues(before, after)
  if (changeCount(changes) === 0) return null
  const payload: ExpenseUpdatePayload = {}
  if (changes.title) payload.title = after.title
  if (changes.category) payload.category = after.category
  if (changes.expense_date) payload.expense_date = after.expense_date
  if (changes.notes) payload.notes = after.notes
  if (changes.amount || changes.payment) {
    payload.amount = after.amount
    if (after.payment.length > 1) payload.payments = after.payment
    else if (after.payment[0]) payload.payment_method = after.payment[0].payment_method
  }
  const reason = clean(note)
  if (reason) payload.note = reason
  return payload
}

/** Naqd qism (kassaga ta'sir qiladigan qism) */
export const cashOf = (payment: ReadonlyArray<ExpensePaymentLayoutPart>): number =>
  round2(payment.filter((p) => p.payment_method === "CASH").reduce((s, p) => s + p.amount, 0))

/* --- Ko'rsatish ------------------------------------------------------ */

/** Xarajatning tahrirlari (eng eskisi birinchi); buzilgan yozuvlar tashlanadi */
export function editsOf(e: Pick<Expense, "edit_history"> | null | undefined): ExpenseEdit[] {
  const raw = e?.edit_history
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (x): x is ExpenseEdit => !!x && typeof x === "object" && !!x.changes && typeof x.changes === "object"
  )
}

export const FIELD_LABELS: Record<EditField, string> = {
  amount: tr("Summa"),
  payment: tr("To'lov turi"),
  category: tr("Toifa"),
  title: tr("Nomi"),
  expense_date: tr("Sana"),
  notes: tr("Izoh"),
}

/** "Naqd pul" yoki "Naqd pul 60,000 + Online to'lov 40,000" */
export function layoutLabel(payment: ReadonlyArray<ExpensePaymentLayoutPart> | null | undefined): string {
  const parts = payment ?? []
  if (parts.length === 0) return "—"
  if (parts.length === 1) return paymentMethodLabel(parts[0].payment_method)
  return parts.map((p) => `${paymentMethodLabel(p.payment_method)} ${fmt(p.amount)}`).join(" + ")
}

/** Maydon qiymati matn ko'rinishida */
export function fieldText(field: EditField, value: unknown): string {
  switch (field) {
    case "amount":
      return tr("{{amount}} So'm", { amount: fmt(Number(value || 0)) })
    case "payment":
      return layoutLabel(Array.isArray(value) ? (value as ExpensePaymentLayoutPart[]) : [])
    case "category":
      return value ? tr(String(value)) : tr("toifasiz")
    default:
      return value === null || value === undefined || value === "" ? "—" : String(value)
  }
}

export interface ChangeRow {
  field: EditField
  label: string
  old: string
  new: string
}

/** O'zgarishlar ro'yxati — ekrandagi tartibda */
export function changeRows(changes: ExpenseEdit["changes"]): ChangeRow[] {
  return EDIT_FIELDS.flatMap((field) => {
    const c = changes[field] as { old: unknown; new: unknown } | undefined
    if (!c) return []
    return [{ field, label: FIELD_LABELS[field], old: fieldText(field, c.old), new: fieldText(field, c.new) }]
  })
}

export function editMoment(at?: string | null): string {
  if (!at) return ""
  const d = new Date(at)
  return Number.isNaN(d.getTime()) ? "" : format(d, "dd.MM.yyyy HH:mm")
}

/** "Aziz Karimov (Administrator)" */
export function editWho(edit: Pick<ExpenseEdit, "by_name" | "by_role">): string {
  const role = roleLabel(edit.by_role)
  const name = clean(edit.by_name)
  if (name) return role ? `${name} (${role})` : name
  return role || tr("Noma'lum")
}

/** Jadvaldagi belgi matni: summa o'zgargan bo'lsa "100,000 → 85,000",
 *  aks holda o'zgargan maydonlar nomi */
export function editBadgeText(edit: ExpenseEdit): string {
  const amount = edit.changes.amount
  if (amount) return `${fmt(amount.old)} → ${fmt(amount.new)}`
  const rows = changeRows(edit.changes)
  if (rows.length === 0) return tr("Tahrirlangan")
  return rows.map((r) => r.label).join(", ")
}

/** Belgi ustiga borganda: har tahrir alohida satrda */
export function editsTitle(edits: ExpenseEdit[]): string {
  return edits
    .map((e) => {
      const what = changeRows(e.changes)
        .map((r) => `${r.label}: ${r.old} → ${r.new}`)
        .join("; ")
      return [what, editWho(e), editMoment(e.at), clean(e.note)].filter(Boolean).join(" — ")
    })
    .join("\n")
}
