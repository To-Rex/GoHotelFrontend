import type {
  FeedbackPriority,
  FeedbackStatus,
  FeedbackType,
  GuestFeedback,
} from "@/types/api"

/* Talab, taklif va shikoyatlar — nomlar, ranglar va qoidalar bir joyda.

   Holat o'tishlari va ruxsat kodlari backend
   app/application/services/feedback_service.py bilan BIR XIL bo'lishi kerak:
   sahifa tugmani ko'rsatsa, server ham o'sha o'tishga ruxsat bersin. */

export const TYPE_LABELS: Record<FeedbackType, string> = {
  REQUEST: "Talab",
  SUGGESTION: "Taklif",
  COMPLAINT: "Shikoyat",
}

export const STATUS_LABELS: Record<FeedbackStatus, string> = {
  NEW: "Yangi",
  IN_PROGRESS: "Ko'rib chiqilmoqda",
  RESOLVED: "Hal qilindi",
  REJECTED: "Rad etildi",
}

export const PRIORITY_LABELS: Record<FeedbackPriority, string> = {
  LOW: "Past",
  MEDIUM: "O'rta",
  HIGH: "Yuqori",
}

export const TYPE_STYLES: Record<FeedbackType, string> = {
  REQUEST: "border-sky-200 bg-sky-50 text-sky-700",
  SUGGESTION: "border-violet-200 bg-violet-50 text-violet-700",
  COMPLAINT: "border-red-200 bg-red-50 text-red-700",
}

export const STATUS_STYLES: Record<FeedbackStatus, string> = {
  NEW: "border-amber-200 bg-amber-50 text-amber-700",
  IN_PROGRESS: "border-blue-200 bg-blue-50 text-blue-700",
  RESOLVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-gray-200 bg-gray-100 text-gray-600",
}

export const PRIORITY_STYLES: Record<FeedbackPriority, string> = {
  LOW: "border-gray-200 bg-gray-50 text-gray-500",
  MEDIUM: "border-gray-200 bg-gray-50 text-gray-600",
  HIGH: "border-orange-200 bg-orange-50 text-orange-700",
}

/* Backend'dagi kirish qoidalari (feedback_service.VIEW/CREATE/MANAGE_CODES).
   Qabulxona va menejer yangi ruxsatsiz ishlaydi; farrosh/texnik ko'rmaydi. */
export const FEEDBACK_VIEW_CODES = [
  "feedback.view",
  "feedback.create",
  "feedback.manage",
  "reservation.create",
  "reservation.update",
  "reservation.view",
  "shift.force_close",
]
export const FEEDBACK_CREATE_CODES = [
  "feedback.create",
  "feedback.manage",
  "reservation.create",
  "reservation.update",
  "shift.force_close",
]
export const FEEDBACK_MANAGE_CODES = [
  "feedback.manage",
  "reservation.update",
  "shift.force_close",
]

// feedback_service.TRANSITIONS bilan bir xil
export const TRANSITIONS: Record<FeedbackStatus, FeedbackStatus[]> = {
  NEW: ["IN_PROGRESS", "RESOLVED", "REJECTED"],
  IN_PROGRESS: ["RESOLVED", "REJECTED"],
  RESOLVED: ["IN_PROGRESS"],
  REJECTED: ["IN_PROGRESS"],
}

export const isClosed = (status: FeedbackStatus): boolean =>
  status === "RESOLVED" || status === "REJECTED"

export const nextStatuses = (status: FeedbackStatus): FeedbackStatus[] =>
  TRANSITIONS[status] ?? []

/** Yopishda javob matni shart — server ham shuni talab qiladi */
export const requiresResolution = (status: FeedbackStatus): boolean =>
  isClosed(status)

/** Shikoyat standart holda yuqori muhimlikda — u kutib turmaydi */
export const defaultPriorityFor = (type: FeedbackType): FeedbackPriority =>
  type === "COMPLAINT" ? "HIGH" : "MEDIUM"

export type StatusTab = "ALL" | "OPEN" | FeedbackStatus

export interface FeedbackFilter {
  tab: StatusTab
  type: FeedbackType | "ALL"
  query: string
}

/** Ro'yxat filtri — ochiq/holat + tur + matn qidiruvi (ism, telefon, xona ham) */
export function filterFeedback(
  items: GuestFeedback[],
  filter: FeedbackFilter
): GuestFeedback[] {
  const q = filter.query.trim().toLowerCase()
  return items.filter((item) => {
    if (filter.tab === "OPEN") {
      if (isClosed(item.status)) return false
    } else if (filter.tab !== "ALL" && item.status !== filter.tab) {
      return false
    }
    if (filter.type !== "ALL" && item.feedback_type !== filter.type) return false
    if (!q) return true
    return [
      item.subject,
      item.body,
      item.guest_name,
      item.guest_phone,
      item.room_number,
      item.assigned_to_name,
    ].some((v) => (v || "").toLowerCase().includes(q))
  })
}

export type StatusCounts = Record<StatusTab, number>

export function countByStatus(items: GuestFeedback[]): StatusCounts {
  const counts: StatusCounts = {
    ALL: items.length,
    OPEN: 0,
    NEW: 0,
    IN_PROGRESS: 0,
    RESOLVED: 0,
    REJECTED: 0,
  }
  for (const item of items) {
    counts[item.status] += 1
    if (!isClosed(item.status)) counts.OPEN += 1
  }
  return counts
}
