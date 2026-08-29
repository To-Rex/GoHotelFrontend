import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

/* "Yangi bandlov" dialogining standart turi — mehmonxona bo'yicha bitta.

   Bu faqat dialog qaysi tur bilan OCHILISHINI belgilaydi: xodim dialogda
   kunlikdan soatlikka (va aksincha) avvalgidek almashtira oladi. */

export type BookingType = "DAILY" | "HOURLY"

export interface BookingDefaults {
  default_type: BookingType
}

export const useBookingDefaults = () =>
  useQuery({
    queryKey: ["bookingDefaults"],
    queryFn: async () => {
      const { data } = await api.get<BookingDefaults>("/hotels/booking-settings")
      return data
    },
    // Kamdan-kam o'zgaradi — har dialog ochilganda qayta so'ralmasin
    staleTime: 5 * 60 * 1000,
  })

export const useSaveBookingDefaults = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (defaultType: BookingType) => {
      const { data } = await api.put<BookingDefaults>("/hotels/booking-settings", {
        default_type: defaultType,
      })
      return data
    },
    onSuccess: (data) => qc.setQueryData(["bookingDefaults"], data),
  })
}

/** Sozlama hali kelmagan bo'lsa ham dialog ochilaverishi kerak. */
export const resolveBookingType = (
  settings: BookingDefaults | undefined
): BookingType => (settings?.default_type === "HOURLY" ? "HOURLY" : "DAILY")
