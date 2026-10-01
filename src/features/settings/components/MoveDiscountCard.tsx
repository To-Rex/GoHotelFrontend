import { useEffect, useRef, useState } from "react"
import { Loader2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { apiErrorMessage } from "@/lib/apiError"
import { cn } from "@/lib/utils"
import {
  useMoveDiscountSettings,
  useSaveMoveDiscountSettings,
  MOVE_DISCOUNT_DEFAULTS,
  type MoveDiscountSettings,
} from "../api/moveDiscount"
import { tr } from "@/i18n"

/* Xona almashtirishda chegirma — administrator uchun.

   Mehmon qimmatroq xonaga o'tganda resepshn narx farqidan chegirma bera
   oladimi va eng ko'p qancha. Haqiqiy to'siq serverda — bu yerda faqat
   qiymatlar kiritiladi. */

const PERCENT_PRESETS = [25, 50, 100]

export const MoveDiscountCard = () => {
  const { data: saved } = useMoveDiscountSettings()
  const saveMutation = useSaveMoveDiscountSettings()
  const [value, setValue] = useState<MoveDiscountSettings>(MOVE_DISCOUNT_DEFAULTS)
  const [savedFlag, setSavedFlag] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Admin qiymatlarni o'zgartirgan bo'lsa, fonda kelgan javob ularni bosib
  // ketmasligi kerak
  const dirtyRef = useRef(false)

  useEffect(() => {
    if (!saved || dirtyRef.current) return
    setValue(saved)
  }, [saved])

  const update = (next: Partial<MoveDiscountSettings>) => {
    dirtyRef.current = true
    setValue((prev) => ({ ...prev, ...next }))
    setSavedFlag(false)
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

  const readNumber = (raw: string, max?: number) => {
    const n = Number(raw)
    const clean = !Number.isFinite(n) || n < 0 ? 0 : n
    return max !== undefined ? Math.min(clean, max) : clean
  }

  // Misol: 100 000 lik xonadan 150 000 likka (2 kecha) — farq 100 000
  const exampleDiff = 100_000
  let exampleMax = exampleDiff
  if (value.max_percent > 0) exampleMax = Math.min(exampleMax, (exampleDiff * value.max_percent) / 100)
  if (value.max_amount > 0) exampleMax = Math.min(exampleMax, value.max_amount)
  exampleMax = Math.floor(exampleMax)

  return (
    <>
      <label className="flex cursor-pointer items-start gap-2.5">
        <Checkbox
          checked={value.enabled}
          onCheckedChange={(v) => update({ enabled: v === true })}
          className="mt-0.5"
        />
        <span className="text-sm">
          <b className="font-medium text-gray-900">
            {tr("Resepshn xona almashtirishda chegirma bera oladi")}
          </b>
          <span className="mt-0.5 block text-xs leading-relaxed text-gray-500">
            {value.enabled
              ? tr("Mehmon qimmatroq xonaga o'tganda xodim narx farqidan chegirma qila oladi — quyidagi chegara doirasida.")
              : tr("Xodim chegirma bera olmaydi: mehmon qimmatroq xonaga o'tsa, narx farqi to'liq olinadi.")}
          </span>
        </span>
      </label>

      <div
        className={cn(
          "mt-4 grid gap-3 sm:grid-cols-2",
          !value.enabled && "pointer-events-none opacity-40"
        )}
      >
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">
            {tr("Eng ko'p chegirma — narx farqidan")}
          </label>
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              min={0}
              max={100}
              className="h-9"
              value={String(value.max_percent)}
              onChange={(e) => update({ max_percent: readNumber(e.target.value, 100) })}
            />
            <span className="shrink-0 text-xs text-gray-400">%</span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {PERCENT_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => update({ max_percent: p })}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                  value.max_percent === p
                    ? "bg-primary-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {p}%
              </button>
            ))}
          </div>
          <p className="text-[11px] leading-snug text-gray-400">{tr("0 — cheklovsiz (farqning hammasigacha)")}</p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">
            {tr("Eng ko'p summa (bir almashtirishda)")}
          </label>
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              min={0}
              className="h-9"
              value={String(value.max_amount)}
              onChange={(e) => update({ max_amount: readNumber(e.target.value) })}
            />
            <span className="shrink-0 text-xs text-gray-400">{tr("so'm")}</span>
          </div>
          <p className="text-[11px] leading-snug text-gray-400">{tr("0 — cheklovsiz")}</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50/60 p-3.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {tr("Qanday ishlaydi")}
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-gray-600">
          <li>
            {tr("Chegirma faqat qimmatroq xonaga o'tishda va faqat narx farqidan beriladi — mehmon avvalgi xona narxidan kam to'lamaydi.")}
          </li>
          {value.enabled && (
            <li>
              {tr("Misol: farq {{diff}} so'm bo'lsa, xodim ko'pi bilan {{max}} so'm chegirma qila oladi.", { diff: exampleDiff.toLocaleString(), max: exampleMax.toLocaleString() })}
            </li>
          )}
          <li>{tr("Administrator bu sozlamaga bog'lanmaydi — narx farqining hammasigacha chegirma bera oladi.")}</li>
          <li>
            {tr("Chegirma bron tarixida kim bergani bilan yoziladi va hisob-fakturada umumiy chegirmaga qo'shiladi.")}
          </li>
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
