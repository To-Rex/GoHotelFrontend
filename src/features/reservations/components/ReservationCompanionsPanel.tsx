import { useMemo, useState } from "react"
import { Check, Clock, Loader2, LogIn, LogOut, RotateCcw, UserPlus, Users, X } from "lucide-react"

import { Input } from "@/components/ui/input"

import { apiErrorMessage } from "@/lib/apiError"
import { cn } from "@/lib/utils"
import type { Reservation, ReservationCompanion } from "@/types/api"
import {
  useAddCompanion,
  useAddExpectedCompanion,
  useCancelExpectedCompanion,
  useCompanionLeave,
  useCompanionReturn,
  useRemoveCompanion,
} from "../api/reservations"
import {
  canExpectCompanion,
  canMarkLeft,
  canMarkReturned,
  canRemove,
  companionAddCheck,
  expectedCompanions,
  shortMoment,
  companionState,
  companionStatusLabel,
  freeSeats,
  guestCapacity,
  insideCount,
  isPresent,
  type CompanionReservationLike,
  type CompanionState,
} from "../lib/companions"
import { CompanionGuests, type Companion } from "./CompanionGuests"
import { tr } from "@/i18n"

/* Xonadagi mehmonlar — bron boshqarish oynasida.

   Mehmon kirib ketgach xonadagilar o'zgaradi: hamroh ketadi, o'rniga
   boshqasi keladi. Bu bron shartnomasini (sana, narx, mehmonlar soni)
   o'zgartirmaydi, shuning uchun tahrirlash rejimidan alohida va tahrir
   oynasi bilan cheklanmaydi. Yozuv o'chirilmaydi — ketgan hamroh "Ketdi"
   belgisi bilan qoladi (mehmon tarixi, kamera moslashuvi saqlanadi).
   Bo'sh joy shu belgi bo'yicha hisoblanadi; yakuniy tekshiruv serverda
   (companion_ops.py), bu yerda faqat tugmalar oldindan yashiriladi.

   KECHIKIB KELADIGAN hamrohlar (bron yaratilganda yoki keyin belgilangan)
   alohida qatorlarda: joyi band. Kelganda "Keldi" — mehmon tanlanadi /
   yaratiladi va o'sha yozuv o'rniga haqiqiy hamroh bo'ladi; kelmasa
   "Kelmadi" — joy bo'shaydi. */

type PanelReservation = CompanionReservationLike & {
  id: string
  hotel_id?: string
  guest_id: string
}

interface Props {
  reservation: PanelReservation
  mainGuestName: string
  /** Mehmonlar bazasi — yangi hamrohni qidirish uchun */
  guests: any[]
  /** Amallar (ketdi / qaytdi / qo'shish) — reservation.update ruxsati;
      farroshga faqat ro'yxat ko'rinadi */
  canManage: boolean
  /** Xonaning filiali — yangi mijozga kamera yuzi shu bo'yicha tanlanadi */
  branchId?: string | null
  /** Server qaytargan yangilangan bron — ochiq oyna eskirmasin */
  onUpdated: (res: Reservation) => void
}

type PendingConfirm = { guestId: string; kind: "leave" | "remove" | "expected" }

const STATE_CLASS: Record<CompanionState, string> = {
  inside: "bg-emerald-100 text-emerald-700",
  added: "bg-emerald-100 text-emerald-700",
  returned: "bg-sky-100 text-sky-700",
  left: "bg-gray-200 text-gray-600",
}

const ACTION_CLASS =
  "inline-flex flex-shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"

