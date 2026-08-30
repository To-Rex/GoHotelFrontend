import { useEffect, useRef, useState } from "react"
import { Loader2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { apiErrorMessage } from "@/lib/apiError"
import { cn } from "@/lib/utils"
import {
  useDiscountRules,
  useSaveDiscountRules,
  EMPTY_RULE,
  type DiscountRule,
  type DiscountRules,
} from "../api/discountRules"

/* Chegirma qoidalari — administrator uchun.

   Qoida mehmonxonaga tegishli: administrator belgilaydi, qolgan xodimlar
   bron oynasida shu doirada ishlaydi. Haqiqiy to'siq serverda — bu yerda
   faqat qiymatlar kiritiladi.

   Kunlik va soatlik bron alohida sozlanadi, chunki ular boshqa-boshqa
   savdo: soatlik bronda "2 soatdan qisqasiga chegirma yo'q" mantiqiy,
   kunlikda esa "3 kechadan boshlab chegirma" mantiqiy. */

const FIELDS: Array<{
  key: keyof Omit<DiscountRule, "enabled">
  label: (unit: string) => string
  hint: string
  suffix: string
  max?: number
}> = [
  {
    key: "max_percent",
    label: () => "Eng ko'p foiz",
    hint: "0 — cheklovsiz",
    suffix: "%",
    max: 100,
  },
  {
    key: "max_amount",
    label: () => "Eng ko'p summa",
    hint: "0 — cheklovsiz",
    suffix: "so'm",
  },
  {
    key: "min_duration",
    label: (unit) => `Eng qisqa davomiylik (${unit})`,
    hint: "shu qiymatdan qisqa bronga chegirma berilmaydi",
    suffix: "",
  },
  {
    key: "max_duration",
    label: (unit) => `Eng uzun davomiylik (${unit})`,
    hint: "shu qiymatdan uzun bronga chegirma berilmaydi",
    suffix: "",
  },
]

const RuleEditor = ({
  title,
  unit,
  rule,
  onChange,
}: {
  title: string
  unit: string
  rule: DiscountRule
  onChange: (next: DiscountRule) => void
}) => (
  <div className="rounded-xl border border-gray-200 p-4">
    <label className="flex cursor-pointer items-start gap-2.5">
      <Checkbox
        checked={rule.enabled}
        onCheckedChange={(v) => onChange({ ...rule, enabled: v === true })}
        className="mt-0.5"
      />
      <span>
        <span className="block text-sm font-semibold text-gray-900">{title}</span>
        <span className="mt-0.5 block text-xs text-gray-500">
          {rule.enabled
            ? "Chegirma berish mumkin — chegaralar quyida"
            : "Chegirma berish o'chirilgan: bron oynasida maydon yopiladi"}
        </span>
      </span>
    </label>

    <div
      className={cn(
        "mt-3 grid gap-3 sm:grid-cols-2",
        !rule.enabled && "pointer-events-none opacity-40"
      )}
    >
      {FIELDS.map((field) => (
        <div key={field.key} className="space-y-1">
          <label className="text-xs font-medium text-gray-600">
            {field.label(unit)}
          </label>
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              min={0}
              max={field.max}
              className="h-9"
              value={String(rule[field.key] ?? 0)}
              onChange={(e) => {
                const raw = Number(e.target.value)
                const clean = !isFinite(raw) || raw < 0 ? 0 : raw
                onChange({
                  ...rule,
                  [field.key]: field.max ? Math.min(clean, field.max) : clean,
                })
              }}
            />
            {field.suffix && (
              <span className="shrink-0 text-xs text-gray-400">{field.suffix}</span>
            )}
          </div>
          <p className="text-[11px] leading-snug text-gray-400">{field.hint}</p>
        </div>
      ))}
    </div>
  </div>
)

export const DiscountRulesCard = () => {
  const { data: saved } = useDiscountRules()
  const saveMutation = useSaveDiscountRules()
  const [rules, setRules] = useState<DiscountRules>({
    daily: EMPTY_RULE,
    hourly: EMPTY_RULE,
  })
  const [savedFlag, setSavedFlag] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Admin qiymatlarni o'zgartirgan bo'lsa, fonda kelgan javob ularni bosib
  // ketmasligi kerak — oyna qayta faollashganda ish yo'qolmasin
  const dirtyRef = useRef(false)

  useEffect(() => {
    if (!saved || dirtyRef.current) return
    setRules(saved)
  }, [saved])

  const update = (key: keyof DiscountRules, next: DiscountRule) => {
    dirtyRef.current = true
    setRules((prev) => ({ ...prev, [key]: next }))
    setSavedFlag(false)
  }

  const onSave = async () => {
    setError(null)
    setSavedFlag(false)
    try {
      await saveMutation.mutateAsync(rules)
      dirtyRef.current = false
      setSavedFlag(true)
      window.setTimeout(() => setSavedFlag(false), 3000)
    } catch (e) {
      setError(apiErrorMessage(e))
    }
  }

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-2">
        <RuleEditor
          title="Kunlik bron"
          unit="kecha"
          rule={rules.daily}
          onChange={(next) => update("daily", next)}
        />
        <RuleEditor
          title="Soatlik bron"
          unit="soat"
          rule={rules.hourly}
          onChange={(next) => update("hourly", next)}
        />
      </div>

      <p className="mt-3 text-xs leading-relaxed text-gray-400">
        Chegara ikki xil o'lchovda ishlaydi: xodim foizda kiritsa ham, so'mda
        kiritsa ham ikkalasi tekshiriladi — biri orqali ikkinchisini chetlab
        o'tib bo'lmaydi. Tekshiruv serverda ham takrorlanadi.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
        <Button
          onClick={onSave}
          disabled={saveMutation.isPending}
          className="min-w-[120px]"
        >
          {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Saqlash
        </Button>
        {savedFlag && (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
            <CheckCircle2 className="h-4 w-4" /> Saqlandi
          </span>
        )}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </>
  )
}
