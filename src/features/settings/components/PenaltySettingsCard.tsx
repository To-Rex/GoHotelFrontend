import { useEffect, useRef, useState } from "react"
import { Loader2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiErrorMessage } from "@/lib/apiError"
import { cn } from "@/lib/utils"
import {
  usePenaltySettings,
  useSavePenaltySettings,
  PENALTY_SETTINGS_DEFAULTS,
  type PenaltySettings,
} from "@/features/reservations/api/penalties"
import { tr } from "@/i18n"

/* Jarimalar — kech chiqish taklifi.

   Jarimani resepshn bron oynasida o'zi yozadi (kech chiqish, shikast,
   boshqa). Bu sozlama faqat KECH CHIQISH summasini taklif qilish uchun:
   soatiga qancha va necha daqiqa kechikish kechiriladi. 0 — taklif
   o'chiq (standart), xodim summani qo'lda kiritadi. */

const GRACE_PRESETS = [0, 15, 30, 60]

export const PenaltySettingsCard = () => {
  const { data: saved } = usePenaltySettings()
  const saveMutation = useSavePenaltySettings()
  const [value, setValue] = useState<PenaltySettings>(PENALTY_SETTINGS_DEFAULTS)
  const [savedFlag, setSavedFlag] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirtyRef = useRef(false)

  useEffect(() => {
    if (!saved || dirtyRef.current) return
    setValue(saved)
  }, [saved])

  const update = (next: Partial<PenaltySettings>) => {
    dirtyRef.current = true
    setValue((prev) => ({ ...prev, ...next }))
    setSavedFlag(false)
  }

  const readNumber = (raw: string, max: number) => {
    const n = Number(raw)
    const clean = !Number.isFinite(n) || n < 0 ? 0 : n
    return Math.min(clean, max)
  }

  const onSave = async () => {
    setError(null)
    setSavedFlag(false)
    try {
      await saveMutation.mutateAsync(value)
      dirtyRef.current = false
      setSavedFlag(true)
      window.setTimeout(() => setSavedFlag(false), 3000)
    } catch (e) {
      setError(apiErrorMessage(e))
    }
  }

  const enabled = value.late_hourly_amount > 0
  const checkoutHour = saved?.checkout_hour ?? 12
  // Misol: 2 soat 10 daqiqa kechikish
  const exampleLate = 130
  const exampleHours = Math.max(0, Math.ceil((exampleLate - value.grace_minutes) / 60))
  const exampleAmount = exampleHours * value.late_hourly_amount

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">
            {tr("Kech chiqish — har bir soat uchun")}
          </label>
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              min={0}
              className="h-9"
              value={String(value.late_hourly_amount)}
              onChange={(e) => update({ late_hourly_amount: readNumber(e.target.value, 1_000_000_000) })}
            />
            <span className="shrink-0 text-xs text-gray-400">{tr("so'm")}</span>
          </div>
          <p className="text-[11px] leading-snug text-gray-400">
            {tr("0 — taklif o'chiq: xodim summani o'zi kiritadi")}
          </p>
        </div>

        <div className={cn("space-y-1", !enabled && "pointer-events-none opacity-40")}>
          <label className="text-xs font-medium text-gray-600">
            {tr("Imtiyozli vaqt (kechiriladi)")}
          </label>
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              min={0}
              max={600}
              className="h-9"
              value={String(value.grace_minutes)}
              onChange={(e) => update({ grace_minutes: Math.floor(readNumber(e.target.value, 600)) })}
            />
            <span className="shrink-0 text-xs text-gray-400">{tr("daqiqa")}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {GRACE_PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => update({ grace_minutes: m })}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                  value.grace_minutes === m
                    ? "bg-primary-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {m === 0 ? tr("Yo'q") : tr("{{m}} daq", { m })}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50/60 p-3.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {tr("Qanday ishlaydi")}
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-gray-600">
          <li>
            {tr("Resepshn bron oynasidagi \"Jarimalar\" bo'limida kech chiqish, buzilgan narsa yoki boshqa sabab uchun jarima yozadi — summa bron jamiga qo'shiladi.")}
          </li>
          <li>
            {tr("Kunlik bronda chiqish vaqti — soat {{hour}}:00, soatlik bronda — bron tugash vaqti.", { hour: String(checkoutHour).padStart(2, "0") })}
          </li>
          {enabled ? (
            <li>
              {tr("Misol: mehmon 2 soat 10 daqiqa kechiksa, taklif {{hours}} soat × {{hourly}} = {{amount}} so'm (xodim o'zgartira oladi).", {
                hours: exampleHours,
                hourly: value.late_hourly_amount.toLocaleString(),
                amount: exampleAmount.toLocaleString(),
              })}
            </li>
          ) : (
            <li>{tr("Taklif o'chiq — jarima summasi har safar qo'lda kiritiladi.")}</li>
          )}
          <li>{tr("Jarimani bekor qilish — faqat administrator yoki menejer; bekor qilingan jarima sababi bilan tarixda qoladi.")}</li>
        </ul>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
        <Button onClick={onSave} disabled={saveMutation.isPending} className="min-w-[120px]">
          {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {tr("Saqlash")}
        </Button>
        {savedFlag && (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />{" "}{tr("Saqlandi")}
          </span>
        )}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </>
  )
}
