import { PAYMENT_METHOD_LABELS } from "@/lib/paymentMethods"

/* Qisman (aralash) to'lovli xarajat ro'yxatda BITTA qator.

   Serverda bunday xarajat bo'laklarga bo'lib yoziladi: 100 000 so'm →
   60 000 naqd + 40 000 online, ikkala qator bitta `split_group` bilan.
   Hisobotlar uchun shu qulay (har bo'lakning o'z to'lov turi), odamga
   esa bitta xarajat kerak. Bu yerda bo'laklar yig'iladi: summa —
   yig'indi, to'lov turi — bo'laklar ro'yxati. */

export interface SplitLike {
  id: string
  amount: number
  payment_method: string | null
  split_group?: string | null
}

export interface ExpenseGroup<T extends SplitLike> {
  /** React kaliti: guruh yoki qator id si */
  key: string
  /** Asosiy qator — umumiy maydonlar (nom, toifa, sana, kim) shundan olinadi */
  main: T
  /** Barcha bo'laklar (oddiy xarajatda — bitta) */
  parts: T[]
  /** Bo'laklar yig'indisi */
  amount: number
  /** Ikki va undan ko'p to'lov turi */
  isSplit: boolean
}

/** Qatorlarni guruhlaydi; tartib — guruhning birinchi qatori tartibi. */
export function groupExpenses<T extends SplitLike>(rows: readonly T[]): ExpenseGroup<T>[] {
  const groups: ExpenseGroup<T>[] = []
  const byKey = new Map<string, ExpenseGroup<T>>()
  for (const row of rows) {
    const key = row.split_group || row.id
    const existing = byKey.get(key)
    if (existing) {
      existing.parts.push(row)
      existing.amount += Number(row.amount || 0)
      existing.isSplit = existing.parts.length > 1
      continue
    }
    const group: ExpenseGroup<T> = {
      key,
      main: row,
      parts: [row],
      amount: Number(row.amount || 0),
      isSplit: false,
    }
    byKey.set(key, group)
    groups.push(group)
  }
  // Bo'laklar katta summadan kichikka — "60 000 naqd + 40 000 online"
  for (const g of groups) {
    if (g.isSplit) g.parts.sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
  }
  return groups
}

const fmt = (n: number) => Number(n || 0).toLocaleString()

/** "Naqd pul 60,000 + Online to'lov 40,000" — bo'laklar bitta satrda */
export function partsLabel<T extends SplitLike>(group: ExpenseGroup<T>, separator = " + "): string {
  return group.parts
    .map((p) => `${PAYMENT_METHOD_LABELS[p.payment_method || ""] || p.payment_method || "—"} ${fmt(Number(p.amount || 0))}`)
    .join(separator)
}
