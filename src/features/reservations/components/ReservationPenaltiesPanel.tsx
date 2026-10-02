import { useState } from "react"
import { format } from "date-fns"
import { AlertTriangle, Clock, Gavel, Loader2, Plus, Undo2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiErrorMessage } from "@/lib/apiError"
import { cn } from "@/lib/utils"
import {
  PENALTY_KINDS,
  PENALTY_STATUSES,
  lateDurationLabel,
  penaltyKindLabel,
  useAddPenalty,
  useReservationPenalties,
  useVoidPenalty,
  type PenaltyChangeResult,
  type PenaltyKind,
} from "../api/penalties"
import { tr } from "@/i18n"

/* Jarimalar — bron boshqarish oynasida.

   Mehmon kech chiqdi yoki biror narsani sindirdi: resepshn jarima yozadi,
   summa bron jamiga qo'shiladi va pastdagi "Qo'shimcha to'lov" paneli
   orqali olinadi. Chiqib ketgan bronga ham yoziladi — shikast keyin
   topilishi mumkin. Jarima o'chirilmaydi: bekor qilingani sababi bilan
   qoladi (bekor qilish — administrator yoki menejer).

   Kech chiqish sozlamasi yoqilgan bo'lsa server kechikkan soatlarni
   hisoblab taklif qiladi; xodim summani o'zgartira oladi. */

interface PanelReservation {
  id: string
  status: string
  penalty_amount?: number | null
}

interface Props {
  reservation: PanelReservation
  /** Jarima qo'shish — reservation.update ruxsati */
  canAdd: boolean
  /** Bekor qilish — administrator yoki shift.force_close */
  canVoid: boolean
  /** Server qaytargan yangi jami — ochiq oyna eskirmasin */
  onUpdated: (change: PenaltyChangeResult) => void
}

const fmt = (n: number) => Number(n || 0).toLocaleString()

const KIND_CLASS: Record<string, string> = {
  LATE_CHECKOUT: "bg-amber-100 text-amber-800",
  DAMAGE: "bg-rose-100 text-rose-700",
  OTHER: "bg-gray-200 text-gray-700",
}

