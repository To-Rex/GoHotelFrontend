import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router-dom"
import { BellRing, HandCoins, MessageSquareWarning, X } from "lucide-react"

import { useAuthStore } from "@/store/auth"
import { usePermissions } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { useDebtors, type DebtorReservation } from "../api/debtors"
import { useDebtSettings } from "@/features/settings/api/debtSettings"
import { newDebtors, rankDebtors, shouldRemind } from "../lib/debtReminder"
import { reasonsSummary } from "../lib/debtReasons"
import { DebtReasons } from "./DebtReasons"
import { tr } from "@/i18n"

/**
 * Qarzlar — navbardagi doimiy eslatma.
 *
 * Qarz bor ekan tugma qizil raqam bilan turadi; menyuda har qarzdor SABABI
 * bilan (xona, jarima, do'kon...) va bosilsa o'sha bron ochiladi. Qarz
 * unutilmasligi uchun sozlamadagi oraliqda eslatma chiqadi, mehmon qarz
 * bilan chiqib ketgani kabi YANGI qarz esa darhol ko'rsatiladi.
 */

const POLL_MS = 60_000
const REMINDER_KEY = "gohotel.debt.lastReminder"
const SEEN_KEY = "gohotel.debt.seen"

const fmt = (n?: number | null) => Number(n || 0).toLocaleString()

function readNumber(key: string): number | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? Number(raw) || null : null
  } catch {
    return null
  }
}

function writeNumber(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    /* saqlab bo'lmasa — eslatma baribir ishlaydi */
  }
}

function readSeen(): Set<string> | null {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : null
  } catch {
    return null
  }
}

function writeSeen(ids: string[]) {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify(ids))
  } catch {
    /* ahamiyatsiz */
  }
}

type Toast =
  | { kind: "digest"; count: number; total: number; top: DebtorReservation[] }
  | { kind: "new"; items: DebtorReservation[] }

function who(item: DebtorReservation) {
  const name = item.guest_name || tr("Mehmon")
  return item.room_number ? tr("{{name}} ({{room}}-xona)", { name, room: item.room_number }) : name
}

