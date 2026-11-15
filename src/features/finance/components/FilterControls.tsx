import { FilterX } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatAmountInput } from "@/features/expenses/lib/categoryStyle"
import type { SortDir } from "@/lib/tableState"
import { parseSortOption, type Option } from "../lib/financeFilters"
import { tr } from "@/i18n"

/* Moliya bo'limlarining filtr boshqaruvlari — to'lovlar, do'kon,
   hisob-fakturalar va jarimalarda bir xil ko'rinish va ishlash (xodim
   bittasini o'rgansa qolganini ham biladi). Xarajatlar sahifasidagi
   filtrlar bilan ham bir xil uslubda. */

/** Tanlagich va maydonlar — qidiruv maydoni bilan bir xil balandlikda */
const filterControlClass =
  "h-9 rounded-md border border-input bg-white px-2.5 text-sm text-gray-700 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

/** Chip ranglari — jadvaldagi belgilar bilan bir xil */
const CHIP_TONES: Record<string, { idle: string; active: string }> = {
  source: { idle: "bg-gray-50 text-gray-700 ring-gray-200", active: "bg-gray-800 text-white ring-gray-800" },
  room: { idle: "bg-blue-50 text-blue-700 ring-blue-100", active: "bg-blue-600 text-white ring-blue-600" },
  penalty: { idle: "bg-rose-50 text-rose-700 ring-rose-100", active: "bg-rose-600 text-white ring-rose-600" },
  service: { idle: "bg-amber-50 text-amber-700 ring-amber-100", active: "bg-amber-500 text-white ring-amber-500" },
  shop: { idle: "bg-violet-50 text-violet-700 ring-violet-100", active: "bg-violet-600 text-white ring-violet-600" },
  debt: { idle: "bg-orange-50 text-orange-700 ring-orange-100", active: "bg-orange-500 text-white ring-orange-500" },
  refund: { idle: "bg-gray-100 text-gray-700 ring-gray-200", active: "bg-gray-600 text-white ring-gray-600" },
  extra: { idle: "bg-teal-50 text-teal-700 ring-teal-100", active: "bg-teal-600 text-white ring-teal-600" },
  neutral: { idle: "bg-white text-gray-600 ring-gray-200", active: "bg-primary-600 text-white ring-primary-600" },
}

/** Yoqib-o'chiriladigan filtr chipi */
export function FilterChip({
  active,
  onClick,
  tone = "neutral",
  children,
  title,
}: {
  active: boolean
  onClick: () => void
  tone?: string
  children: React.ReactNode
  title?: string
}) {
  const colors = CHIP_TONES[tone] ?? CHIP_TONES.neutral
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={cn(
        "inline-flex h-7 flex-shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium ring-1 ring-inset transition-colors",
        active ? colors.active : cn(colors.idle, "hover:brightness-95")
      )}
    >
      {children}
    </button>
  )
}

/** "Hammasi" chipi — guruhdagi tanlovni olib tashlaydi */
export function AllChip({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <FilterChip active={active} onClick={onClick}>
      {tr("Hammasi")}
    </FilterChip>
  )
}

/** Tanlagich: birinchi variant — "hammasi" (qiymati bo'sh) */
export function OptionSelect({
  value,
  onChange,
  options,
  allLabel,
  label,
  className,
}: {
  value: string
  onChange: (value: string) => void
  options: ReadonlyArray<Option>
  allLabel: string
  label: string
  className?: string
}) {
  return (
    <select
      className={cn(filterControlClass, "min-w-[150px] flex-1 sm:flex-none", value && "border-primary-300 bg-primary-50/40 text-primary-800", className)}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      title={label}
    >
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

/** Summa oralig'i: "dan — gacha", raqamlar bo'shliq bilan guruhlanadi */
export function AmountRange({
  min,
  max,
  onChange,
}: {
  min: string
  max: string
  onChange: (next: { min: string; max: string }) => void
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        inputMode="numeric"
        className={cn(filterControlClass, "w-[104px] tabular-nums")}
        placeholder={tr("Summa dan")}
        aria-label={tr("Summa dan")}
        value={min}
        onChange={(e) => onChange({ min: formatAmountInput(e.target.value), max })}
      />
      <span className="text-xs text-gray-400">—</span>
      <input
        type="text"
        inputMode="numeric"
        className={cn(filterControlClass, "w-[104px] tabular-nums")}
        placeholder={tr("gacha")}
        aria-label={tr("Summa gacha")}
        value={max}
        onChange={(e) => onChange({ min, max: formatAmountInput(e.target.value) })}
      />
    </div>
  )
}

/** Belgilash katakchasi ko'rinishidagi filtr ("Faqat tahrirlanganlar") */
export function ToggleFilter({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  children: React.ReactNode
}) {
  return (
    <label
      className={cn(
        "inline-flex h-9 cursor-pointer select-none items-center gap-2 rounded-md border px-2.5 text-sm transition-colors",
        checked ? "border-primary-300 bg-primary-50/60 text-primary-800" : "border-input bg-white text-gray-600 hover:bg-gray-50"
      )}
    >
      <input
        type="checkbox"
        className="h-3.5 w-3.5 accent-primary-600"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {children}
    </label>
  )
}

/** Mobil saralash: jadval sarlavhasi yo'q joyda (md dan tor ekran) */
export function SortSelect({
  sortBy,
  sortDir,
  options,
  onChange,
  className,
}: {
  sortBy: string
  sortDir: SortDir
  options: ReadonlyArray<Option>
  onChange: (next: { sortBy: string; sortDir: SortDir }) => void
  className?: string
}) {
  const value = `${sortBy}:${sortDir}`
  const known = options.some((o) => o.value === value)
  return (
    <select
      className={cn(filterControlClass, "flex-1 md:hidden", className)}
      value={value}
      onChange={(e) => onChange(parseSortOption(e.target.value))}
      aria-label={tr("Saralash")}
    >
      {/* Kompyuterda sarlavha bilan tanlangan tartib ro'yxatda bo'lmasa ham ko'rinsin */}
      {!known && <option value={value}>{tr("Tanlangan ustun bo'yicha")}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

/** "Tozalash (3)" — barcha filtr va qidiruvni olib tashlaydi */
export function ResetFilters({ count, onReset }: { count: number; onReset: () => void }) {
  if (count <= 0) return null
  return (
    <button
      type="button"
      onClick={onReset}
      className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    >
      <FilterX className="h-3.5 w-3.5" />
      {tr("Tozalash ({{count}})", { count })}
    </button>
  )
}

/** Filtr natijasi: "Topildi: 12 ta · 1 250 000 So'm" (+ qo'shimcha bo'laklar) */
export function FoundLine({
  count,
  amount,
  extra,
  busy,
}: {
  count: number
  amount?: number | null
  extra?: React.ReactNode
  busy?: boolean
}) {
  const fmt = (n: number) => Number(n || 0).toLocaleString()
  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500", busy && "opacity-60")}>
      <span>
        {tr("Topildi: {{count}} ta", { count })}
        {amount !== undefined && amount !== null && (
          <>
            {" · "}
            <b className="font-semibold tabular-nums text-gray-800">
              {tr("{{amount}} So'm", { amount: fmt(amount) })}
            </b>
          </>
        )}
      </span>
      {extra}
    </p>
  )
}
