/**
 * Mehmonxona xizmati to'xtatilgan holatning umumiy qismi.
 *
 * Kod uch joyda kerak: `api.ts` (so'rov to'silganda yozadi), kirish
 * sahifasi (kirishning o'zi to'silganda) va sabab sahifasi (ko'rsatadi).
 * Sahifadan import qilinsa, butun ilova uchun umumiy bo'lgan api qatlami
 * React sahifasiga bog'lanib qolardi.
 */

/** Server matni to'liq qayta yuklashdan omon qolishi uchun. */
export const HOTEL_BLOCK_MESSAGE_KEY = "hotelBlockMessage"

/** Serverdan kelgan kod mehmonxona to'xtatilgani haqidami. */
export const isHotelBlockCode = (code: unknown): code is string =>
  typeof code === "string" && code.startsWith("HOTEL_")

/** Sahifa matni tayyorlangan sabablar. */
export type HotelBlockReason =
  | "HOTEL_INACTIVE"
  | "HOTEL_SUSPENDED"
  | "HOTEL_NOT_FOUND"

const KNOWN: HotelBlockReason[] = [
  "HOTEL_INACTIVE",
  "HOTEL_SUSPENDED",
  "HOTEL_NOT_FOUND",
]

/**
 * Nomzodlar ichidan matni bor birinchi sababni tanlaydi.
 *
 * Kod bir necha manbadan kelishi mumkin (router state, manzil qatori),
 * server esa kelajakda yangi holat qo'shishi mumkin — noma'lum kod
 * bo'sh ekranga emas, umumiy "to'xtatilgan" matniga tushadi.
 */
export const hotelBlockReason = (
  ...candidates: (string | null | undefined)[]
): HotelBlockReason => {
  for (const candidate of candidates) {
    const found = KNOWN.find((reason) => reason === candidate)
    if (found) return found
  }
  return "HOTEL_INACTIVE"
}
