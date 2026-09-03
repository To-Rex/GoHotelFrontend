import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"

/**
 * Vazifa bandlari — farrosh mobil ilovada belgilaydigan ish ro'yxati.
 *
 * Administrator turlar bo'yicha standart bandlarni yozib qo'yadi
 * ("Xonani tozalash", "Shampun va sovunni almashtirish"). Har yangi
 * vazifa ochilganda ular vazifaning o'z ro'yxatiga NUSXA bo'lib tushadi,
 * ya'ni bu yerdagi tahrir ochilgan vazifalarni buzmaydi.
 *
 * Qoidalar backendda: `checklist_template_service.py`.
 */

export interface ChecklistTemplate {
  id: string
  task_type: string
  title: string
  sort_order: number
  is_active: boolean
}

/** Vazifa turlari — backenddagi `TASK_TYPES` bilan bir xil. */
export const CHECKLIST_TASK_TYPES = [
  { key: "CLEANING", label: "Tozalash" },
  { key: "DEEP_CLEANING", label: "Chuqur tozalash" },
  { key: "MAINTENANCE", label: "Ta'mirlash" },
  { key: "INSPECTION", label: "Tekshiruv" },
  { key: "TURN_DOWN", label: "Kechki tayyorlash" },
] as const

const BASE = "/housekeeping/checklist-templates"

export const useChecklistTemplates = (taskType?: string) =>
  useQuery({
    queryKey: ["checklistTemplates", taskType],
    queryFn: async () => {
      const { data } = await api.get<ChecklistTemplate[]>(BASE, {
        params: { task_type: taskType || undefined },
      })
      return Array.isArray(data) ? data : []
    },
  })

/**
 * Standart bandlar — mehmonxona o'z ro'yxatini kiritmagan bo'lsa shular
 * ishlatiladi. Administratorga namuna sifatida ko'rsatiladi: "shundan
 * boshlab tahrirlang".
 */
export const useChecklistDefaults = () =>
  useQuery({
    queryKey: ["checklistTemplateDefaults"],
    queryFn: async () => {
      const { data } = await api.get<Record<string, string[]>>(`${BASE}/defaults`)
      return data || {}
    },
    // Standart ro'yxat o'zgarmaydi — qayta so'rashning hojati yo'q
    staleTime: Infinity,
  })

const invalidate = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["checklistTemplates"] })
}

/** Turdagi barcha bandlarni bir yo'la almashtiradi. */
export const useReplaceChecklistTemplates = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { taskType: string; titles: string[] }) => {
      const { data } = await api.put<ChecklistTemplate[]>(`${BASE}/replace`, {
        task_type: payload.taskType,
        titles: payload.titles,
      })
      return data
    },
    onSuccess: () => invalidate(qc),
  })
}

export const useUpdateChecklistTemplate = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      id: string
      title?: string
      is_active?: boolean
      sort_order?: number
    }) => {
      const { id, ...body } = payload
      const { data } = await api.put<ChecklistTemplate>(`${BASE}/${id}`, body)
      return data
    },
    onSuccess: () => invalidate(qc),
  })
}
