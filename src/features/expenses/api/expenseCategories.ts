import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"

/**
 * Xarajat toifalari — mehmonxonaning tanlash ro'yxati.
 *
 * Xarajat toifani NOM bilan saqlaydi (`expense.category`), bu ro'yxat esa
 * nomlarning o'zi: belgi, rang, tartib, arxiv. Toifa qayta nomlansa
 * xarajatlardagi nom ham o'zgaradi; ishlatilgan toifa o'chirilmaydi —
 * arxivga tushadi. Qoidalar backendda: `expense_category_service.py`.
 */

export interface ExpenseCategory {
  id: string
  hotel_id: string
  name: string
  /** lucide belgi nomi (`categoryStyle.ts` dagi ro'yxatdan) */
  icon: string | null
  /** palitra kaliti (`categoryStyle.ts`) */
  color: string | null
  sort_order: number
  is_active: boolean
  /** Shu toifadagi xarajatlar soni — butun mehmonxona bo'yicha */
  usage_count: number
  usage_total: number
  created_at?: string | null
}

export interface ExpenseCategoriesResponse {
  items: ExpenseCategory[]
  /** Shu foydalanuvchi ro'yxatni o'zgartira oladimi (server qayta tekshiradi) */
  can_manage: boolean
}

export interface ExpenseCategoryPayload {
  /** Yaratishda majburiy; yangilashda bo'sh qolsa nom o'zgarmaydi */
  name?: string
  icon?: string | null
  color?: string | null
  sort_order?: number | null
  is_active?: boolean | null
}

const BASE = "/expenses/categories"

/** Toifalar ro'yxati. `includeArchived` — boshqaruv oynasi uchun. */
export const useExpenseCategories = (includeArchived = false, enabled = true) =>
  useQuery({
    queryKey: ["expenseCategories", includeArchived],
    queryFn: async () => {
      const { data } = await api.get<ExpenseCategoriesResponse>(BASE, {
        params: { include_archived: includeArchived || undefined },
      })
      return {
        items: Array.isArray(data?.items) ? data.items : [],
        can_manage: Boolean(data?.can_manage),
      }
    },
    enabled,
    // Ro'yxat kam o'zgaradi — har dialog ochilishida so'ramaymiz
    staleTime: 5 * 60 * 1000,
  })

/* Toifa o'zgarsa yangilanishi kerak bo'lgan ma'lumotlar: xarajatlar
   ro'yxati (nom o'zgargan bo'lishi mumkin), moliya yig'indisi (toifalar
   kesimi) va shaxsiy hisobot. */
const AFFECTED_KEYS = [
  ["expenseCategories"],
  ["expenses"],
  ["financeSummary"],
  ["myReport"],
]

function useInvalidateCategories() {
  const qc = useQueryClient()
  return () => {
    for (const queryKey of AFFECTED_KEYS) qc.invalidateQueries({ queryKey })
  }
}

export const useCreateExpenseCategory = () => {
  const invalidate = useInvalidateCategories()
  return useMutation({
    mutationFn: async (payload: ExpenseCategoryPayload) => {
      const { data } = await api.post<ExpenseCategory>(BASE, payload)
      return data
    },
    onSuccess: invalidate,
  })
}

export const useUpdateExpenseCategory = () => {
  const invalidate = useInvalidateCategories()
  return useMutation({
    mutationFn: async ({ id, ...payload }: ExpenseCategoryPayload & { id: string }) => {
      const { data } = await api.put<ExpenseCategory & { renamed_expenses?: number }>(
        `${BASE}/${id}`,
        payload
      )
      return data
    },
    onSuccess: invalidate,
  })
}

export interface ExpenseCategoryDeleteResult {
  archived: boolean
  deleted: boolean
  usage_count: number
  category: ExpenseCategory | null
}

/** Ishlatilmagan toifa o'chadi, ishlatilgani arxivga tushadi (javobda qaysi biri). */
export const useDeleteExpenseCategory = () => {
  const invalidate = useInvalidateCategories()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete<ExpenseCategoryDeleteResult>(`${BASE}/${id}`)
      return data
    },
    onSuccess: invalidate,
  })
}

export const useReorderExpenseCategories = () => {
  const invalidate = useInvalidateCategories()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { data } = await api.put<ExpenseCategory[]>(`${BASE}/reorder`, { ids })
      return Array.isArray(data) ? data : []
    },
    onSuccess: invalidate,
  })
}
