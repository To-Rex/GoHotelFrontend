import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

/* Tasdiqlangan qurilmalar. Xodim faqat APPROVED holatidagi qurilmadan
   kira oladi; administrator bu tekshiruvdan ozod. */

export type DeviceStatus = "PENDING" | "APPROVED" | "BLOCKED"

export interface TrustedDevice {
  id: string
  device_id: string
  label?: string | null
  status: DeviceStatus
  user_agent?: string | null
  ip_address?: string | null
  last_user_id?: string | null
  approved_at?: string | null
  first_seen_at: string
  last_seen_at?: string | null
}

export const useDevices = (status?: DeviceStatus | "") =>
  useQuery({
    queryKey: ["trustedDevices", status || ""],
    queryFn: async () => {
      const { data } = await api.get<TrustedDevice[]>("/devices/", {
        params: { status: status || undefined },
      })
      return Array.isArray(data) ? data : []
    },
    /* Tasdiq kutayotgan xodim telefon qilib turadi — ro'yxat o'zi
       yangilanib tursa administrator sahifani qayta yuklamaydi. */
    refetchInterval: 30_000,
  })

export const useSetDeviceStatus = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      status,
      label,
    }: {
      id: string
      status: DeviceStatus
      label?: string | null
    }) => {
      const { data } = await api.patch<TrustedDevice>(`/devices/${id}`, {
        status,
        label: label ?? null,
      })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trustedDevices"] }),
  })
}

export const useDeleteDevice = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/devices/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trustedDevices"] }),
  })
}
