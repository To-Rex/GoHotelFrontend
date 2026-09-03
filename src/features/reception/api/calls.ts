import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"

/**
 * Qabulxona telefoniga kelgan qo'ng'iroqlar.
 *
 * Mehmon qo'ng'iroq qilganda resepsiya qurilmasi (Android) raqamni
 * serverga yuboradi, server uni bazadan qidiradi va natija shu yerda —
 * navbardagi menyuda ko'rinadi. Xodim go'shakni ko'targanda kim
 * gapirayotganini biladi.
 *
 * Qoidalar backendda: `incoming_call_service.py`.
 */

export interface IncomingCall {
  id: string
  phone: string
  guest_id: string | null
  guest_name: string | null
  reservation_id: string | null
  room_number: string | null
  /** Raqam bo'yicha mehmon topildimi */
  matched: boolean
  received_at: string | null
  acknowledged: boolean
}

const BASE = "/reception/calls"

export const useIncomingCalls = (enabled = true, pollMs = 8000) =>
  useQuery({
    queryKey: ["incomingCalls"],
    queryFn: async () => {
      const { data } = await api.get<IncomingCall[]>(BASE)
      return Array.isArray(data) ? data : []
    },
    enabled,
    refetchInterval: enabled ? pollMs : false,
    // Qo'ng'iroq — tez o'tadigan hodisa: eski javob ko'rsatilmasin
    staleTime: 0,
  })

export const useAcknowledgeCall = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<IncomingCall>(`${BASE}/${id}/ack`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["incomingCalls"] }),
  })
}
