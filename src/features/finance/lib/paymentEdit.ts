import type { PaymentRecord } from "@/types/api"

/* To'lov turini tahrirlash qoidasi — server bilan AYNAN bir xil
   (finance_service + payment_edit_settings):
   admin/super admin cheklovsiz; menejer (`shift.force_close`) faqat oxirgi
   2 kunlik to'lovlar; qabulxona (`finance.payment.create`) — faqat
   mehmonxona sozlamasi yoqilgan bo'lsa, o'sha 2 kunlik oyna va bitta
   to'lovni ko'pi bilan N marta (to'lovdagi barcha tahrirlar sanaladi).
   Tugma shu qoida bilan ko'rsatiladi/yashiriladi; server baribir hamma
   tekshiruvni qayta bajaradi (himoya ikki qatlam). */

export const MANAGER_EDIT_WINDOW_HOURS = 48

/** Qabulxona uchun amaldagi sozlama (yo'q — tahrirlay olmaydi) */
export interface ReceptionEditRules {
  enabled: boolean
  maxEdits: number
}

/** To'lov necha marta tahrirlangan: butun va qisman tahrirlar (eski,
 *  `kind` siz yozuvlar ham); ajralgan qatorning `split_from` yozuvi emas.
 *  Server `edit_count` bilan bir xil. */
export const editCount = (payment: Pick<PaymentRecord, "method_changes">): number =>
  (Array.isArray(payment.method_changes) ? payment.method_changes : []).filter(
    (e) => !!e && typeof e === "object" && e.kind !== "split_from"
  ).length

/** Nega tahrirlab bo'lmaydi: null — mumkin */
export type EditBlock = "forbidden" | "disabled" | "window" | "limit"

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

export interface EditAccess {
  payment: Pick<PaymentRecord, "created_at" | "method_changes">
  isAdmin: boolean
  canForceClose: boolean
  /** Qabulxona: to'lov qabul qila oladi (`finance.payment.create`) */
  canTakePayments?: boolean
  /** Qabulxona uchun sozlama; berilmasa — qabulxona tahrirlay olmaydi */
  reception?: ReceptionEditRules | null
  now?: Date
}

/** Nega tahrirlab bo'lmaydi (null — mumkin). Tartib serverdagidek:
 *  admin → menejer (oyna) → qabulxona (sozlama → chegara → oyna). */
export const paymentEditBlock = ({
  payment,
  isAdmin,
  canForceClose,
  canTakePayments = false,
  reception,
  now,
}: EditAccess): EditBlock | null => {
  if (isAdmin) return null
  if (canForceClose) return isWithinManagerWindow(payment.created_at, now) ? null : "window"
  if (!canTakePayments) return "forbidden"
  if (!reception?.enabled) return "disabled"
  if (editCount(payment) >= reception.maxEdits) return "limit"
  return isWithinManagerWindow(payment.created_at, now) ? null : "window"
}

/** To'lov turini tahrirlash mumkinmi (joriy foydalanuvchi uchun). */
export const canEditPaymentMethod = (access: EditAccess): boolean =>
  paymentEditBlock(access) === null

/** Qabulxonaga qolgan tahrir imkoniyati (admin/menejerda null — chegara yo'q) */
export const remainingEdits = (
  payment: Pick<PaymentRecord, "method_changes">,
  reception: ReceptionEditRules | null | undefined,
  isReception: boolean
): number | null => {
  if (!isReception || !reception?.enabled) return null
  return Math.max(0, reception.maxEdits - editCount(payment))
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
