import { useEffect, useRef } from "react"
import { format } from "date-fns"
import { Check } from "lucide-react"

import { tr, trc } from "@/i18n"
import { UZ_MONTHS } from "@/lib/clock"
import { cn } from "@/lib/utils"
import type { CashBreakdown } from "../api/shifts"
import { cutRows, parseDay, type CutChoice } from "../lib/cashCuts"

const fmt = (n: number) => Number(n || 0).toLocaleString()
const stamp = (iso: string) => format(new Date(iso), "dd.MM HH:mm")

/** Kesim yopgan ish kuni: "17-noyabr" / "17 ноября" / "17 November".
 *  Oy nomi lug'atdan olinadi: brauzerlar o'zbekcha oy nomlarini bilmaydi
 *  (`Intl` "M11 17" qaytaradi). */
const dayLabel = (day: string) => {
  const date = parseDay(day)
  return tr("{{day}}-{{month}}", {
    day: date.getDate(),
    month: tr(UZ_MONTHS[date.getMonth()]),
  })
}

/* Kassani kunlik kesim bo'yicha topshirish — davr tanlash.

   Kassa bir necha kun topshirilmagan bo'lsa, har kesim kuni alohida qator
   bo'lib chiqadi (eng eskisi tepada), oxirida — "kesimdan keyin" (bugungi,
   hali tugamagan kun). Xodim qaysi kungacha topshirishini bosadi: o'sha
   qatorgacha bo'lgan hammasi belgilanadi (ketma-ket), qolgani kassada
   qoladi. Oxirgi qator bosilsa — avvalgidek hamma pul topshiriladi.

   Sessiyaga kesim tushmagan bo'lsa (oxirgi kesimdan keyin ochilgan) —
   tanlashga hech narsa yo'q, komponent ko'rinmaydi. */
export function CashCutPicker({
  data,
  choice,
  onChange,
}: {
  data: CashBreakdown | undefined
  /** `null` — xodim hali tanlamagan (standart: oxirgi kesimgacha) */
  choice: CutChoice | null
  onChange: (choice: CutChoice) => void
}) {
  const rows = cutRows(data, choice)
  const listRef = useRef<HTMLDivElement | null>(null)
  const selectedRef = useRef<HTMLButtonElement | null>(null)

  // Kunlar ko'p bo'lsa ro'yxat aylanadi. Ochilganda (va kunlar soni
  // o'zgarganda) tanlangan qator o'rtaga keltiriladi — undan keyingi
  // "kesimdan keyin" qatori ham ko'rinib tursin. Faqat ro'yxatning o'zi
  // suriladi (`scrollIntoView` dialogni ham surib yuborardi); xodim qatorni
  // bosganda esa ro'yxat joyidan qimirlamaydi.
  useEffect(() => {
    const list = listRef.current
    const row = selectedRef.current
    if (!list || !row) return
    list.scrollTop = row.offsetTop - (list.clientHeight - row.offsetHeight) / 2
  }, [rows.length])

  if (rows.length === 0) return null
  const everything = rows[rows.length - 1].selected

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-gray-600">{tr("Qaysi kungacha topshirasiz?")}</p>
      <div
        ref={listRef}
        role="radiogroup"
        aria-label={tr("Qaysi kungacha topshirasiz?")}
        className="relative max-h-56 divide-y divide-gray-100 overflow-y-auto rounded-xl border bg-white"
      >
        {rows.map((row) => (
          <button
            key={row.choice}
            ref={row.selected ? selectedRef : undefined}
            type="button"
            role="radio"
            aria-checked={row.selected}
            onClick={() => onChange(row.choice)}
            className={cn(
              "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
              row.selected ? "bg-primary-50/80" : "hover:bg-gray-50"
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border transition-colors",
                row.included
                  ? "border-primary-600 bg-primary-600 text-white"
                  : "border-gray-300 bg-white"
              )}
            >
              {row.included && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block truncate text-sm font-semibold",
                  row.included ? "text-gray-900" : "text-gray-500"
                )}
              >
                {row.kind === "day" && row.day ? dayLabel(row.day) : tr("Kesimdan keyin")}
              </span>
              <span className="block text-[11px] tabular-nums text-gray-400">
                {stamp(row.from)} → {row.to ? stamp(row.to) : trc("shift", "hozir")}
              </span>
            </span>
            <span className="flex-shrink-0 text-right">
              <span
                className={cn(
                  "block text-sm font-bold tabular-nums",
                  row.included ? "text-gray-900" : "text-gray-400"
                )}
              >
                {fmt(row.amount)}
              </span>
              <span
                className={cn(
                  "block text-[11px]",
                  row.included ? "text-primary-700" : "text-gray-400"
                )}
              >
                {/* Manfiy summa — shu davrda naqd xarajat tushumdan ko'p */}
                {row.amount < 0
                  ? tr("sof xarajat")
                  : row.included
                    ? tr("topshiriladi")
                    : tr("kassada qoladi")}
              </span>
            </span>
          </button>
        ))}
      </div>
      <p className="text-[11px] leading-relaxed text-gray-400">
        {everything
          ? tr("Hozirgacha bo'lgan hamma pul topshiriladi.")
          : tr("Kunlar ketma-ket topshiriladi: tanlangan kungacha bo'lgan hammasi. Undan keyingi tushum kassada qoladi.")}
      </p>
    </div>
  )
}
