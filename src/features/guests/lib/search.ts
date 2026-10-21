import type { Guest } from "@/types/api"

export const guestSearchRank = (
  guest: Guest,
  query: string,
  options: { passport?: boolean } = {}
): number => {
  const q = query.trim().toLowerCase()
  if (!q) return 2
  const digits = query.replace(/\D/g, "")
  const first = (guest.first_name || "").toLowerCase()
  const last = (guest.last_name || "").toLowerCase()
  const phone = (guest.phone || "").replace(/\D/g, "")
  const passport = (guest.passport_number || "").toLowerCase()
  const phoneHit =
    digits.length >= 7 &&
    phone.length >= 7 &&
    phone.slice(-9) === digits.slice(-9)
  const starts =
    first.startsWith(q) ||
    last.startsWith(q) ||
    phoneHit ||
    (options.passport === true && passport.startsWith(q))
  if (starts) return 0
  const includes =
    first.includes(q) ||
    last.includes(q) ||
    (options.passport === true && passport.includes(q))
  return includes ? 1 : 2
}
