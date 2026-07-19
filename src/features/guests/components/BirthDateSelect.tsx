import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

const MONTHS = [
  "Yanvar",
  "Fevral",
  "Mart",
  "Aprel",
  "May",
  "Iyun",
  "Iyul",
  "Avgust",
  "Sentabr",
  "Oktabr",
  "Noyabr",
  "Dekabr",
]

// Berilgan oyda nechta kun borligi (kabisa yilini ham hisobga oladi)
function daysInMonth(year: number, month: number): number {
  if (!month) return 31
  return new Date(year || 2000, month, 0).getDate()
}

interface Parts {
  day: number
  month: number
  year: number
}

function splitValue(value?: string): Parts {
  const [y = "", m = "", d = ""] = (value || "").split("-")
  return { day: Number(d) || 0, month: Number(m) || 0, year: Number(y) || 0 }
}

// Uchala qism to'liq bo'lgandagina "yyyy-MM-dd" hosil bo'ladi
function composeValue({ day, month, year }: Parts): string {
  if (!day || !month || !year) return ""
  const clamped = Math.min(day, daysInMonth(year, month))
  return `${year}-${String(month).padStart(2, "0")}-${String(clamped).padStart(2, "0")}`
}

const selectClass =
  "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-2 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"

export interface BirthDateSelectProps {
  /** "yyyy-MM-dd" yoki bo'sh satr */
  value?: string
  onChange: (value: string) => void
  className?: string
}

/**
 * Tug'ilgan sana uchun Kun / Oy / Yil tanlagichi.
 *
 * Native <input type="date"> tug'ilgan sana uchun noqulay — kalendarni o'nlab
 * yil orqaga aylantirish kerak bo'ladi. Bu yerda uchta ro'yxatdan tanlanadi.
 *
 * Tanlangan qismlar komponent ichida saqlanadi: tashqariga faqat to'liq sana
 * yuboriladi, lekin foydalanuvchi qismlarni istalgan tartibda tanlay oladi
 * (yarim tanlov ham ekranda ko'rinib turadi).
 */
export function BirthDateSelect({ value, onChange, className }: BirthDateSelectProps) {
  const [parts, setParts] = useState<Parts>(() => splitValue(value))
  // Oxirgi marta tashqariga yuborilgan qiymat — tashqi o'zgarishni (masalan
  // forma tozalanganini) o'z yuborganimizdan ajratish uchun.
  const lastEmitted = useRef<string>(value || "")

  useEffect(() => {
    const incoming = value || ""
    if (incoming !== lastEmitted.current) {
      setParts(splitValue(incoming))
      lastEmitted.current = incoming
    }
  }, [value])

  const update = (next: Parts) => {
    // Oy/yil o'zgarganda kun oy chegarasidan chiqib ketmasin
    const maxDay = daysInMonth(next.year, next.month)
    const fixed = { ...next, day: next.day > maxDay ? maxDay : next.day }
    setParts(fixed)
    const out = composeValue(fixed)
    lastEmitted.current = out
    onChange(out)
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 110 }, (_, i) => currentYear - i)
  const days = Array.from({ length: daysInMonth(parts.year, parts.month) }, (_, i) => i + 1)

  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      <select
        className={selectClass}
        value={parts.day || ""}
        onChange={(e) => update({ ...parts, day: Number(e.target.value) })}
      >
        <option value="">Kun</option>
        {days.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      <select
        className={selectClass}
        value={parts.month || ""}
        onChange={(e) => update({ ...parts, month: Number(e.target.value) })}
      >
        <option value="">Oy</option>
        {MONTHS.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </select>

      <select
        className={selectClass}
        value={parts.year || ""}
        onChange={(e) => update({ ...parts, year: Number(e.target.value) })}
      >
        <option value="">Yil</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  )
}
