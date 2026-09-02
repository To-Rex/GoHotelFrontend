import { useState } from "react"
import { ChevronDown, HandCoins, Loader2, Phone, User as UserIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { apiErrorMessage } from "@/lib/apiError"
import { cn } from "@/lib/utils"
import {
  useDebtors,
  type DebtorGuest,
  type DebtorReservation,
  type DebtorsParams,
} from "../api/debtors"

/**
 * Qarzdorlar ro'yxati.
 *
 * Bitta komponent uch sahifada ishlaydi — moliya, shaxsiy hisobot va
 * mehmonlar — chunki savol bir xil: kim qancha qarz. Farqi ko'rinishda:
 * moliyada bronlar bo'yicha (qaysi bron to'lanmagan), mehmonlar sahifasida
 * esa odamlar bo'yicha (bitta mehmonning bir nechta qarzi bitta qatorga
 * yig'iladi). Uch joyda uchta nusxa yozilsa, ta'rif vaqt o'tib ajralib
 * ketardi.
 */

const fmt = (n: number) => Number(n || 0).toLocaleString()

const fmtDate = (value?: string | null): string | null => {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value))
  return m ? `${m[3]}.${m[2]}.${m[1]}` : null
}

/** Chiqib ketgandan beri necha kun — eng eski qarz e'tiborni tortishi kerak. */
const daysSince = (value?: string | null): number | null => {
  const m = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value)) : null
  if (!m) return null
  const then = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const now = new Date()
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.round((today - then) / 86_400_000)
  return days > 0 ? days : null
}

const STATUS_LABELS: Record<string, string> = {
  CHECKED_IN: "Kirgan",
  CHECKED_OUT: "Chiqgan",
}

interface Props extends DebtorsParams {
  /** "reservations" — bronlar bo'yicha, "guests" — odamlar bo'yicha */
  mode?: "reservations" | "guests"
  title?: string
  /** Boshida nechta qator ko'rsatiladi; qolgani "Yana" bilan ochiladi */
  initialLimit?: number
  className?: string
  /** Qatorga bosilganda — masalan mehmon tarixini ochish uchun */
  onGuestClick?: (guestId: string) => void
}

export function DebtorsPanel({
  mode = "reservations",
  title = "Qarzdorlar",
  initialLimit = 5,
  className,
  onGuestClick,
  ...params
}: Props) {
  const { data, isLoading, error } = useDebtors(params)
  const [expanded, setExpanded] = useState(false)

  const summary = data?.summary
  const rows: Array<DebtorReservation | DebtorGuest> =
    mode === "guests" ? data?.guests || [] : data?.items || []
  const shown = expanded ? rows : rows.slice(0, initialLimit)

  // Qarz yo'q bo'lsa panel umuman chizilmaydi: bo'sh quti sahifani
  // uzaytirib, e'tiborni bo'ladi
  if (!isLoading && !error && rows.length === 0) return null

  return (
    <section
      className={cn(
        "rounded-xl border border-amber-200 bg-amber-50/40 p-3.5",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <HandCoins className="h-4 w-4" />
          </span>
          {title}
        </h3>
        {!!summary && summary.count > 0 && (
          <p className="text-sm">
            <span className="text-gray-500">Jami qarz: </span>
            <b className="tabular-nums text-amber-700">
              {fmt(summary.total_debt)} So'm
            </b>
            <span className="ml-1.5 text-xs text-gray-500">
              ({mode === "guests" ? summary.guests : summary.count} ta)
            </span>
          </p>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 py-6 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Yuklanmoqda...
        </div>
      )}

      {error && (
        <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {apiErrorMessage(error)}
        </p>
      )}

      {!isLoading && !error && (
        <>
          <ul className="mt-2.5 space-y-1.5">
            {shown.map((row) => {
              const isGuestRow = mode === "guests"
              const guest = row as DebtorGuest
              const res = row as DebtorReservation
              const key = isGuestRow
                ? guest.guest_id || guest.guest_name || Math.random().toString()
                : res.id
              const overdue = daysSince(
                isGuestRow ? guest.oldest_check_out : res.check_out_date
              )
              const clickable = !!onGuestClick && !!(isGuestRow ? guest.guest_id : res.guest_id)

              return (
                <li
                  key={key}
                  role={clickable ? "button" : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={
                    clickable
                      ? () =>
                          onGuestClick!(
                            (isGuestRow ? guest.guest_id : res.guest_id) as string
                          )
                      : undefined
                  }
                  onKeyDown={
                    clickable
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            onGuestClick!(
                              (isGuestRow ? guest.guest_id : res.guest_id) as string
                            )
                          }
                        }
                      : undefined
                  }
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-100 bg-white px-3 py-2",
                    clickable &&
                      "cursor-pointer transition-colors hover:border-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                  )}
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium leading-tight text-gray-900">
                      <UserIcon className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                      {(isGuestRow ? guest.guest_name : res.guest_name) ||
                        "Ism ko'rsatilmagan"}
                      {!isGuestRow && res.room_number && (
                        <span className="text-xs font-normal text-gray-500">
                          · {res.room_number}-xona
                        </span>
                      )}
                      {!isGuestRow && STATUS_LABELS[res.status] && (
                        <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                          {STATUS_LABELS[res.status]}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] leading-tight text-gray-500">
                      {(isGuestRow ? guest.guest_phone : res.guest_phone) && (
                        <span className="inline-flex items-center gap-0.5">
                          <Phone className="h-3 w-3" />
                          {isGuestRow ? guest.guest_phone : res.guest_phone}
                        </span>
                      )}
                      {isGuestRow ? (
                        <>
                          <span>{guest.reservations} ta bron</span>
                          {fmtDate(guest.oldest_check_out) && (
                            <span>eng eskisi: {fmtDate(guest.oldest_check_out)}</span>
                          )}
                        </>
                      ) : (
                        <>
                          <span>{res.reservation_number}</span>
                          {fmtDate(res.check_out_date) && (
                            <span>chiqqan: {fmtDate(res.check_out_date)}</span>
                          )}
                          {res.created_by_name && <span>{res.created_by_name}</span>}
                        </>
                      )}
                      {/* Qancha vaqtdan beri to'lanmagani — eng muhim belgi */}
                      {overdue !== null && (
                        <span
                          className={cn(
                            "font-medium",
                            overdue > 7 ? "text-red-600" : "text-amber-600"
                          )}
                        >
                          {overdue} kundan beri
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-bold tabular-nums text-amber-700">
                      {fmt(row.debt_amount)}{" "}
                      <span className="text-xs font-normal text-gray-400">So'm</span>
                    </p>
                    {!isGuestRow && (
                      <p className="text-[11px] tabular-nums text-gray-400">
                        {fmt(res.paid_amount)} / {fmt(res.total_amount)}
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>

          {rows.length > initialLimit && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1.5 h-7 text-xs text-gray-600"
              onClick={() => setExpanded((v) => !v)}
            >
              <ChevronDown
                className={cn(
                  "mr-1 h-3.5 w-3.5 transition-transform",
                  expanded && "rotate-180"
                )}
              />
              {expanded
                ? "Yig'ish"
                : `Yana ${rows.length - initialLimit} tasi`}
            </Button>
          )}
        </>
      )}
    </section>
  )
}
