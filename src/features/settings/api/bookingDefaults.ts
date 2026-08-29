import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

/* "Yangi bandlov" dialogining standart turi — mehmonxona bo'yicha bitta.

   Bu faqat dialog qaysi tur bilan OCHILISHINI belgilaydi: xodim dialogda
   kunlikdan soatlikka (va aksincha) avvalgidek almashtira oladi. */

export type BookingType = "DAILY" | "HOURLY"

export interface BookingDefaults {
  default_type: BookingType
  /** Xonadagi HAR BIR kishi mehmon sifatida ro'yxatga olinishi shartmi */
  require_all_guests: boolean
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
    mutationFn: async (next: {
      default_type: BookingType
      require_all_guests: boolean
    }) => {
      const { data } = await api.put<BookingDefaults>("/hotels/booking-settings", next)
      return data
    },
    onSuccess: (data) => qc.setQueryData(["bookingDefaults"], data),
  })
}

/** Sozlama hali kelmagan bo'lsa ham dialog ochilaverishi kerak. */
export const resolveBookingType = (
  settings: Pick<BookingDefaults, "default_type"> | undefined
): BookingType => (settings?.default_type === "HOURLY" ? "HOURLY" : "DAILY")
