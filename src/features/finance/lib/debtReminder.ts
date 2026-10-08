import type { DebtorReservation } from "../api/debtors"

/* Veb eslatmasi qoidalari (sof funksiyalar — testlangan).

   * Davriy eslatma — sozlamadagi oraliqda, qarz bor ekan. Oxirgi eslatma
     vaqti brauzerda saqlanadi: sahifa yangilansa qayta chiqib ketmasin.
   * Yangi qarz — oldingi so'rovda bo'lmagan qarzdor paydo bo'lsa (masalan
     mehmon qarz bilan avtomatik chiqib ketdi) — darhol. Birinchi so'rovda
     emas: sahifa ochilganda barcha eski qarzlar "yangi" bo'lib ko'rinardi. */

export function shouldRemind(
  lastAt: number | null,
  now: number,
  intervalMinutes: number,
  enabled: boolean,
  count: number
): boolean {
  if (!enabled || count <= 0) return false
  if (lastAt === null) return true
  return now - lastAt >= Math.max(intervalMinutes, 1) * 60_000
}

export function newDebtors(
  previous: Set<string> | null,
  items: DebtorReservation[]
): DebtorReservation[] {
  if (previous === null) return []
  return items.filter((item) => !previous.has(item.id))
}

/** Eng katta va eng eski qarzlar yuqorida — eslatmada birinchi ko'rinadi */
export function rankDebtors(items: DebtorReservation[]): DebtorReservation[] {
  return [...items].sort(
    (a, b) =>
      (b.overdue_days || 0) - (a.overdue_days || 0) || b.debt_amount - a.debt_amount
  )
}
