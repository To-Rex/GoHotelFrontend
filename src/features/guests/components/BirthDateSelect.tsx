import { useEffect, useRef, useState } from "react"
import { CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Tug'ilgan sana uchun tezkor maskali maydon.
 *
 * Uchta ro'yxatdan tanlash o'rniga raqamlar ketma-ket teriladi: "15081990"
 * yozilsa avtomatik "15.08.1990" ko'rinishga tushadi (nuqtalarni qo'lda
 * yozish shart emas, yozilsa ham qabul qilinadi). To'liq va to'g'ri sana
 * kiritilgandagina tashqariga "yyyy-MM-dd" yuboriladi, aks holda bo'sh satr.
 * O'ngdagi ko'rsatkich yoshni chiqarib beradi — xato terilgani darrov seziladi.
 */

// Terilgan raqamlar -> "kk.oo.yyyy" ko'rinishi
function formatDigits(digits: string): string {
  const d = digits.slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}.${d.slice(2)}`
  return `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4)}`
}

// 8 ta raqam to'g'ri sanani bersa ISO qaytaradi, aks holda null
function isoFromDigits(digits: string): string | null {
  if (digits.length !== 8) return null
  const day = Number(digits.slice(0, 2))
  const month = Number(digits.slice(2, 4))
  const year = Number(digits.slice(4))
  const currentYear = new Date().getFullYear()
  if (year < 1900 || year > currentYear) return null
  if (month < 1 || month > 12) return null
  const maxDay = new Date(year, month, 0).getDate()
  if (day < 1 || day > maxDay) return null
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

// Tashqaridan kelgan ISO qiymatni terish raqamlariga aylantirish
function digitsFromIso(value?: string): string {
  const m = (value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return ""
  return `${m[3]}${m[2]}${m[1]}`
}

function ageFromIso(iso: string): number {
  const b = new Date(iso)
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  const beforeBirthday =
    now.getMonth() < b.getMonth() ||
    (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())
  if (beforeBirthday) age -= 1
  return age
}

export interface BirthDateSelectProps {
  /** "yyyy-MM-dd" yoki bo'sh satr */
  value?: string
  onChange: (value: string) => void
  className?: string
}

export function BirthDateSelect({ value, onChange, className }: BirthDateSelectProps) {
  const [digits, setDigits] = useState<string>(() => digitsFromIso(value))
  // Oxirgi yuborilgan qiymat — tashqi o'zgarishni (forma tozalanishi) o'z
  // yuborganimizdan ajratish uchun
  const lastEmitted = useRef<string>(value || "")

  useEffect(() => {
    const incoming = value || ""
    if (incoming !== lastEmitted.current) {
      setDigits(digitsFromIso(incoming))
      lastEmitted.current = incoming
    }
  }, [value])

  const handleChange = (raw: string) => {
    const next = raw.replace(/\D/g, "").slice(0, 8)
    setDigits(next)
    const iso = isoFromDigits(next)
    const out = iso ?? ""
    lastEmitted.current = out
    onChange(out)
  }

  const complete = digits.length === 8
  const iso = isoFromDigits(digits)
  const invalid = complete && !iso

  return (
    <div className={cn("relative", className)}>
      <CalendarDays
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <input
        type="text"
        inputMode="numeric"
        placeholder="kk.oo.yyyy — masalan 15.08.1990"
        value={formatDigits(digits)}
        onChange={(e) => handleChange(e.target.value)}
        className={cn(
          "flex h-10 w-full items-center rounded-md border bg-background py-2 pl-9 pr-20 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-offset-2",
          invalid
            ? "border-destructive focus:ring-destructive"
            : "border-input focus:ring-ring"
        )}
      />
      {/* O'ng tomonda jonli holat: yosh yoki xato belgisi */}
      {iso && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
          {ageFromIso(iso)} yosh
        </span>
      )}
      {invalid && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-destructive">
          Noto'g'ri sana
        </span>
      )}
    </div>
  )
}
