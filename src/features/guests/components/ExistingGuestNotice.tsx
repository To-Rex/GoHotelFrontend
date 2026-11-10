import { UserCheck } from "lucide-react"

import { cn } from "@/lib/utils"
import { tr } from "@/i18n"
import type { GuestMatch } from "../api/guests"

/* "Bu mehmon bazada bor" — yangi mehmon formasi ostidagi eslatma.

   Passport yoki telefon terilishi bilan server bazadan mosini topadi;
   xodim bir bosishda o'sha mehmonni tanlaydi — qayta yaratmaydi, hujjat
   suratlari va tarix bitta kartada qoladi. Maxfiylik: passport raqami
   ko'rsatilmaydi (faqat nima bo'yicha mos kelgani), telefon ko'rinadi. */

const guestName = (g: GuestMatch) => `${g.first_name} ${g.last_name}`.trim()

export function ExistingGuestNotice({
  matches,
  onSelect,
  selectLabel,
  compact = false,
  className,
}: {
  matches: GuestMatch[]
  onSelect: (guest: GuestMatch) => void
  /** Tugma matni (standart "Tanlash") */
  selectLabel?: string
  compact?: boolean
  className?: string
}) {
  if (matches.length === 0) return null
  const shown = matches.slice(0, 3)
  return (
    <div
      role="status"
      className={cn(
        "rounded-lg border border-amber-300 bg-amber-50 text-amber-900",
        compact ? "px-2.5 py-2" : "px-3 py-2.5",
        className
      )}
    >
      <p className={cn("flex items-center gap-1.5 font-semibold", compact ? "text-xs" : "text-sm")}>
        <UserCheck className="h-4 w-4 flex-shrink-0 text-amber-600" />
        {matches.length === 1
          ? tr("Bu mehmon bazada bor — qayta yaratish shart emas")
          : tr("Bazada shunday {{count}} ta mehmon bor", { count: matches.length })}
      </p>
      <ul className={cn("mt-1.5 space-y-1", compact && "mt-1")}>
        {shown.map((g) => (
          <li
            key={g.id}
            className="flex items-center justify-between gap-3 rounded-md bg-white/70 px-2.5 py-1.5"
          >
            <div className="min-w-0">
              <p className={cn("truncate font-medium text-gray-900", compact ? "text-xs" : "text-sm")}>
                {guestName(g)}
              </p>
              <p className="truncate text-[11px] text-amber-800/80">
                {[
                  g.matched_by === "passport" ? tr("passport bo'yicha") : tr("telefon bo'yicha"),
                  g.phone,
                  g.birth_date,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSelect(g)}
              className="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700"
            >
              {selectLabel || tr("Tanlash")}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
