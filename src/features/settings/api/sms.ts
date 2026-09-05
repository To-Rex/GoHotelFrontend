import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"

/**
 * Filial SMS sozlamalari (Xabarchi).
 *
 * Har filialga alohida API kalit: bron yaratilganda va to'lov qabul
 * qilinganda mijozga SMS o'sha filialning kaliti bilan yuboriladi.
 * Kalit serverda shifrlangan saqlanadi — bu yerga faqat niqoblangan
 * ko'rinishi keladi.
 */

export interface BranchSmsStatus {
  configured: boolean
  key_hint: string | null
}

export const useBranchSms = (branchId?: string) =>
  useQuery({
    queryKey: ["branchSms", branchId],
    queryFn: async () => {
      const { data } = await api.get<BranchSmsStatus>(`/branches/${branchId}/sms`)
      return data
    },
    enabled: !!branchId,
  })

export const useSaveBranchSms = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ branchId, apiKey }: { branchId: string; apiKey: string }) => {
      const { data } = await api.put<BranchSmsStatus>(`/branches/${branchId}/sms`, {
        api_key: apiKey,
      })
      return data
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["branchSms", vars.branchId] }),
  })
}

export const useDeleteBranchSms = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (branchId: string) => {
      const { data } = await api.delete<BranchSmsStatus>(`/branches/${branchId}/sms`)
      return data
    },
    onSuccess: (_d, branchId) =>
      qc.invalidateQueries({ queryKey: ["branchSms", branchId] }),
  })
}

export const useTestBranchSms = () =>
  useMutation({
    mutationFn: async ({ branchId, phone }: { branchId: string; phone: string }) => {
      const { data } = await api.post<{ ok: boolean; phone: string }>(
        `/branches/${branchId}/sms/test`,
        { phone }
      )
      return data
    },
  })