export const ReservationCompanionsPanel = ({
  reservation: res,
  mainGuestName,
  guests,
  canManage,
  branchId,
  onUpdated,
}: Props) => {
  const companions: ReservationCompanion[] = (res.companions || []).filter(Boolean)
  const expected = expectedCompanions(res)
  const capacity = guestCapacity(res.adults)
  const inside = insideCount(res)
  const seats = freeSeats(res)
  const addCheck = companionAddCheck(res)
  const canExpect = canExpectCompanion(res)
  // Hamrohlar o'zgarishi mumkin bo'lgan holatlar
  const active = res.status === "CONFIRMED" || res.status === "CHECKED_IN"

  const [addOpen, setAddOpen] = useState(false)
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null)
  const [error, setError] = useState<string | null>(null)
  /* Qaysi kutilgan hamroh keldi — o'sha qatorda mehmon tanlash ochiq */
  const [attachFor, setAttachFor] = useState<string | null>(null)
  /* "Kechikib keladi" formasi (keyinroq belgilash) */
  const [lateForm, setLateForm] = useState<{ name: string; phone: string; note: string } | null>(
    null
  )

  const addMutation = useAddCompanion()
  const leaveMutation = useCompanionLeave()
  const returnMutation = useCompanionReturn()
  const removeMutation = useRemoveCompanion()
  const expectMutation = useAddExpectedCompanion()
  const cancelExpectedMutation = useCancelExpectedCompanion()
  const busy =
    addMutation.isPending ||
    leaveMutation.isPending ||
    returnMutation.isPending ||
    removeMutation.isPending ||
    expectMutation.isPending ||
    cancelExpectedMutation.isPending

  /* Qidiruvda ichkaridagi hamrohlar chiqmaydi — bir odam ikki marta
     yozilmasin. Ketgani esa chiqadi: qaytib kelsa shu yo'l bilan ham
     kiritiladi (server yangi yozuv ochmaydi, "ketdi"ni bekor qiladi). */
  const searchableGuests = useMemo(() => {
    const present = new Set(companions.filter(isPresent).map((c) => c.guest_id))
    return guests.filter((g) => !present.has(g.id))
  }, [guests, companions])

  // Bir kishilik bron, hamrohi yo'q, amal ham yo'q — ko'rsatadigan narsa yo'q
  if (capacity === 1 && companions.length === 0 && !(canManage && active)) return null

  const hotelId = res.hotel_id || undefined

  const run = async (task: Promise<Reservation>): Promise<boolean> => {
    setError(null)
    try {
      const updated = await task
      onUpdated(updated)
      setConfirm(null)
      return true
    } catch (e) {
      setError(apiErrorMessage(e))
      return false
    }
  }

  const handlePicked = async (next: Companion[], expectedId?: string) => {
    const picked = next[0]
    if (!picked) return
    const ok = await run(
      addMutation.mutateAsync({ id: res.id, guestId: picked.id, hotelId, expectedId })
    )
    if (ok) {
      setAddOpen(false)
      setAttachFor(null)
    }
  }

  const handleConfirm = (pending: PendingConfirm) =>
    pending.kind === "leave"
      ? run(leaveMutation.mutateAsync({ id: res.id, guestId: pending.guestId, hotelId }))
      : pending.kind === "expected"
        ? run(
            cancelExpectedMutation.mutateAsync({
              id: res.id,
              expectedId: pending.guestId,
              hotelId,
            })
          )
        : run(removeMutation.mutateAsync({ id: res.id, guestId: pending.guestId, hotelId }))

  const saveLate = async () => {
    if (!lateForm) return
    const ok = await run(
      expectMutation.mutateAsync({
        id: res.id,
        hotelId,
        name: lateForm.name.trim() || null,
        phone: lateForm.phone.trim() || null,
        note: lateForm.note.trim() || null,
      })
    )
    if (ok) setLateForm(null)
  }

  const handleReturn = (guestId: string) =>
    run(returnMutation.mutateAsync({ id: res.id, guestId, hotelId }))

  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <header className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <Users className="h-4 w-4 text-gray-400" />
          {tr("Xonadagi mehmonlar")}
        </div>
        {/* Mehmonlar soni kamaytirilgan bo'lsa ichkaridagilar ko'p chiqadi —
            sariq: bron tahrirlanishi kerak */}
        <span
          className={cn(
            "text-xs",
            inside > capacity ? "font-medium text-amber-600" : "text-gray-500"
          )}
        >
          {tr("Ichkarida: {{inside}}/{{capacity}}", { inside, capacity })}
          {expected.length > 0 && (
            <span className="ml-1 font-medium text-amber-600">
              {tr("· kutilmoqda: {{count}}", { count: expected.length })}
            </span>
          )}
        </span>
      </header>

      <ul className="divide-y divide-gray-100">
        <li className="flex items-center gap-2 px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-sm text-gray-900">
            {mainGuestName}
          </span>
          <span className="flex-shrink-0 rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] font-medium text-primary-700">
            {tr("Asosiy mehmon")}
          </span>
        </li>

        {companions.map((c) => {
          const state = companionState(c)
          const pending = confirm?.guestId === c.guest_id ? confirm : null
          const showActions = canManage && !pending && !busy
          return (
            <li
              key={c.guest_id}
              className={cn("px-3 py-2", state === "left" && "bg-gray-50/70")}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm",
                    state === "left" ? "text-gray-500" : "text-gray-900"
                  )}
                >
                  {c.name || tr("Ismsiz mehmon")}
                </span>
                <span
                  className={cn(
                    "flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                    STATE_CLASS[state]
                  )}
                >
                  {companionStatusLabel(c)}
                </span>

                {/* KETDI — kirgan bronda, ichkaridagi hamroh. Yozuv qoladi,
                    joy bo'shaydi: o'rniga boshqasini qo'shish mumkin */}
                {showActions && canMarkLeft(res, c) && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      setConfirm({ guestId: c.guest_id, kind: "leave" })
                    }}
                    title={tr("Hamroh xonadan ketdi — joy bo'shaydi, o'rniga boshqasi kelishi mumkin")}
                    className={cn(
                      ACTION_CLASS,
                      "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                    )}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    {tr("Ketdi")}
                  </button>
                )}

                {/* QAYTDI — "ketdi" adashib bosilgan bo'lsa. Joy band bo'lsa
                    (o'rniga boshqasi kirgan) server rad etadi — tugma o'chiq */}
                {showActions && canMarkReturned(res, c) && (
                  <button
                    type="button"
                    disabled={seats === 0}
                    onClick={() => handleReturn(c.guest_id)}
                    title={
                      seats === 0
                        ? tr("Xonada joy yo'q — o'rniga boshqa hamroh kirgan")
                        : tr("\"Ketdi\" belgisini bekor qilish — hamroh xonada")
                    }
                    className={cn(
                      ACTION_CLASS,
                      "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                    )}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {tr("Qaytdi")}
                  </button>
                )}

                {/* OLIB TASHLASH — faqat kirishdan oldin (adashib qo'shilgan).
                    Kirgan bronda tarix saqlanadi: "Ketdi" ishlatiladi */}
                {showActions && canRemove(res) && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      setConfirm({ guestId: c.guest_id, kind: "remove" })
                    }}
                    title={tr("Ro'yxatdan olib tashlash")}
                    className="flex-shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {pending && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                  <span className="min-w-0 flex-1">
                    {pending.kind === "leave"
                      ? tr("Hamroh xonadan ketganini tasdiqlaysizmi? Yozuv saqlanadi, joy bo'shaydi.")
                      : tr("Hamroh ro'yxatdan olib tashlansinmi?")}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleConfirm(pending)}
                    className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-2 py-1 font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
                  >
                    {busy ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    {tr("Ha")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirm(null)}
                    className="rounded-md px-2 py-1 transition-colors hover:bg-amber-100"
                  >
                    {tr("Yo'q")}
                  </button>
                </div>
              )}
            </li>
          )
        })}

        {/* KECHIKIB KELADIGANLAR — joyi band, hali kelmagan */}
        {expected.map((e) => {
          const pending = confirm?.kind === "expected" && confirm.guestId === e.id ? confirm : null
          const attaching = attachFor === e.id
          const since = shortMoment(e.created_at)
          const showActions = canManage && active && !pending && !busy && !attaching
          return (
            <li key={e.id} className="bg-amber-50/40 px-3 py-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 flex-shrink-0 text-amber-500" />
                <span className="min-w-0 flex-1 truncate text-sm text-gray-800">
                  {e.name || tr("Hamroh")}
                  {e.phone && <span className="text-xs text-gray-500"> · {e.phone}</span>}
                </span>
                <span className="flex-shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                  {since
                    ? tr("Kechikib keladi · {{since}}", { since })
                    : tr("Kechikib keladi")}
                </span>
                {showActions && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      setConfirm(null)
                      setAddOpen(false)
                      setAttachFor(e.id)
                    }}
                    title={tr("Hamroh keldi — mehmonni tanlang yoki yangisini qo'shing, u shu joyga biriktiriladi")}
                    className={cn(
                      ACTION_CLASS,
                      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    )}
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    {tr("Keldi")}
                  </button>
                )}
                {showActions && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      setConfirm({ guestId: e.id, kind: "expected" })
                    }}
                    title={tr("Kelmadi — kutish bekor qilinadi, joy bo'shaydi")}
                    className="flex-shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {e.note && <p className="mt-0.5 pl-6 text-[11px] text-gray-500">{e.note}</p>}

              {attaching && (
                <div className="mt-2 space-y-2">
                  <CompanionGuests
                    adults={2}
                    mainGuestId={res.guest_id}
                    guests={searchableGuests}
                    value={[]}
                    onChange={(next) => handlePicked(next, e.id)}
                    required={false}
                    hotelId={hotelId}
                    branchId={branchId}
                    hideHeader
                    slotLabel={() =>
                      e.name
                        ? tr("Kelgan hamroh: {{name}} — tanlang", { name: e.name })
                        : tr("Kelgan hamrohni tanlang")
                    }
                    onError={setError}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                      {addMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                      {addMutation.isPending ? tr("Saqlanmoqda...") : null}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setAttachFor(null)}
                      className="rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100"
                    >
                      {tr("Bekor qilish")}
                    </button>
                  </div>
                </div>
              )}

              {pending && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                  <span className="min-w-0 flex-1">
                    {tr("Hamroh kelmadimi? Kutish bekor qilinadi, joy bo'shaydi.")}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleConfirm(pending)}
                    className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-2 py-1 font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
                  >
                    {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    {tr("Ha")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirm(null)}
                    className="rounded-md px-2 py-1 transition-colors hover:bg-amber-100"
                  >
                    {tr("Yo'q")}
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {/* HAMROH QO'SHISH — bo'sh joyga yoki ketgan o'rniga. Bron yaratishdagi
          bilan bir xil vosita: bazadan qidirish, yangi mijoz, skaner, yuz */}
      {canManage && active && (
        <div className="border-t border-gray-100 px-3 py-2">
          {addOpen ? (
            <div className="space-y-2">
              <CompanionGuests
                adults={2}
                mainGuestId={res.guest_id}
                guests={searchableGuests}
                value={[]}
                onChange={handlePicked}
                required={false}
                hotelId={hotelId}
                branchId={branchId}
                hideHeader
                slotLabel={() => tr("Yangi hamroh tanlanmagan")}
                onError={setError}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                  {addMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                  {addMutation.isPending ? tr("Saqlanmoqda...") : tr("Bo'sh joy: {{seats}}", { seats })}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setAddOpen(false)
                    setError(null)
                  }}
                  className="rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100"
                >
                  {tr("Bekor qilish")}
                </button>
              </div>
            </div>
          ) : lateForm ? (
            /* KECHIKIB KELADI — joy band qilinadi, kelganda "Keldi" */
            <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50/50 p-2.5">
              <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
                <Clock className="h-3.5 w-3.5" />
                {tr("Kechikib keladigan hamroh")}
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                <Input
                  value={lateForm.name}
                  onChange={(e) => setLateForm({ ...lateForm, name: e.target.value })}
                  placeholder={tr("Ismi (ixtiyoriy)")}
                  className="h-8 bg-white text-xs"
                  maxLength={120}
                />
                <Input
                  value={lateForm.phone}
                  onChange={(e) => setLateForm({ ...lateForm, phone: e.target.value })}
                  placeholder={tr("Telefon (ixtiyoriy)")}
                  className="h-8 bg-white text-xs"
                  maxLength={32}
                />
                <Input
                  value={lateForm.note}
                  onChange={(e) => setLateForm({ ...lateForm, note: e.target.value })}
                  placeholder={tr("Izoh: masalan, kechqurun keladi")}
                  className="h-8 bg-white text-xs"
                  maxLength={200}
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setLateForm(null)}
                  className="rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100"
                >
                  {tr("Bekor qilish")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={saveLate}
                  className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
                >
                  {expectMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                  {tr("Saqlash")}
                </button>
              </div>
            </div>
          ) : addCheck.ok ? (
            <div className="space-y-1.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setError(null)
                  setConfirm(null)
                  setAttachFor(null)
                  setAddOpen(true)
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-primary-300 bg-primary-50/40 px-2.5 py-2 text-xs font-medium text-primary-700 transition-colors hover:border-primary-500 hover:bg-primary-50 disabled:opacity-60"
              >
                <UserPlus className="h-4 w-4 text-primary-500" />
                {tr("Hamroh qo'shish")}
                <span className="font-normal text-primary-500/80">{tr("· bo'sh joy: {{seats}}", { seats })}</span>
              </button>
              {canExpect && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setError(null)
                    setConfirm(null)
                    setAttachFor(null)
                    setLateForm({ name: "", phone: "", note: "" })
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-60"
                >
                  <Clock className="h-3.5 w-3.5" />
                  {tr("Hamroh kechikib keladi — joyini band qilish")}
                </button>
              )}
            </div>
          ) : (
            <p className="text-[11px] leading-relaxed text-gray-400">{addCheck.reason}</p>
          )}
        </div>
      )}

      {error && (
        <p className="border-t border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </section>
  )
}
