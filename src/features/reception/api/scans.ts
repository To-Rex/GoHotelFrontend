import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { ScannedDoc } from "@/features/guests/components/documentScannerTypes"
import { api } from "@/lib/api"

/**
 * Telefonda skanerlangan hujjatlar.
 *
 * Resepsiya xodimi mehmonning pasportini telefonda suratga oladi, server
 * uni o'qiydi va natija shu yerda paydo bo'ladi. Veb ekrani buni ko'rib
 * yangi bandlov oynasini o'zi ochadi — xodim kompyuterga o'tib
 * ma'lumotlarni qaytadan terib o'tirmaydi.
 *
 * Qoidalar backendda: `document_scan_service.py`.
 */

export interface DocumentScan {
  id: string
  document_type: "ID_CARD" | "PASSPORT"
  document_number: string | null
  full_name: string | null
  guest_id: string | null
  guest_name: string | null
  /** Hujjat raqami bo'yicha mehmon bazadan topildimi */
  matched: boolean
  /** Skaner o'qishni to'liq tasdiqladimi (MRZ nazorat raqamlari) */
  verified: boolean
  /** Skanerdan chiqqan maydonlar — bandlov oynasi shundan to'ldiriladi */
  document: ScannedDoc
  created_at: string | null
  acknowledged: boolean
}

const BASE = "/reception/scans"

export const useDocumentScans = (enabled = true, pollMs = 6000) =>
  useQuery({
    queryKey: ["documentScans"],
    queryFn: async () => {
      const { data } = await api.get<DocumentScan[]>(BASE)
      return Array.isArray(data) ? data : []
    },
    enabled,
    refetchInterval: enabled ? pollMs : false,
    // Skaner — tez o'tadigan hodisa: eski javob ko'rsatilmasin
    staleTime: 0,
  })

export const useAcknowledgeScan = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<DocumentScan>(`${BASE}/${id}/ack`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documentScans"] }),
  })
}
