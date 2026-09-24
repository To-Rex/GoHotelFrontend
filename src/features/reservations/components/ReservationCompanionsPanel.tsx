import { useMemo, useState } from "react"
import { Check, Loader2, LogOut, RotateCcw, UserPlus, Users, X } from "lucide-react"

import { apiErrorMessage } from "@/lib/apiError"
import { cn } from "@/lib/utils"
import type { Reservation, ReservationCompanion } from "@/types/api"
import {
  useAddCompanion,
  useCompanionLeave,
  useCompanionReturn,
  useRemoveCompanion,
} from "../api/reservations"
import {
  canMarkLeft,
  canMarkReturned,
  canRemove,
  companionAddCheck,
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

/* Xonadagi mehmonlar — bron boshqarish oynasida.

   Mehmon kirib ketgach xonadagilar o'zgaradi: hamroh ketadi, o'rniga
   boshqasi keladi. Bu bron shartnomasini (sana, narx, mehmonlar soni)
   o'zgartirmaydi, shuning uchun tahrirlash rejimidan alohida va tahrir
   oynasi bilan cheklanmaydi. Yozuv o'chirilmaydi — ketgan hamroh "Ketdi"
   belgisi bilan qoladi (mehmon tarixi, kamera moslashuvi saqlanadi).
   Bo'sh joy shu belgi bo'yicha hisoblanadi; yakuniy tekshiruv serverda
   (companion_ops.py), bu yerda faqat tugmalar oldindan yashiriladi. */

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

type PendingConfirm = { guestId: string; kind: "leave" | "remove" }

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
  const capacity = guestCapacity(res.adults)
  const inside = insideCount(res)
  const seats = freeSeats(res)
  const addCheck = companionAddCheck(res)
  // Hamrohlar o'zgarishi mumkin bo'lgan holatlar
  const active = res.status === "CONFIRMED" || res.status === "CHECKED_IN"

  const [addOpen, setAddOpen] = useState(false)
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null)
  const [error, setError] = useState<string | null>(null)

  const addMutation = useAddCompanion()
  const leaveMutation = useCompanionLeave()
  const returnMutation = useCompanionReturn()
  const removeMutation = useRemoveCompanion()
  const busy =
    addMutation.isPending ||
    leaveMutation.isPending ||
    returnMutation.isPending ||
    removeMutation.isPending

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

  const handlePicked = async (next: Companion[]) => {
    const picked = next[0]
    if (!picked) return
    const ok = await run(
      addMutation.mutateAsync({ id: res.id, guestId: picked.id, hotelId })
    )
    if (ok) setAddOpen(false)
  }

  const handleConfirm = (pending: PendingConfirm) =>
    pending.kind === "leave"
      ? run(leaveMutation.mutateAsync({ id: res.id, guestId: pending.guestId, hotelId }))
      : run(removeMutation.mutateAsync({ id: res.id, guestId: pending.guestId, hotelId }))

  const handleReturn = (guestId: string) =>
    run(returnMutation.mutateAsync({ id: res.id, guestId, hotelId }))

  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <header className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <Users className="h-4 w-4 text-gray-400" />
          Xonadagi mehmonlar
        </div>
        {/* Mehmonlar soni kamaytirilgan bo'lsa ichkaridagilar ko'p chiqadi —
            sariq: bron tahrirlanishi kerak */}
        <span
          className={cn(
            "text-xs",
            inside > capacity ? "font-medium text-amber-600" : "text-gray-500"
          )}
        >
          Ichkarida: {inside}/{capacity}
        </span>
      </header>

      <ul className="divide-y divide-gray-100">
        <li className="flex items-center gap-2 px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-sm text-gray-900">
            {mainGuestName}
          </span>
          <span className="flex-shrink-0 rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] font-medium text-primary-700">
            Asosiy mehmon
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
                  {c.name || "Ismsiz mehmon"}
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
                    title="Hamroh xonadan ketdi — joy bo'shaydi, o'rniga boshqasi kelishi mumkin"
                    className={cn(
                      ACTION_CLASS,
                      "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                    )}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Ketdi
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
                        ? "Xonada joy yo'q — o'rniga boshqa hamroh kirgan"
                        : "\"Ketdi\" belgisini bekor qilish — hamroh xonada"
                    }
                    className={cn(
                      ACTION_CLASS,
                      "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                    )}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Qaytdi
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
                    title="Ro'yxatdan olib tashlash"
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
                      ? "Hamroh xonadan ketganini tasdiqlaysizmi? Yozuv saqlanadi, joy bo'shaydi."
                      : "Hamroh ro'yxatdan olib tashlansinmi?"}
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
                    Ha
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirm(null)}
                    className="rounded-md px-2 py-1 transition-colors hover:bg-amber-100"
                  >
                    Yo'q
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
                slotLabel={() => "Yangi hamroh tanlanmagan"}
                onError={setError}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                  {addMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                  {addMutation.isPending ? "Saqlanmoqda..." : `Bo'sh joy: ${seats}`}
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
                  Bekor qilish
                </button>
              </div>
            </div>
          ) : addCheck.ok ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setError(null)
                setConfirm(null)
                setAddOpen(true)
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-primary-300 bg-primary-50/40 px-2.5 py-2 text-xs font-medium text-primary-700 transition-colors hover:border-primary-500 hover:bg-primary-50 disabled:opacity-60"
            >
              <UserPlus className="h-4 w-4 text-primary-500" />
              Hamroh qo'shish
              <span className="font-normal text-primary-500/80">· bo'sh joy: {seats}</span>
            </button>
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
