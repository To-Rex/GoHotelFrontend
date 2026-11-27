import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, BookUser, ChevronRight, IdCard, Loader2, LogOut, X } from "lucide-react"

import { tr } from "@/i18n"
import { api } from "@/lib/api"
import { apiErrorMessage } from "@/lib/apiError"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/store/auth"

import {
  checkoutRegistration,
  emehmonKeys,
  useEmehmonConfig,
  useEmehmonPending,
  type PendingCheckout,
  type PendingRegister,
} from "../api/emehmon"
import { elapsedParts } from "../lib/emehmon"
import { checkedInReservationId, promptResolved, touchesStay, useEmehmonUi } from "../lib/store"
import { EmehmonDialog } from "./EmehmonDialog"
import { EmehmonJournalDialog } from "./EmehmonJournalDialog"

/* E-mehmon (davlat ro'yxati) — ish joyidagi yordamchi.

   `EmehmonAgent` (MainLayout'da bitta): oynalarni chizadi va kirish
   rasmiylashtirilganini kuzatadi — mehmon qayerdan kiritilganidan qat'i
   nazar (bron sahifasi, yangi bron oynasi, xonalar) pastda "ro'yxatga
   olish" eslatmasi chiqadi. Mavjud oqimlarga tegilmaydi: faqat javoblar
   kuzatiladi.

   `EmehmonNavButton` (navbarda): ro'yxatga olinmagan mehmonlar va
   E-mehmon'dan chiqarilmay qolganlar navbati.

   Integratsiya yoqilmagan filialda ikkalasi ham hech narsa ko'rsatmaydi va
   hech qanday so'rov yubormaydi (qisqa sozlamadan tashqari). */

