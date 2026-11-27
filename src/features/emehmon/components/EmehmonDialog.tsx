import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  CheckCircle2,
  ChevronDown,
  IdCard,
  Loader2,
  LogOut,
  RefreshCw,
  Undo2,
  UserRound,
} from "lucide-react"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { tr } from "@/i18n"
import { apiErrorMessage } from "@/lib/apiError"
import { cn } from "@/lib/utils"

import {
  checkoutRegistration,
  emehmonKeys,
  refreshRegistration,
  unskipPerson,
  useEmehmonSheet,
  type EmehmonPerson,
  type EmehmonRegistration,
} from "../api/emehmon"
import { PAYMENT_TYPES, formatMoment, money, stateLabel, stateTone } from "../lib/emehmon"
import { useEmehmonUi } from "../lib/store"
import { EmehmonPersonForm } from "./EmehmonPersonForm"

/* Bronning E-mehmon varag'i: bronda turgan har bir mehmon (asosiy mehmon va
   hamrohlar) uchun alohida davlat ro'yxati. Shu yerdan ro'yxatga olinadi,
   chiqariladi va holat ko'riladi. Oyna `useEmehmonUi` orqali ochiladi. */

const FIELD =
  "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary disabled:opacity-60"

export function EmehmonDialog() {
  const reservationId = useEmehmonUi((s) => s.reservationId)
  const focusGuestId = useEmehmonUi((s) => s.focusGuestId)
  const close = useEmehmonUi((s) => s.closeReservation)
  const qc = useQueryClient()
  const { data, isLoading, error, refetch } = useEmehmonSheet(reservationId)
  const [openGuest, setOpenGuest] = useState<string | null>(null)

  // Oyna ochilganda: so'ralgan mehmon, bo'lmasa ro'yxatga olinmagan birinchisi
  const opened = useRef<string | null>(null)
  useEffect(() => {
    if (!reservationId) {
      opened.current = null
      setOpenGuest(null)
      return
    }
    if (!data || opened.current === reservationId) return
    opened.current = reservationId
    const todo = data.persons.filter((p) => p.present && (p.state === "none" || p.state === "failed"))
    const wanted = todo.find((p) => p.guest_id === focusGuestId) ?? todo[0]
    setOpenGuest(wanted ? wanted.guest_id : null)
  }, [reservationId, data, focusGuestId])

  const changed = async () => {
    const fresh = await refetch()
    void qc.invalidateQueries({ queryKey: emehmonKeys.pending })
    void qc.invalidateQueries({ queryKey: ["emehmon", "journal"] })
    // Ro'yxatga olingach keyingi mehmonning shakli ochiladi
    const next = fresh.data?.persons.find((p) => p.present && (p.state === "none" || p.state === "failed"))
    setOpenGuest((current) => {
      const still = fresh.data?.persons.find((p) => p.guest_id === current)
      if (still && (still.state === "none" || still.state === "failed" || still.state === "skipped")) return current
      return next ? next.guest_id : null
    })
  }

  return (
    <Dialog open={!!reservationId} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-[820px]">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
            <IdCard className="h-5 w-5 text-primary" />
            {tr("E-mehmon — davlat ro'yxati")}
            {data?.environment === "sandbox" && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                {tr("Sinov muhiti")}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {data
              ? [
                  tr("Bron {{number}}", { number: data.reservation.number }),
                  data.reservation.room_number ? tr("xona {{room}}", { room: data.reservation.room_number }) : null,
                  data.reservation.arrived_at ? tr("kirgan: {{time}}", { time: formatMoment(data.reservation.arrived_at) }) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : tr("Har bir mehmon E-mehmon'da alohida ro'yxatga olinadi")}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {tr("Yuklanmoqda...")}
          </p>
        ) : error || !data ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{apiErrorMessage(error)}</p>
        ) : !data.enabled ? (
          <p className="rounded-lg bg-muted px-3 py-3 text-sm text-muted-foreground">
            {tr("E-mehmon integratsiyasi bu filialda yoqilmagan. Uni sozlovchi Sozlamalar → «E-mehmon» bo'limida yoqadi.")}
          </p>
        ) : (
          <div className="space-y-3">
            {data.reservation.status !== "CHECKED_IN" && data.persons.every((p) => !p.registration) && (
              <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                {tr("Ro'yxatga olish mehmon kirgandan (joylashgandan) keyin mumkin.")}
              </p>
            )}
            {data.persons.map((person) => (
              <PersonCard
                key={person.guest_id}
                reservationId={data.reservation.id}
                person={person}
                window={data.window}
                open={openGuest === person.guest_id}
                onToggle={() => setOpenGuest((g) => (g === person.guest_id ? null : person.guest_id))}
                onChanged={changed}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function PersonCard({
  reservationId,
  person,
  window: allowed,
  open,
  onToggle,
  onChanged,
}: {
  reservationId: string
  person: EmehmonPerson
  window: { min: string; max: string }
  open: boolean
  onToggle: () => void
  onChanged: () => void
}) {
  const [busy, setBusy] = useState<"refresh" | "unskip" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const reg = person.registration
  const canRegister = person.present && !!person.form
  const waiting = person.state === "none" || person.state === "failed"

  const run = async (kind: "refresh" | "unskip", action: () => Promise<unknown>) => {
    setBusy(kind)
    setError(null)
    try {
      await action()
      onChanged()
    } catch (e) {
      setError(apiErrorMessage(e))
    }
    setBusy(null)
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 p-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <UserRound className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{person.name}</p>
          <p className="text-xs text-muted-foreground">
            {person.role === "main" ? tr("Asosiy mehmon") : tr("Hamroh")}
            {!person.present && person.state !== "checked_out" && ` · ${tr("xonadan ketgan")}`}
          </p>
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", stateTone(person.state))}>
          {tr(stateLabel(person.state))}
        </span>
        {canRegister && (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold",
              waiting && !open ? "bg-primary text-primary-foreground" : "border border-border text-foreground hover:bg-muted"
            )}
          >
            {open ? tr("Yopish") : tr("Ro'yxatga olish")}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
          </button>
        )}
      </div>

      {reg && person.state === "registered" && (
        <div className="space-y-2 border-t border-border px-3 py-2.5">
          <RegistrationFacts reg={reg} />
          {reg.checkout_error && (
            <p className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
              {tr("Chiqarilmadi")}: {reg.checkout_error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCheckoutOpen((x) => !x)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              <LogOut className="h-3.5 w-3.5" />
              {tr("E-mehmon'dan chiqarish")}
            </button>
            <button
              type="button"
              onClick={() => run("refresh", () => refreshRegistration(reg.id))}
              disabled={busy !== null}
              title={tr("E-mehmon kabinetidagi holat bilan solishtirish")}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-60"
            >
              {busy === "refresh" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {tr("Holatni yangilash")}
            </button>
          </div>
          {checkoutOpen && (
            <CheckoutPanel
              registration={reg}
              defaults={person.checkout}
              onDone={() => {
                setCheckoutOpen(false)
                onChanged()
              }}
            />
          )}
        </div>
      )}

      {reg && person.state === "checked_out" && (
        <div className="border-t border-border px-3 py-2.5">
          <RegistrationFacts reg={reg} />
        </div>
      )}

      {person.state === "skipped" && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2.5 text-xs text-muted-foreground">
          <span>
            {tr("«Kerak emas» deb belgilangan")}
            {reg?.note ? `: ${reg.note}` : ""}
          </span>
          {person.present && (
            <button
              type="button"
              onClick={() => run("unskip", () => unskipPerson(reservationId, person.guest_id))}
              disabled={busy !== null}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-border px-2 font-medium text-foreground hover:bg-muted disabled:opacity-60"
            >
              {busy === "unskip" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
              {tr("Belgini olib tashlash")}
            </button>
          )}
        </div>
      )}

      {error && <p className="mx-3 mb-3 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700">{error}</p>}

      {open && canRegister && (
        <div className="border-t border-border p-3">
          <EmehmonPersonForm reservationId={reservationId} person={person} window={allowed} onChanged={onChanged} />
        </div>
      )}
    </div>
  )
}

function RegistrationFacts({ reg }: { reg: EmehmonRegistration }) {
  const out = reg.status === "checked_out"
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {reg.reg_num ? `№ ${reg.reg_num}` : tr("Ro'yxatga olingan")}
      </span>
      {reg.listok_id != null && <span>ID {reg.listok_id}</span>}
      {reg.registered_at && <span>{tr("ro'yxatga olindi: {{time}}", { time: formatMoment(reg.registered_at) })}</span>}
      {out && reg.checked_out_at && (
        <span>
          {tr("chiqarildi: {{time}}", { time: formatMoment(reg.checked_out_at) })}
          {reg.checkout_auto ? ` (${tr("avtomatik")})` : ""}
        </span>
      )}
      {out && reg.checkout_sum != null && <span>{tr("{{sum}} so'm", { sum: money(reg.checkout_sum) })}</span>}
      {reg.note && <span>{reg.note}</span>}
      {reg.foreign_duplicates.length > 0 && (
        <span className="text-amber-700">
          {tr("Boshqa mehmonxonada ham faol ro'yxati bor ({{n}})", { n: reg.foreign_duplicates.length })}
        </span>
      )}
    </div>
  )
}

export function CheckoutPanel({
  registration,
  defaults,
  onDone,
}: {
  registration: EmehmonRegistration
  defaults: { sum: number; payment_type_id: number } | null
  onDone: () => void
}) {
  const [sum, setSum] = useState(String(defaults?.sum ?? 0))
  const [paymentType, setPaymentType] = useState(defaults?.payment_type_id ?? 2)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await checkoutRegistration(registration.id, {
        sum: Math.max(0, Math.round(Number(sum) || 0)),
        payment_type_id: paymentType,
      })
      if (result.status === "checked_out") onDone()
      else setError(result.checkout_error || tr("E-mehmon'dan chiqarib bo'lmadi"))
    } catch (e) {
      setError(apiErrorMessage(e))
    }
    setBusy(false)
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">{tr("To'lov summasi (so'm)")}</span>
          <input type="number" min={0} className={FIELD} value={sum} onChange={(e) => setSum(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">{tr("To'lov turi")}</span>
          <select className={FIELD} value={paymentType} onChange={(e) => setPaymentType(Number(e.target.value))}>
            {PAYMENT_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {tr(t.label)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          {tr("Chiqarish")}
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
        {tr("Chiqarilgach E-mehmon turizm yig'imini hisoblaydi. Bu amalni qaytarib bo'lmaydi.")}
      </p>
      {error && <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700">{error}</p>}
    </div>
  )
}
