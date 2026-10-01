import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

/* Ish vaqti nazorati — mehmonxona bo'yicha bitta sozlama.

   Yoqilsa, xodim o'z ish vaqtidan tashqarida tizimda ishlay olmaydi.
   Qaror SERVERDA qabul qilinadi (har so'rovda tekshiriladi); bu yerda
   faqat sozlamaning o'zi o'qiladi va saqlanadi. Mustasnolar:
   administratorlar, "ish vaqtidan tashqari ham ishlay oladi" belgili
   xodimlar va kassasi ochiq resepshn xodimi ("Davom etish" oqimi).

   Standart holat — O'CHIQ: yoqilmaguncha hamma avvalgidek ishlaydi. */

export interface WorkHoursSettings {
  /** Ish vaqtidan tashqarida ishlash taqiqlanganmi */
  enforce: boolean
}

export const WORK_HOURS_SETTINGS_QUERY_KEY = ["workHoursSettings"] as const

/** Server javobini xavfsiz o'qish: faqat aniq `true` — yoqilgan. */
export const resolveWorkHoursSettings = (raw: unknown): WorkHoursSettings => ({
  enforce:
    !!raw &&
    typeof raw === "object" &&
    (raw as { enforce?: unknown }).enforce === true,
})

export const useWorkHoursSettings = (enabled = true) =>
  useQuery({
    queryKey: WORK_HOURS_SETTINGS_QUERY_KEY,
    queryFn: async () => {
      const { data } = await api.get<WorkHoursSettings>(
        "/hotels/work-hours-settings"
      )
      return resolveWorkHoursSettings(data)
    },
    enabled,
    // Kamdan-kam o'zgaradi
    staleTime: 5 * 60 * 1000,
  })

export const useSaveWorkHoursSettings = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (next: WorkHoursSettings) => {
      const { data } = await api.put<WorkHoursSettings>(
        "/hotels/work-hours-settings",
        { enforce: next.enforce === true }
      )
      return resolveWorkHoursSettings(data)
    },
    onSuccess: (data) => qc.setQueryData(WORK_HOURS_SETTINGS_QUERY_KEY, data),
  })
}
