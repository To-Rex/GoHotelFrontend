import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"
import type { FiscalConfig, FiscalStamp } from "../lib/epos"

/* Fiskal modul (E-POS) — server tomoni: sozlama va fiskal cheklar navbati.
   Sozlama har FILIAL uchun alohida (joriy filial). */

export type FiscalStatus = "pending" | "sent" | "done" | "failed" | "skipped"

export interface FiscalReceipt extends Partial<FiscalStamp> {
  id: string
  kind: "sale" | "advance" | "refund"
  source: "RESERVATION" | "SHOP"
  number: string
  title: string | null
  amount: number
  cash_amount: number
  card_amount: number
  status: FiscalStatus
  attempts: number
  error: string | null
  invoice_id: string | null
  reservation_id: string | null
  shop_sale_id: string | null
  refund_of_id: string | null
  created_at: string | null
  completed_at: string | null
}

export interface ClaimedReceipt extends FiscalReceipt {
  /** E-POS so'rovi (token bilan); bajarilgan chekda `null` */
  request: Record<string, unknown> | null
  /** Avval yuborilgan bo'lishi mumkin — avval E-POS'dan tekshirish kerak */
  verify: boolean
}

export interface FiscalTarget {
  source: "RESERVATION" | "SHOP"
  invoice_id?: string
  reservation_id?: string
  sale_id?: string
}

export interface FiscalPending {
  enabled: boolean
  targets: FiscalTarget[]
  receipts: FiscalReceipt[]
  count: number
}

export type FiscalItemKind = "room" | "service" | "penalty" | "shop"

export interface FiscalSettings {
  enabled: boolean
  transport: "browser" | "server"
  url: string
  /** Token kiritilganmi va oxirgi 4 belgisi (tokenning o'zi javobda kelmaydi) */
  token_set: boolean
  token_hint: string
  company_name: string
  company_address: string
  company_inn: string
  company_phone: string
  printer_size: number
  vat_percent: number
  items: Record<FiscalItemKind, { name: string; class_code: string; package_code: string }>
  methods: Record<string, "cash" | "card" | "skip">
  prepayment_as_advance: boolean
  auto_open_shift: boolean
  epos_prints: boolean
  enabled_at: string | null
  /** Yoqish uchun yetishmayotgan narsalar */
  problems: string[]
  default_url: string
}

export const fiscalKeys = {
  config: ["fiscal", "config"] as const,
  settings: ["fiscal", "settings"] as const,
  receipts: (status?: string) => ["fiscal", "receipts", status ?? "all"] as const,
}

/** Kassa uchun qisqa sozlama — hamma xodim o'qiydi. */
export const useFiscalConfig = (enabled = true) =>
  useQuery({
    queryKey: fiscalKeys.config,
    queryFn: async () => (await api.get<FiscalConfig>("/fiscal/config")).data,
    enabled,
    staleTime: 60_000,
    retry: false,
  })

export const useFiscalSettings = (enabled = true) =>
  useQuery({
    queryKey: fiscalKeys.settings,
    queryFn: async () => (await api.get<FiscalSettings>("/fiscal/settings")).data,
    enabled,
  })

export const useSaveFiscalSettings = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<FiscalSettings> & { token?: string; clear_token?: boolean }) =>
      (await api.put<FiscalSettings>("/fiscal/settings", payload)).data,
    onSuccess: (data) => {
      qc.setQueryData(fiscalKeys.settings, data)
      qc.invalidateQueries({ queryKey: fiscalKeys.config })
    },
  })
}

export const useFiscalReceipts = (status?: string, enabled = true) =>
  useQuery({
    queryKey: fiscalKeys.receipts(status),
    queryFn: async () =>
      (
        await api.get<{ items: FiscalReceipt[]; total: number }>("/fiscal/receipts", {
          params: { status: status || undefined, limit: 30 },
        })
      ).data,
    enabled,
    refetchInterval: 30_000,
  })

export const fetchFiscalConfig = async () => (await api.get<FiscalConfig>("/fiscal/config")).data

export const fetchPending = async () => (await api.get<FiscalPending>("/fiscal/pending")).data

export const prepareTarget = async (target: FiscalTarget) =>
  (await api.post<{ receipts: FiscalReceipt[] }>("/fiscal/prepare", target)).data.receipts

export const claimReceipt = async (id: string) =>
  (await api.post<ClaimedReceipt>(`/fiscal/receipts/${id}/claim`)).data

export const completeReceipt = async (id: string, stamp: FiscalStamp) =>
  (await api.post<FiscalReceipt>(`/fiscal/receipts/${id}/complete`, stamp)).data

export const failReceipt = async (id: string, error: string) =>
  (await api.post<FiscalReceipt>(`/fiscal/receipts/${id}/fail`, { error })).data

export const dismissReceipt = async (id: string, reason: string) =>
  (await api.post<FiscalReceipt>(`/fiscal/receipts/${id}/dismiss`, { error: reason })).data

/** Bron yoki sotuvning fiskallashgan cheklari (eng yangisi birinchi). */
export const fetchTargetReceipts = async (target: { reservation_id?: string; sale_id?: string }) =>
  (await api.get<{ items: FiscalReceipt[] }>("/fiscal/receipts", { params: target })).data.items
