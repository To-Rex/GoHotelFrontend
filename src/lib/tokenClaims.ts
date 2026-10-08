/* JWT ichidagi ochiq ma'lumot (imzo TEKSHIRILMAYDI — faqat brauzerdagi
   holatni token bilan solishtirish uchun; ruxsat qarorlari serverda).

   Sozlovchi va tizim ma'muri mehmonxonani, administrator esa filialni
   almashtirganda yangi token localStorage'ga yoziladi — u barcha tablar
   uchun umumiy. Boshqa tabda eski mehmonxona/filial ma'lumoti turgan holda
   so'rovlar yangisiga ketmasligi uchun o'sha tab tokendagi mehmonxona va
   filialga qarab o'zini qayta yuklaydi. */

export function tokenClaims(token: string | null | undefined): Record<string, unknown> | null {
  if (!token) return null
  const part = token.split(".")[1]
  if (!part) return null
  try {
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/")
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
    const json = decodeURIComponent(
      Array.from(atob(padded), (ch) => "%" + ch.charCodeAt(0).toString(16).padStart(2, "0")).join("")
    )
    const data = JSON.parse(json)
    return data && typeof data === "object" ? (data as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** Tokendagi mehmonxona (`hotel_id` claim). O'qib bo'lmasa — `undefined`. */
export function tokenHotelId(token: string | null | undefined): string | null | undefined {
  const claims = tokenClaims(token)
  if (!claims) return undefined
  const value = claims.hotel_id
  return typeof value === "string" && value ? value : null
}

/** Tokendagi filial (`branch_id` claim). O'qib bo'lmasa — `undefined`. */
export function tokenBranchId(token: string | null | undefined): string | null | undefined {
  const claims = tokenClaims(token)
  if (!claims) return undefined
  const value = claims.branch_id
  return typeof value === "string" && value ? value : null
}

/**
 * Boshqa tab tokenni almashtirdi (localStorage `storage` hodisasi): undagi
 * mehmonxona yoki filial shu tabdagidan farq qilsa — tab qayta yuklanishi
 * kerak. Filial faqat tokenda bo'lsa solishtiriladi (eski tokenlarda yo'q).
 * Token o'qilmasa yoki hodisa boshqa kalit bo'yicha bo'lsa — yo'q.
 */
export function needsReloadForToken(
  key: string | null,
  newValue: string | null,
  currentHotelId: string | null | undefined,
  currentBranchId?: string | null
): boolean {
  if (key !== "accessToken" || !newValue) return false
  const next = tokenHotelId(newValue)
  if (next === undefined) return false
  if (next !== (currentHotelId ?? null)) return true
  const branch = tokenBranchId(newValue)
  return !!branch && currentBranchId !== undefined && branch !== (currentBranchId ?? null)
}
