import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

/* Yon menyu tartibi — mehmonxona bo'yicha bitta.

   Administrator o'zgartirsa, uni o'sha mehmonxonaning BARCHA xodimlari
   ko'radi: tartib brauzerda emas, mehmonxona sozlamasida saqlanadi. */

export interface NavOrder {
  /** Manzillar kerakli tartibda. Bu yerda yo'q sahifa o'z joyida qoladi. */
  order: string[]
}

export const useNavOrder = () =>
  useQuery({
    queryKey: ["navOrder"],
    queryFn: async () => {
      const { data } = await api.get<NavOrder>("/hotels/nav-settings")
      return data
    },
    // Menyu tartibi kamdan-kam o'zgaradi — har sahifa almashganda
    // qayta so'ralmasin
    staleTime: 5 * 60 * 1000,
  })

export const useSaveNavOrder = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (order: string[]) => {
      const { data } = await api.put<NavOrder>("/hotels/nav-settings", { order })
      return data
    },
    onSuccess: (data) => qc.setQueryData(["navOrder"], data),
  })
}

/**
 * Havolalarni saqlangan tartibga soladi.
 *
 * Tartibda yo'q havola YO'QOLMAYDI — u o'z guruhining oxirida, standart
 * tartibini saqlagan holda qoladi. Bu yangi versiyada qo'shilgan sahifa
 * uchun muhim: eski saqlangan tartib uni bilmaydi, lekin u baribir
 * ko'rinishi kerak.
 */
export const applyNavOrder = <T extends { href: string }>(
  links: T[],
  order: string[] | undefined
): T[] => {
  if (!order || order.length === 0) return links
  const rank = new Map(order.map((href, index) => [href, index]))
  return links
    .map((link, index) => ({ link, index }))
    .sort((a, b) => {
      const rankA = rank.get(a.link.href)
      const rankB = rank.get(b.link.href)
      if (rankA !== undefined && rankB !== undefined) return rankA - rankB
      // Tartibda ko'rsatilganlar har doim oldinda
      if (rankA !== undefined) return -1
      if (rankB !== undefined) return 1
      return a.index - b.index
    })
    .map((item) => item.link)
}