export const ReservationPenaltiesPanel = ({ reservation: res, canAdd, canVoid, onUpdated }: Props) => {
  const eligible = PENALTY_STATUSES.includes(res.status)
  const hasPenalties = Number(res.penalty_amount || 0) > 0
  const { data, isLoading } = useReservationPenalties(res.id, eligible || hasPenalties)
  const addMutation = useAddPenalty()
  const voidMutation = useVoidPenalty()

  const [formOpen, setFormOpen] = useState(false)
  const [kind, setKind] = useState<PenaltyKind>("DAMAGE")
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [voidingId, setVoidingId] = useState<string | null>(null)
  const [voidReason, setVoidReason] = useState("")
  const [voidError, setVoidError] = useState<string | null>(null)

  if (!eligible && !hasPenalties) return null

  const items = data?.items ?? []
  const total = data ? data.total : Number(res.penalty_amount || 0)
  const suggestion = data?.late_suggestion ?? null
  const addAllowed = canAdd && eligible && (data ? data.can_add : true)
  // Kech chiqish jarimasi allaqachon yozilgan bo'lsa taklif qayta chiqmaydi
  const hasLatePenalty = items.some((p) => p.kind === "LATE_CHECKOUT" && !p.voided_at)
  const showSuggestion = !!suggestion && addAllowed && !hasLatePenalty && !formOpen

  // Ko'rsatadigan narsa yo'q: jarima yo'q va qo'shib bo'lmaydi
  if (!isLoading && items.length === 0 && !addAllowed) return null

  const openForm = (nextKind: PenaltyKind, prefill?: number) => {
    setKind(nextKind)
    setAmount(prefill && prefill > 0 ? String(prefill) : "")
    setNote(
      nextKind === "LATE_CHECKOUT" && suggestion
        ? lateDurationLabel(suggestion.late_minutes)
        : ""
    )
    setError(null)
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setAmount("")
    setNote("")
    setError(null)
  }

  const pickKind = (next: PenaltyKind) => {
    setKind(next)
    // Kech chiqishga o'tilsa va summa bo'sh bo'lsa — taklif qo'yiladi
    if (next === "LATE_CHECKOUT" && suggestion && amount.trim() === "") {
      setAmount(String(suggestion.amount))
      if (note.trim() === "") setNote(lateDurationLabel(suggestion.late_minutes))
    }
  }

  const submit = async () => {
    const value = Math.round(Number(amount))
    if (!Number.isFinite(value) || value < 1) {
      setError(tr("Jarima summasini kiriting"))
      return
    }
    setError(null)
    try {
      const result = await addMutation.mutateAsync({
        reservationId: res.id,
        kind,
        amount: value,
        note,
      })
      onUpdated(result)
      closeForm()
    } catch (e) {
      setError(apiErrorMessage(e))
    }
  }

  const confirmVoid = async (penaltyId: string) => {
    setVoidError(null)
    try {
      const result = await voidMutation.mutateAsync({
        reservationId: res.id,
        penaltyId,
        reason: voidReason,
      })
      onUpdated(result)
      setVoidingId(null)
      setVoidReason("")
    } catch (e) {
      setVoidError(apiErrorMessage(e))
    }
  }

  return (
    <div className="space-y-2.5 rounded-lg border border-rose-200 bg-rose-50/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-rose-800">
          <Gavel className="h-4 w-4" />
          {tr("Jarimalar")}
        </p>
        {total > 0 && (
          <b className="text-sm tabular-nums text-rose-700">
            {tr("{{total}} So'm", { total: fmt(total) })}
          </b>
        )}
      </div>

      {isLoading && (
        <p className="flex items-center gap-1.5 text-xs text-gray-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {tr("Yuklanmoqda...")}
        </p>
      )}

      {/* Kiritilgan jarimalar */}
      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((p) => {
            const voided = !!p.voided_at
            return (
              <li
                key={p.id}
                className={cn(
                  "rounded-md border bg-white px-2.5 py-2",
                  voided ? "border-gray-200 opacity-70" : "border-rose-100"
                )}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium",
                          KIND_CLASS[p.kind] || KIND_CLASS.OTHER
                        )}
                      >
                        {penaltyKindLabel(p.kind)}
                      </span>
                      <b
                        className={cn(
                          "text-sm tabular-nums",
                          voided ? "text-gray-400 line-through" : "text-gray-900"
                        )}
                      >
                        {tr("{{amount}} So'm", { amount: fmt(p.amount) })}
                      </b>
                      {voided && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                          {tr("Bekor qilingan")}
                        </span>
                      )}
                    </div>
                    {p.note && (
                      <p className="mt-0.5 break-words text-xs text-gray-600">{p.note}</p>
                    )}
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      {p.created_at ? format(new Date(p.created_at), "dd.MM.yyyy HH:mm") : ""}
                      {p.created_by_name ? ` · ${p.created_by_name}` : ""}
                    </p>
                    {voided && (
                      <p className="mt-0.5 text-[11px] text-gray-500">
                        {tr("Bekor qildi: {{name}}", { name: p.voided_by_name || "—" })}
                        {p.void_reason ? ` · ${p.void_reason}` : ""}
                      </p>
                    )}
                  </div>
                  {!voided && canVoid && voidingId !== p.id && (
                    <button
                      type="button"
                      onClick={() => {
                        setVoidingId(p.id)
                        setVoidReason("")
                        setVoidError(null)
                      }}
                      className="inline-flex flex-shrink-0 items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
                    >
                      <Undo2 className="h-3 w-3" />
                      {tr("Bekor qilish")}
                    </button>
                  )}
                </div>

                {voidingId === p.id && (
                  <div className="mt-2 space-y-2 border-t border-gray-100 pt-2">
                    <Input
                      value={voidReason}
                      onChange={(e) => setVoidReason(e.target.value)}
                      placeholder={tr("Sabab (ixtiyoriy)")}
                      maxLength={500}
                      className="h-8 text-sm"
                    />
                    {voidError && (
                      <p className="rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-600">{voidError}</p>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setVoidingId(null)}
                        disabled={voidMutation.isPending}
                      >
                        {tr("Yo'q")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => confirmVoid(p.id)}
                        disabled={voidMutation.isPending}
                      >
                        {voidMutation.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                        {tr("Jarimani bekor qilish")}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Kech chiqish taklifi (sozlamada yoqilgan bo'lsa) */}
      {showSuggestion && suggestion && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2">
          <Clock className="h-4 w-4 flex-shrink-0 text-amber-600" />
          <p className="min-w-0 flex-1 text-xs text-amber-800">
            {tr("Mehmon {{late}} kechikdi: {{hours}} soat × {{hourly}} = {{amount}} so'm", {
              late: lateDurationLabel(suggestion.late_minutes),
              hours: suggestion.hours,
              hourly: fmt(suggestion.hourly_amount),
              amount: fmt(suggestion.amount),
            })}
          </p>
          <button
            type="button"
            onClick={() => openForm("LATE_CHECKOUT", suggestion.amount)}
            className="rounded-full bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-700"
          >
            {tr("Jarima yozish")}
          </button>
        </div>
      )}

      {/* Qo'shish formasi */}
      {addAllowed && formOpen && (
        <div className="space-y-2.5 rounded-md border border-rose-100 bg-white p-2.5">
          <div className="flex flex-wrap gap-1.5">
            {PENALTY_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => pickKind(k)}
                aria-pressed={kind === k}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                  kind === k
                    ? "bg-rose-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {penaltyKindLabel(k)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={tr("Summa")}
              className="h-9 w-36"
              autoFocus
            />
            <span className="text-xs text-gray-400">{tr("so'm")}</span>
            {kind === "LATE_CHECKOUT" && suggestion && (
              <button
                type="button"
                onClick={() => setAmount(String(suggestion.amount))}
                className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100"
              >
                {tr("Taklif: {{amount}}", { amount: fmt(suggestion.amount) })}
              </button>
            )}
          </div>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              kind === "DAMAGE"
                ? tr("Nima buzildi (masalan: stakan, televizor pulti)")
                : tr("Izoh (ixtiyoriy)")
            }
            maxLength={500}
            className="h-9 text-sm"
          />
          {error && (
            <p className="rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-600">{error}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={closeForm} disabled={addMutation.isPending}>
              <X className="mr-1 h-3.5 w-3.5" />
              {tr("Bekor")}
            </Button>
            <Button type="button" size="sm" onClick={submit} disabled={addMutation.isPending}>
              {addMutation.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {tr("Jarimani yozish")}
            </Button>
          </div>
          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-gray-500">
            <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
            {tr("Summa bron jamiga qo'shiladi va qarz sifatida ko'rinadi — to'lovni pastdagi \"Qo'shimcha to'lov\" orqali qabul qiling.")}
          </p>
        </div>
      )}

      {addAllowed && !formOpen && (
        <button
          type="button"
          onClick={() => openForm(suggestion && !hasLatePenalty ? "LATE_CHECKOUT" : "DAMAGE", suggestion && !hasLatePenalty ? suggestion.amount : undefined)}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-50"
        >
          <Plus className="h-3.5 w-3.5" />
          {tr("Jarima qo'shish")}
        </button>
      )}

      {items.length === 0 && !isLoading && !formOpen && !showSuggestion && (
        <p className="text-[11px] text-gray-500">
          {tr("Kech chiqish yoki buzilgan narsa uchun jarima shu yerda yoziladi.")}
        </p>
      )}
    </div>
  )
}
