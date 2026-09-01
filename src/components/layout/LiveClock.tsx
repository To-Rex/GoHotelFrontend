import { useEffect, useState } from "react"

import { clockParts, msUntilNextSecond } from "@/lib/clock"
import { cn } from "@/lib/utils"

/**
 * Navbardagi real vaqt soati.
 *
 * Alohida komponent, chunki u har soniyada yangilanadi. Vaqtni Navbar'ning
 * o'zida saqlash butun sarlavhani — smena hisoblagichi, tanilgan mehmonlar
 * paneli, profil menyusi — soniyada bir marta qayta chizishga majbur
 * qilardi. Bu yerda esa faqat shu uch qator yangilanadi.
 *
 * Formatlash `lib/clock.ts` da: u sof funksiya va test qilingan, komponentni
 * esa bu loyihada brauzersiz sinab bo'lmaydi.
 */

interface LiveClockProps {
  className?: string
}

export function LiveClock({ className }: LiveClockProps) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      const d = new Date()
      setNow(d)
      // Keyingi tik aynan soniya boshida: qat'iy 1000 ms sekin-asta siljib,
      // raqam goh 0.6, goh 1.4 soniyada almashadigan bo'lib qolardi.
      timer = setTimeout(tick, msUntilNextSecond(d))
    }
    timer = setTimeout(tick, msUntilNextSecond(new Date()))
    return () => clearTimeout(timer)
  }, [])

  const { hhmm, ss, dateLabel } = clockParts(now)

  return (
    <div
      className={cn("flex flex-col items-start leading-none", className)}
      title={dateLabel}
    >
      <span className="flex items-baseline gap-0.5 font-bold tabular-nums text-foreground">
        <span className="text-xl sm:text-2xl">{hhmm}</span>
        {/* Soniyalar kichikroq: vaqtni o'qishga xalaqit bermaydi, lekin
            soat "tirik" ekanini ko'rsatadi. */}
        <span className="text-xs sm:text-sm text-muted-foreground">{ss}</span>
      </span>
      <span className="mt-0.5 hidden text-[11px] text-muted-foreground sm:block">
        {dateLabel}
      </span>
    </div>
  )
}
