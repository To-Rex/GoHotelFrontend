import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

/* Qabulxona xodimi to'lov turini tahrirlay oladimi — mehmonxona sozlamasi.

   Administrator va menejer bunga bog'liq emas. Yoqilganda qabulxona
   faqat oxirgi 2 kunlik to'lovlarni va bitta to'lovni ko'pi bilan
   `reception_max_edits` marta (standart 2) tahrirlaydi; har tahrir
   tarixda qoladi. O'chiq bo'lsa qabulxona umuman tahrirlay olmaydi.
   Server qoidani qayta tekshiradi (payment_edit_settings.py). */

export interface PaymentEditSettings {
  reception_enabled: boolean
  reception_max_edits: number
  allowed_max_edits?: number[]
}

export const DEFAULT_PAYMENT_EDIT_SETTINGS: PaymentEditSettings = {
  reception_enabled: false,
  reception_max_edits: 2,
  allowed_max_edits: [1, 2, 3],
}

export const usePaymentEditSettings = (enabled = true) =>
  useQuery({
    queryKey: ["paymentEditSettings"],
    enabled,
    queryFn: async () => {
      const { data } = await api.get<PaymentEditSettings>("/hotels/payment-edit-settings")
      return { ...DEFAULT_PAYMENT_EDIT_SETTINGS, ...(data || {}) }
    },
    staleTime: 5 * 60 * 1000,
    // Eski serverda endpoint yo'q — standart (o'chiq) bilan ishlayveradi
    retry: false,
  })

export const useSavePaymentEditSettings = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (next: { reception_enabled: boolean; reception_max_edits: number }) => {
      const { data } = await api.put<PaymentEditSettings>("/hotels/payment-edit-settings", next)
      return data
    },
    onSuccess: (data) =>
      qc.setQueryData(["paymentEditSettings"], { ...DEFAULT_PAYMENT_EDIT_SETTINGS, ...(data || {}) }),
  })
}
