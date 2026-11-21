import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { isAxiosError } from "axios"

import { api } from "@/lib/api"

/* Do'kon foydasi va zarari (GET /shop/profit) — Moliya → Do'kon statistikasi.

   Davr — SOTUV sanasi: mahsulot qaysi kuni sotilgan bo'lsa foydasi o'sha
   kunda (bronga yozilgani ham). Tannarx — sotilgan partiyaning o'zidan;
   partiyada tannarx bo'lmasa mahsulotning o'rtacha tannarxi (taxminiy),
   umuman bo'lmasa sotuv foydaga kirmaydi. Qoidalar serverda:
   `shop_profit_service.py`. */

export type CostStatus = "exact" | "estimated" | "partial" | "unknown" | "none"

export interface ShopProfitProduct {
  product_id: string
  name: string
  emoji: string | null
  is_active: boolean
  sold_qty: number
  revenue: number
  /** Tannarxi ma'lum (yoki taxminiy) qismi */
  revenue_covered: number
  cost: number
  cost_estimated: number
  uncovered_qty: number
  uncovered_revenue: number
  estimated_qty: number
  below_cost_qty: number
  below_cost_loss: number
  writeoff_qty: number
  writeoff_cost: number
  shortage_qty: number
  shortage_cost: number
  surplus_qty: number
  surplus_cost: number
  loss_unknown_qty: number
  /** Yalpi foyda (sotuv − tannarx) */
  profit: number
  /** Foiz; tannarxi ma'lum sotuv bo'lmasa null */
  margin: number | null
  /** Spisaniye + kamomad − ortiqcha */
  losses: number
  /** profit − losses */
  net: number
  cost_status: CostStatus
}

export interface ShopLossBucket {
  count: number
  qty: number
  cost: number
  /** Sotuv narxidagi qiymati (boy berilgan tushum) */
  sale_value: number
  estimated: boolean
  unknown_qty: number
}

export interface MissingCostBatch {
  batch_id: string
  product_id: string
  product_name: string
  emoji: string | null
  quantity: number
  remaining: number
  sold_in_period: number
  sale_price: number
  created_at: string | null
}

export interface ShopProfit {
  date_from: string | null
  date_to: string | null
  sales: { count: number; items_qty: number; revenue: number; unpaid: number }
  revenue_covered: number
  cost: { total: number; estimated: number }
  gross_profit: number
  margin: number | null
  uncovered: { revenue: number; qty: number; products: number }
  below_cost: { qty: number; loss: number; products: number }
  writeoff: ShopLossBucket
  shortage: ShopLossBucket
  surplus: ShopLossBucket
  losses: number
  net_profit: number
  stock: {
    qty: number
    cost_value: number
    sale_value: number
    covered_sale_value: number
    unknown_cost_qty: number
    potential_profit: number
  }
  products: ShopProfitProduct[]
  missing_cost_batches: MissingCostBatch[]
  /** Tannarxni kiritish huquqi (do'kon boshqaruvchisi) */
  can_edit_cost: boolean
}

/** Ruxsat yo'q yoki eski server — panel umuman ko'rsatilmaydi */
export const profitUnavailable = (error: unknown): boolean =>
  isAxiosError(error) && [403, 404, 405].includes(error.response?.status ?? 0)

export const useShopProfit = (dateFrom?: string, dateTo?: string, enabled = true) =>
  useQuery({
    queryKey: ["shopProfit", dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await api.get<ShopProfit>("/shop/profit", {
        params: { date_from: dateFrom || undefined, date_to: dateTo || undefined },
      })
      return data
    },
    enabled,
    // Ruxsat yo'q / eski server — qayta urinish befoyda
    retry: (count, error) => !profitUnavailable(error) && count < 2,
  })

/** Partiya tannarxini kiritish (PUT /shop/batches/{id}) — boshqaruvchi uchun */
export const useUpdateBatchCost = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ batchId, costPrice }: { batchId: string; costPrice: number | null }) => {
      const { data } = await api.put(`/shop/batches/${batchId}`, { cost_price: costPrice })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shopProfit"] })
      // Ombor sahifasidagi partiyalar ro'yxati ham yangilansin
      qc.invalidateQueries({ queryKey: ["shopProducts"] })
    },
  })
}
