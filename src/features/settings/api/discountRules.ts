import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { tr } from "@/i18n"

/* Chegirma qoidalari — mehmonxona bo'yicha, bron turi bo'yicha alohida.

   Qoidani administrator belgilaydi, qolgan xodimlar undan foydalanadi:
   bron oynasi chegarani ko'rsatadi va undan oshirishga yo'l qo'ymaydi.
   Haqiqiy to'siq esa serverda — bu yerdagi tekshiruv faqat xodimga
   tushunarli bo'lishi uchun.

   Barcha chegaralarda 0 — "cheklov yo'q". */

export interface DiscountRule {
  enabled: boolean
  /** Eng ko'p foiz (0 — cheklovsiz) */
  max_percent: number
  /** Eng ko'p summa, so'm (0 — cheklovsiz) */
  max_amount: number
  /** Chegirma beriladigan eng qisqa davomiylik: kunlikda kecha, soatlikda soat */
  min_duration: number
  /** Eng uzun davomiylik (0 — cheklovsiz) */
  max_duration: number
}

export interface DiscountRules {
  daily: DiscountRule
  hourly: DiscountRule
}

export const EMPTY_RULE: DiscountRule = {
  enabled: true,
  max_percent: 0,
  max_amount: 0,
  min_duration: 0,
  max_duration: 0,
}

export const useDiscountRules = () =>
  useQuery({
    queryKey: ["discountRules"],
    queryFn: async () => {
      const { data } = await api.get<DiscountRules>("/hotels/discount-settings")
      return data
    },
    // Kamdan-kam o'zgaradi — har bron oynasida qayta so'ralmasin
    staleTime: 5 * 60 * 1000,
  })

export const useSaveDiscountRules = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (next: DiscountRules) => {
      const { data } = await api.put<DiscountRules>("/hotels/discount-settings", next)
      return data
    },
    onSuccess: (data) => qc.setQueryData(["discountRules"], data),
  })
}

/** Qoida kelmagan bo'lsa ham oyna ishlashi kerak — cheklovsiz deb qaraladi. */
export const ruleFor = (
  rules: DiscountRules | undefined,
  bookingType: "DAILY" | "HOURLY"
): DiscountRule => {
  const rule = bookingType === "HOURLY" ? rules?.hourly : rules?.daily
  return rule ?? EMPTY_RULE
}

/**
 * Shu bronga chegirma UMUMAN berilishi mumkinmi.
 *
 * Foiz va summa chegaralari maydonni yopmaydi — ular kiritilgan qiymatni
 * cheklaydi. Davomiylik sharti esa boshqacha: 1 soatlik bronga chegirma
 * yo'q bo'lsa, xodim raqam terib o'tirmasligi kerak — maydonning o'zi
 * yopiladi.
 */
export const discountAllowed = (rule: DiscountRule, duration: number): boolean => {
  if (!rule.enabled) return false
  if (rule.min_duration > 0 && duration < rule.min_duration) return false
  if (rule.max_duration > 0 && duration > rule.max_duration) return false
  return true
}

/** Maydon nega yopilgani — xodimga tushuntirish uchun. */
export const discountBlockedReason = (
  rule: DiscountRule,
  bookingType: "DAILY" | "HOURLY",
  duration: number
): string | null => {
  if (!rule.enabled) return tr("Chegirma berish sozlamalarda o'chirilgan")
  const unit = bookingType === "HOURLY" ? tr("soat") : tr("kecha")
  if (rule.min_duration > 0 && duration < rule.min_duration) {
    return tr("Chegirma kamida {{min_duration}} {{unit}}dan boshlab beriladi — bu bron {{duration}} {{unit}}", { min_duration: rule.min_duration, unit, duration })
  }
  if (rule.max_duration > 0 && duration > rule.max_duration) {
    return tr("Chegirma ko'pi bilan {{max_duration}} {{unit}}lik bronga beriladi — bu bron {{duration}} {{unit}}", { max_duration: rule.max_duration, unit, duration })
  }
  return null
}

/**
 * Chegirma qoidaga sig'adimi. Sig'masa — sabab matni, sig'sa — null.
 *
 * Server bilan bir xil qoida: bu yerdagi tekshiruv xodimga darhol javob
 * berish uchun, haqiqiy to'siq esa serverda.
 */
export const discountProblem = (
  rule: DiscountRule,
  bookingType: "DAILY" | "HOURLY",
  duration: number,
  roomCharge: number,
  amount: number,
  percent: number
): string | null => {
  if (amount <= 0 && percent <= 0) return null
  const unit = bookingType === "HOURLY" ? tr("soat") : tr("kecha")
  const num = (v: number) => (Number.isInteger(v) ? String(v) : String(v))

  if (!rule.enabled) return tr("Bu mehmonxonada chegirma berish o'chirilgan")
  if (rule.min_duration > 0 && duration < rule.min_duration) {
    return tr("Chegirma kamida {{min_duration}} {{unit}}dan boshlab beriladi", { min_duration: num(rule.min_duration), unit })
  }
  if (rule.max_duration > 0 && duration > rule.max_duration) {
    return tr("Chegirma ko'pi bilan {{max_duration}} {{unit}}lik bronga beriladi", { max_duration: num(rule.max_duration), unit })
  }

  // Ikkala chegara ham bir xil o'lchovga keltiriladi: xodim foizda kiritsa
  // ham, so'mda kiritsa ham ikkalasi ishlashi kerak
  const effAmount = percent > 0 ? Math.round((roomCharge * percent) / 100) : amount
  const effPercent = percent > 0 ? percent : roomCharge > 0 ? (amount / roomCharge) * 100 : 0

  if (rule.max_percent > 0 && effPercent > rule.max_percent + 0.001) {
    return tr("Chegirma {{max_percent}}% dan oshmasligi kerak", { max_percent: num(rule.max_percent) })
  }
  if (rule.max_amount > 0 && effAmount > rule.max_amount + 0.001) {
    return tr("Chegirma {{max_amount}} so'mdan oshmasligi kerak", { max_amount: rule.max_amount.toLocaleString() })
  }
  return null
}

/** Xodimga ko'rsatiladigan qisqa izoh (chegara qanday). */
export const discountHint = (
  rule: DiscountRule,
  bookingType: "DAILY" | "HOURLY"
): string => {
  if (!rule.enabled) return tr("Chegirma berish o'chirilgan")
  const unit = bookingType === "HOURLY" ? tr("soat") : tr("kecha")
  const parts: string[] = []
  if (rule.max_percent > 0) parts.push(tr("{{max_percent}}% gacha", { max_percent: rule.max_percent }))
  if (rule.max_amount > 0) parts.push(tr("{{max_amount}} so'mgacha", { max_amount: rule.max_amount.toLocaleString() }))
  if (rule.min_duration > 0) parts.push(tr("kamida {{min_duration}} {{unit}}", { min_duration: rule.min_duration, unit }))
  if (rule.max_duration > 0) parts.push(tr("ko'pi bilan {{max_duration}} {{unit}}", { max_duration: rule.max_duration, unit }))
  return parts.join(" · ")
}