export function EmehmonAgent() {
  const user = useAuthStore((s) => s.user)
  const { data: cfg } = useEmehmonConfig(!!user)
  const qc = useQueryClient()
  const prompt = useEmehmonUi((s) => s.prompt)
  const promptAt = useEmehmonUi((s) => s.promptAt)
  const setPrompt = useEmehmonUi((s) => s.setPrompt)
  const openReservation = useEmehmonUi((s) => s.openReservation)
  const active = !!cfg?.enabled && cfg.can_operate
  const promptOnCheckin = !!cfg?.prompt_on_checkin
  const { data: pending, dataUpdatedAt } = useEmehmonPending(active)

  // Mehmon ro'yxatga olingach (yoki «kerak emas») eslatma o'zi yopiladi
  useEffect(() => {
    const waiting = pending?.register.map((item) => item.reservation_id)
    if (promptResolved(prompt, promptAt, dataUpdatedAt, waiting)) setPrompt(null)
  }, [prompt, promptAt, dataUpdatedAt, pending, setPrompt])

  useEffect(() => {
    if (!active) return
    let timer: number | undefined
    const interceptor = api.interceptors.response.use((response) => {
      const { method, url } = response.config
      const checkedIn = checkedInReservationId(method, url)
      if (checkedIn && promptOnCheckin) setPrompt(checkedIn)
      if (checkedIn || touchesStay(method, url)) {
        // Mehmonlar tarkibi o'zgargan bo'lishi mumkin — navbat qayta o'qiladi
        window.clearTimeout(timer)
        timer = window.setTimeout(() => {
          void qc.invalidateQueries({ queryKey: emehmonKeys.pending })
          void qc.invalidateQueries({ queryKey: ["emehmon", "sheet"] })
        }, 800)
      }
      return response
    })
    return () => {
      window.clearTimeout(timer)
      api.interceptors.response.eject(interceptor)
    }
  }, [active, promptOnCheckin, qc, setPrompt])

  if (!active) return null

  return (
    <>
      {prompt && (
        <div className="fixed bottom-20 left-1/2 z-40 w-[min(92vw,30rem)] -translate-x-1/2">
          <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-card p-3 shadow-lg">
            <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IdCard className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{tr("Mehmon kirdi — E-mehmon'da ro'yxatga oling")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {tr("Davlat ro'yxati kirgandan keyingi 12 soat ichida yuboriladi.")}
              </p>
              <button
                type="button"
                onClick={() => openReservation(prompt)}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                <IdCard className="h-3.5 w-3.5" />
                {tr("Ro'yxatga olish")}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPrompt(null)}
              title={tr("Yopish")}
              className="rounded p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <EmehmonDialog />
      <EmehmonJournalDialog />
    </>
  )
}

/** `3 soat 20 daq oldin kirgan` — nol qismlarsiz. */
function arrivedText(elapsed: { hours: number; minutes: number } | null): string | null {
  if (!elapsed) return null
  if (elapsed.hours === 0 && elapsed.minutes === 0) return tr("hozirgina kirgan")
  if (elapsed.hours === 0) return tr("{{m}} daq oldin kirgan", { m: elapsed.minutes })
  return tr("{{h}} soat {{m}} daq oldin kirgan", { h: elapsed.hours, m: elapsed.minutes })
}

export function EmehmonNavButton() {
  const user = useAuthStore((s) => s.user)
  const { data: cfg } = useEmehmonConfig(!!user)
  const visible = !!cfg?.enabled && cfg.can_operate
  const { data: pending, refetch, isFetching } = useEmehmonPending(visible)
  const openReservation = useEmehmonUi((s) => s.openReservation)
  const setJournalOpen = useEmehmonUi((s) => s.setJournalOpen)
  const [open, setOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  if (!visible || !cfg) return null

  const register = pending?.register ?? []
  const checkout = pending?.checkout ?? []
  const stuck = checkout.filter((c) => !c.auto || c.checkout_error)
  const count = pending?.count ?? 0
  const now = Date.now()

  const toggle = () => {
    const next = !open
    setOpen(next)
    setError(null)
    if (next) void refetch()
  }

  const pick = (item: PendingRegister) => {
    setOpen(false)
    openReservation(item.reservation_id, item.guest_id)
  }

  const checkoutNow = async (item: PendingCheckout) => {
    setBusyId(item.id)
    setError(null)
    try {
      const result = await checkoutRegistration(item.id)
      if (result.status !== "checked_out") setError(result.checkout_error || tr("E-mehmon'dan chiqarib bo'lmadi"))
    } catch (e) {
      setError(apiErrorMessage(e))
    }
    setBusyId(null)
    void refetch()
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        title={tr("E-mehmon — davlat ro'yxati")}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <IdCard className="h-[18px] w-[18px]" />
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-card">
            {count > 9 ? "9+" : count}
          </span>
        ) : (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-card" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(92vw,23rem)] rounded-xl border border-border bg-card p-3 shadow-xl">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">{tr("E-mehmon — davlat ro'yxati")}</p>
            <span className="flex items-center gap-1.5">
              {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              {cfg.environment === "sandbox" && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                  {tr("Sinov muhiti")}
                </span>
              )}
            </span>
          </div>

          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {tr("Ro'yxatga olinmagan mehmonlar ({{n}})", { n: register.length })}
          </p>
          {register.length === 0 ? (
            <p className="mt-1.5 rounded-lg bg-emerald-50 px-2.5 py-2 text-xs text-emerald-700">
              {tr("Xonadagi barcha mehmonlar ro'yxatga olingan")}
            </p>
          ) : (
            <ul className="mt-1.5 max-h-64 space-y-1 overflow-y-auto">
              {register.map((item) => {
                const elapsed = elapsedParts(item.since, now)
                return (
                  <li key={`${item.reservation_id}:${item.guest_id}`}>
                    <button
                      type="button"
                      onClick={() => pick(item)}
                      className="flex w-full items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-left hover:bg-muted"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-foreground">{item.name}</span>
                        <span className={cn("block truncate text-[11px]", item.state === "failed" || item.overdue ? "text-red-600" : "text-muted-foreground")}>
                          {[
                            item.room_number ? tr("xona {{room}}", { room: item.room_number }) : null,
                            item.state === "failed"
                              ? item.error || tr("Xato")
                              : item.overdue
                                ? tr("12 soatdan oshgan")
                                : arrivedText(elapsed),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      {(item.state === "failed" || item.overdue) && <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-red-500" />}
                      <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {checkout.length > 0 && (
            <>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {tr("E-mehmon'dan chiqarilmaganlar ({{n}})", { n: checkout.length })}
              </p>
              <ul className="mt-1.5 max-h-48 space-y-1 overflow-y-auto">
                {checkout.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-foreground">{item.full_name || "—"}</span>
                      <span className={cn("block truncate text-[11px]", item.checkout_error ? "text-red-600" : "text-muted-foreground")}>
                        {item.checkout_error ||
                          (item.auto ? tr("Bir daqiqa ichida avtomatik chiqariladi") : tr("Mehmon chiqib ketgan — E-mehmon'dan chiqaring"))}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => void checkoutNow(item)}
                      disabled={busyId !== null}
                      title={tr("Bron summasi va to'lov turi bo'yicha chiqarish")}
                      className="inline-flex h-7 flex-shrink-0 items-center gap-1 rounded-lg border border-border px-2 text-[11px] font-semibold text-foreground hover:bg-muted disabled:opacity-60"
                    >
                      {busyId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogOut className="h-3 w-3" />}
                      {tr("Chiqarish")}
                    </button>
                  </li>
                ))}
              </ul>
              {stuck.length === 0 && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">{tr("Avtomatik chiqarish yoqilgan — hech narsa qilish shart emas.")}</p>
              )}
            </>
          )}

          {error && <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] leading-snug text-red-700">{error}</p>}

          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setJournalOpen(true)
            }}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-2 text-xs font-medium text-foreground hover:bg-muted"
          >
            <BookUser className="h-3.5 w-3.5" />
            {tr("Ro'yxatlar jurnali")}
          </button>
        </div>
      )}
    </div>
  )
}
