import type { PaymentRecord } from "@/types/api"

/* To'lov turini tahrirlash qoidasi — server bilan AYNAN bir xil:
   admin/super admin cheklovsiz; menejer (`shift.force_close`) faqat oxirgi
   2 kunlik to'lovlar. Tugma shu qoida bilan ko'rsatiladi/yashiriladi;
   server baribir hamma tekshiruvni qayta bajaradi (himoya ikki qatlam). */

export const MANAGER_EDIT_WINDOW_HOURS = 48

/** To'lov yaratilganiga 48 soat bo'lganmi (menejer oynasi). */
export const isWithinManagerWindow = (
  createdAt: string | null | undefined,
  now: Date = new Date()
): boolean => {
  if (!createdAt) return false
  const created = new Date(createdAt)
  if (Number.isNaN(created.getTime())) return false
  const ageMs = now.getTime() - created.getTime()
  return ageMs >= 0 && ageMs <= MANAGER_EDIT_WINDOW_HOURS * 60 * 60 * 1000
}

/** To'lov turini tahrirlash mumkinmi (joriy foydalanuvchi uchun). */
export const canEditPaymentMethod = ({
  payment,
  isAdmin,
  canForceClose,
  now,
}: {
  payment: Pick<PaymentRecord, "created_at">
  isAdmin: boolean
  canForceClose: boolean
  now?: Date
}): boolean => {
  if (isAdmin) return true
  if (!canForceClose) return false
  return isWithinManagerWindow(payment.created_at, now)
}

/** Qisman o'tkazish summasini o'qish va tekshirish.
 *
 *  `0 < amount <= total` bo'lishi shart; `total` ga teng bo'lsa server
 *  buni oddiy (to'liq) tahrir deb oladi. Xato bo'lsa `amount: null` va
 *  sabab qaytadi ("nan" — bo'sh/buzuq, "range" — summadan katta/noto'g'ri).
 */
export const parsePartialAmount = (
  total: number,
  raw: string
): { amount: number | null; error: "nan" | "range" | null } => {
  const text = (raw || "").trim()
  if (!text) return { amount: null, error: "nan" }
  const value = Number(text.replace(/\s/g, "").replace(",", "."))
  if (!Number.isFinite(value) || value <= 0) return { amount: null, error: "nan" }
  if (value > total) return { amount: null, error: "range" }
  return { amount: value, error: null }
}
