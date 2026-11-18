import { useEffect, useRef } from "react"
import { format } from "date-fns"
import { Check } from "lucide-react"

import { tr, trc } from "@/i18n"
import { UZ_DAYS, UZ_MONTHS } from "@/lib/clock"
import { cn } from "@/lib/utils"
import type { CashBreakdown } from "../api/shifts"
import { ALL_CASH, cutRows, defaultCutChoice, parseDay, type CutChoice } from "../lib/cashCuts"

const fmt = (n: number) => Number(n || 0).toLocaleString()
const stamp = (iso: string) => format(new Date(iso), "dd.MM HH:mm")

/** Kesim yopgan ish kuni: "17-noyabr, seshanba" / "17 ноября, вторник".
 *  Oy va hafta kuni lug'atdan olinadi: brauzerlar o'zbekcha nomlarni
 *  bilmaydi (`Intl` "M11 17" qaytaradi). */
const dayLabel = (day: string) => {
  const date = parseDay(day)
  return tr("{{day}}-{{month}}, {{weekday}}", {
    day: date.getDate(),
    month: tr(UZ_MONTHS[date.getMonth()]),
    weekday: tr(UZ_DAYS[date.getDay()]),
  })
}

/* Kassani kunlik kesim bo'yicha topshirish — davr tanlash.

   Kassa bir necha kun topshirilmagan bo'lsa, har kesim kuni alohida qator
   bo'lib chiqadi (eng eskisi tepada), oxirida — "kesimdan keyin" (bugungi,
   hali tugamagan kun). Qatorlar vaqt chizig'iga tizilgan: xodim qaysi
   kungacha topshirishini bosadi va o'sha qatorgacha bo'lgan hammasi
   belgilanadi (ketma-ket), qolgani kassada qoladi. Oxirgi qator bosilsa —
   avvalgidek hamma pul topshiriladi; buning uchun ro'yxat ostida alohida
   tugma ham bor ("Hamma pulni topshirish").

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
  const lastIndex = rows.length - 1
  const everything = rows[lastIndex].selected

  return (
    <div className="space-y-2">
      <div
        ref={listRef}
        role="radiogroup"
        aria-label={tr("Qaysi kungacha topshirasiz?")}
        className="relative max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white md:max-h-[19.5rem]"
      >
        {rows.map((row, index) => (
          <button
            key={row.choice}
            ref={row.selected ? selectedRef : undefined}
            type="button"
            role="radio"
            aria-checked={row.selected}
            onClick={() => onChange(row.choice)}
            className={cn(
              "flex w-full items-stretch gap-3 px-3 text-left outline-none transition-colors focus-visible:bg-primary-50",
              row.included ? "bg-primary-50/60" : "hover:bg-gray-50"
            )}
          >
            {/* Vaqt chizig'i: belgi + qo'shni qatorlarga ulanuvchi chiziq.
                Chiziq topshiriladigan kunlar orasida rangli. */}
            <span className="relative w-5 flex-shrink-0">
              {index > 0 && (
                <span
                  className={cn(
                    "absolute top-0 bottom-1/2 left-1/2 w-0.5 -translate-x-1/2",
                    row.included ? "bg-primary-600/35" : "bg-gray-200"
                  )}
                />
              )}
              {index < lastIndex && (
                <span
                  className={cn(
                    "absolute top-1/2 bottom-0 left-1/2 w-0.5 -translate-x-1/2",
                    rows[index + 1].included ? "bg-primary-600/35" : "bg-gray-200"
                  )}
                />
              )}
              <span
                className={cn(
                  "absolute top-1/2 left-1/2 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 transition-colors",
                  row.included
                    ? "border-primary-600 bg-primary-600 text-white"
                    : "border-gray-300 bg-white"
                )}
              >
                {row.included && <Check className="h-3 w-3" strokeWidth={3.5} />}
              </span>
            </span>
            <span className="min-w-0 flex-1 py-2.5">
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
            <span className="flex-shrink-0 py-2.5 text-right">
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
                  "block text-[11px] font-medium",
                  row.included ? "text-primary-600" : "text-gray-400"
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
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-[11px] leading-relaxed text-gray-500">
          {everything
            ? tr("Hozirgacha bo'lgan hamma pul topshiriladi.")
            : tr("Belgilangan kunlar topshiriladi, qolgani kassada qoladi.")}
        </p>
        {/* "Hamma pul" — oxirgi qatorni bosish bilan bir xil, lekin ochiq aytilgan */}
        <button
          type="button"
          onClick={() => onChange(everything ? defaultCutChoice(data) : ALL_CASH)}
          className="rounded-md text-[11px] font-semibold text-primary-600 underline-offset-2 outline-none hover:underline focus-visible:underline"
        >
          {everything ? tr("Faqat kesimgacha topshirish") : tr("Hamma pulni topshirish")}
        </button>
      </div>
    </div>
  )
}
