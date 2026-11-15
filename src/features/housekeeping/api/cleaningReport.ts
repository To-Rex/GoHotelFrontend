import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"
import { tr } from "@/i18n"

/* Chiqishlar va tozalashlarni solishtirish — GET /housekeeping/cleaning-report.

   Asos — davrda CHIQIB KETGAN bronlar; har biri uchun tozalash vazifasi
   farrosh tomonidan yakunlandimi, vaqt o'tgani uchun avtomatik yopildimi,
   hali ochiqmi, bekor qilindimi yoki umuman ochilmadimi. Qoidalar
   backendda: `cleaning_report_service.py`.

   Bir hook ikki joyda: Xo'jalik ishlari → "Tozalash hisoboti" oynasi va
   Boshqaruv sahifasidagi karta. Kalit bir xil — bir davr ikki marta
   so'ralmaydi. */

export interface CleanerRow {
  user_id: string | null
  name: string | null
  total: number
  by_person: number
  auto: number
  avg_minutes: number | null
}

export interface RoomRow {
  room_number: string
  checkouts: number
  auto: number
  no_task: number
  avg_minutes: number | null
}

export interface CleaningSummary {
  checkouts: number
  with_task: number
  cleaned_by_person: number
  auto_closed: number
  still_open: number
  cancelled: number
  no_task: number
  avg_wait_minutes: number | null
  avg_work_minutes: number | null
  verified_percent: number | null
}

export interface CleaningReport {
  date_from: string
  date_to: string
  summary: CleaningSummary
  cleaners: CleanerRow[]
  rooms: RoomRow[]
}

export const useCleaningReport = (from: string, to: string, enabled = true) =>
  useQuery({
    queryKey: ["cleaningReport", from, to],
    enabled: enabled && !!from && !!to,
    queryFn: async () => {
      const { data } = await api.get<CleaningReport>("/housekeeping/cleaning-report", {
        params: { date_from: from, date_to: to },
      })
      return data
    },
  })

/** Daqiqalar odamga qulay ko'rinishda: "45 daq", "1 soat 20 daq" */
export const formatMinutes = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return "—"
  if (v < 60) return tr("{{v}} daq", { v })
  const h = Math.floor(v / 60)
  const m = Math.round(v % 60)
  return m ? tr("{{h}} soat {{m}} daq", { h, m }) : tr("{{h}} soat", { h })
}

export type SegmentKey = "by_person" | "auto" | "open" | "cancelled" | "no_task"

export interface Segment {
  key: SegmentKey
  count: number
  /** 0–100, yaxlitlangan; nol bo'laklar ro'yxatga kirmaydi */
  percent: number
}

/** Chiqishlarning taqsimoti — ulush chizig'i uchun. Yig'indisi `checkouts`
 *  ga teng (serverda har chiqish aynan bitta guruhga tushadi). */
export function cleaningSegments(s: CleaningSummary): Segment[] {
  const total = s.checkouts
  if (!total) return []
  const parts: Array<[SegmentKey, number]> = [
    ["by_person", s.cleaned_by_person],
    ["auto", s.auto_closed],
    ["open", s.still_open],
    ["cancelled", s.cancelled],
    ["no_task", s.no_task],
  ]
  return parts
    .filter(([, count]) => count > 0)
    .map(([key, count]) => ({ key, count, percent: Math.round((count / total) * 1000) / 10 }))
}

/** Holat bahosi: "good" — 80% dan ko'pini farrosh o'zi tasdiqlagan va
 *  vazifasiz chiqish yo'q; "bad" — yarmidan kami tasdiqlangan; qolgani "warn". */
export function cleaningHealth(s: CleaningSummary): "good" | "warn" | "bad" | "none" {
  if (!s.checkouts || s.verified_percent === null) return "none"
  if (s.verified_percent >= 80 && s.no_task === 0) return "good"
  if (s.verified_percent < 50) return "bad"
  return "warn"
}