export function DebtsMenu() {
  const user = useAuthStore((s) => s.user)
  const { can, isAdmin } = usePermissions()
  const navigate = useNavigate()
  const allowed =
    !!user?.hotel_id && (isAdmin || can("finance.payment.create") || can("reservation.update"))

  const { data, isError } = useDebtors({ refetchMs: POLL_MS, enabled: allowed })
  const { data: settings } = useDebtSettings(allowed)
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const seenRef = useRef<Set<string> | null>(readSeen())

  const items = useMemo(() => rankDebtors(data?.items || []), [data])
  const summary = data?.summary

  /* Eslatmalar: yangi qarz — darhol; davriy — oraliqda */
  useEffect(() => {
    if (!data) return
    const fresh = newDebtors(seenRef.current, data.items)
    const ids = data.items.map((i) => i.id)
    seenRef.current = new Set(ids)
    writeSeen(ids)
    if (open) return
    if (fresh.length) {
      setToast({ kind: "new", items: fresh })
      return
    }
    const now = Date.now()
    const interval = settings?.interval_minutes ?? 120
    const enabled = settings?.enabled ?? true
    if (shouldRemind(readNumber(REMINDER_KEY), now, interval, enabled, data.summary.count)) {
      writeNumber(REMINDER_KEY, now)
      setToast({
        kind: "digest",
        count: data.summary.count,
        total: data.summary.total_debt,
        top: rankDebtors(data.items).slice(0, 3),
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  if (!allowed || isError) return null

  const openReservation = (item: DebtorReservation) => {
    setOpen(false)
    setToast(null)
    navigate(`/booking?reservation=${encodeURIComponent(item.id)}`)
  }

  const toastLayer =
    toast && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed bottom-5 right-3 z-[60] w-[24rem] max-w-[calc(100vw-1.5rem)] sm:right-5">
            <div
              role="status"
              aria-live="polite"
              className="overflow-hidden rounded-2xl border border-red-200 bg-background shadow-2xl animate-in fade-in-0 slide-in-from-bottom-4 duration-300"
            >
              <div className="flex items-center gap-1.5 border-b border-red-100 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 dark:bg-red-500/10">
                <BellRing className="h-3.5 w-3.5" />
                {toast.kind === "new" ? tr("Yangi qarz") : tr("Qarz eslatmasi")}
                <button
                  type="button"
                  onClick={() => setToast(null)}
                  className="ml-auto rounded-md p-0.5 text-red-500 hover:bg-red-100"
                  title={tr("Yopish")}
                  aria-label={tr("Yopish")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-2 p-3.5">
                {toast.kind === "digest" ? (
                  <>
                    <p className="text-sm font-semibold text-gray-900">
                      {tr("Qarzdorlar: {{count}} ta · {{total}} so'm", {
                        count: toast.count,
                        total: fmt(toast.total),
                      })}
                    </p>
                    <ul className="space-y-1">
                      {toast.top.map((item) => (
                        <li key={item.id} className="text-xs leading-snug text-gray-700">
                          <b>{who(item)}</b> — {fmt(item.debt_amount)}
                          {item.reasons?.length ? (
                            <span className="text-gray-500">: {reasonsSummary(item.reasons, 1)}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <ul className="space-y-1.5">
                    {toast.items.slice(0, 3).map((item) => (
                      <li key={item.id} className="text-sm leading-snug text-gray-800">
                        <b>{who(item)}</b> — {fmt(item.debt_amount)} {tr("so'm")}
                        {item.status === "CHECKED_OUT" && (
                          <span className="ml-1 text-xs font-medium text-red-600">
                            {tr("(chiqib ketgan)")}
                          </span>
                        )}
                        <DebtReasons reasons={item.reasons} compact className="mt-1" />
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setToast(null)
                      setOpen(true)
                    }}
                    className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                  >
                    {tr("Qarzlarni ko'rish")}
                  </button>
                  {toast.kind === "new" && toast.items[0] && (
                    <button
                      type="button"
                      onClick={() => openReservation(toast.items[0])}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      {tr("Bronni ochish")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null

  if (!items.length && !open) return toastLayer

  return (
    <div className="relative" ref={menuRef}>
      {toastLayer}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
          open ? "bg-red-50 text-red-700" : "text-red-600 hover:bg-red-50"
        )}
        title={tr("Qarzdor mehmonlar")}
        aria-label={tr("Qarzdor mehmonlar")}
      >
        <HandCoins size={18} />
        {items.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {items.length}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-[4.25rem] z-50 overflow-hidden rounded-xl border border-border bg-background shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[28rem]">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <HandCoins className="h-4 w-4 text-red-600" />
            <span className="text-sm font-semibold">{tr("Qarzlar")}</span>
            {summary && (
              <span className="ml-auto text-sm font-bold tabular-nums text-red-700">
                {tr("{{v}} so'm", { v: fmt(summary.total_debt) })}
              </span>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {tr("Qarz yo'q — barcha hisoblar yopilgan.")}
            </p>
          ) : (
            <div className="max-h-[min(30rem,calc(100dvh-9rem))] overflow-y-auto">
              {items.map((item) => (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openReservation(item)}
                  onKeyDown={(e) => e.key === "Enter" && openReservation(item)}
                  className="cursor-pointer border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/60"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{who(item)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {item.status === "CHECKED_OUT"
                          ? tr("Chiqib ketgan")
                          : item.status === "CHECKED_IN"
                            ? tr("Turibdi")
                            : tr("Tasdiqlangan")}
                        {item.overdue_days ? (
                          <span className={cn("ml-1 font-medium", item.overdue_days > 7 ? "text-red-600" : "text-amber-600")}>
                            · {tr("{{days}} kundan beri", { days: item.overdue_days })}
                          </span>
                        ) : null}
                        {item.guest_phone ? ` · ${item.guest_phone}` : ""}
                      </p>
                    </div>
                    <b className="shrink-0 text-sm tabular-nums text-red-700">{fmt(item.debt_amount)}</b>
                  </div>
                  <DebtReasons reasons={item.reasons} compact className="mt-1.5" />
                  {item.acknowledged?.note && (
                    <p className="mt-1 flex items-start gap-1 text-[11px] leading-snug text-red-700">
                      <MessageSquareWarning className="mt-px h-3 w-3 shrink-0" />
                      {item.acknowledged.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          {(isAdmin || can("finance.view")) && (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                navigate("/finance")
              }}
              className="w-full border-t border-border px-4 py-2.5 text-center text-xs font-semibold text-primary-700 hover:bg-muted/60"
            >
              {tr("Barcha qarzdorlar — Moliya sahifasi")}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
