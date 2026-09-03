import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"

/**
 * Xodim xabar bergan muammolar (`/problems`).
 *
 * Farrosh mobil ilovadan "muammo haqida xabar berish" tugmasi orqali
 * yuboradi: singan jihoz, tugagan buyum, ishlamayotgan qulf. Ilgari bu
 * xabarlar bazaga tushardi-yu, boshqaruv ularni hech qayerda ko'rmasdi.
 */

export type ProblemStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED"

export interface Problem {
  id: string
  category: string
  description: string
  status: ProblemStatus
  room_number?: string | null
  task_id?: string | null
  reported_by: string
  reported_by_name?: string | null
  created_at?: string | null
}

/** Muammo turlari — mobil ilovadagi ro'yxat bilan bir xil. */
export const PROBLEM_CATEGORIES: Record<string, string> = {
  MAINTENANCE: "Ta'mir kerak",
  EQUIPMENT: "Jihoz nosozligi",
  SUPPLIES: "Buyum tugagan",
  CLEANING: "Tozalash muammosi",
  SAFETY: "Xavfsizlik",
  OTHER: "Boshqa",
}

export const PROBLEM_STATUSES: Array<{ key: ProblemStatus; label: string }> = [
  { key: "OPEN", label: "Ochiq" },
  { key: "IN_PROGRESS", label: "Bajarilmoqda" },
  { key: "RESOLVED", label: "Hal qilindi" },
]

export const useProblems = (status?: ProblemStatus | "", enabled = true) =>
  useQuery({
    queryKey: ["problems", status || "all"],
    queryFn: async () => {
      const { data } = await api.get<Problem[]>("/problems", {
        params: { status: status || undefined, limit: 200 },
      })
      return Array.isArray(data) ? data : []
    },
    enabled,
    // Xabar kelganda uzoq kutib qolmasin — sahifa ochiq turganda yangilanadi
    refetchInterval: enabled ? 60_000 : false,
  })

export const useUpdateProblemStatus = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { id: string; status: ProblemStatus }) => {
      const { data } = await api.patch<{ id: string; status: ProblemStatus }>(
        `/problems/${payload.id}/status`,
        { status: payload.status }
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["problems"] }),
  })
}
