import { Clock, Sparkles, TriangleAlert, User as UserIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import type { RoomStatusDetail } from "../lib/roomStatusInfo"

/**
 * Xona holati ostidagi tafsilot qatori.
 *
 * Bitta komponent, chunki bu ma'lumot to'rt joyda ko'rsatiladi (xonalar
 * sahifasining karta va jadval ko'rinishlari, soatlik lenta, kalendar) va
 * ular bir xil o'qilishi kerak. `compact` — tor joylar uchun: qatorlar
 * birlashtiriladi, ism tushirib qoldiriladi.
 *
 * Bo'sh xonada bu komponent umuman chizilmaydi — chaqiruvchi `detail` null
 * kelganini tekshiradi.
 */

interface RoomStatusNoteProps {
  detail: RoomStatusDetail
  compact?: boolean
  className?: string
}

export function RoomStatusNote({
  detail,
  compact = false,
  className,
}: RoomStatusNoteProps) {
  const { headline, atLabel, elapsedLabel, assignee, started, stale } = detail

  // Uzoq cho'zilgani darhol ko'rinishi kerak — aynan shuni sezmay qolish
  // xonani bir kun band ko'rsatib turgan edi.
  const tone = stale ? "text-red-600" : "text-amber-600"
  const Icon = stale ? TriangleAlert : started ? Sparkles : Clock

  if (compact) {
    return (
      <span
        className={cn("inline-flex items-center gap-1 text-[11px]", tone, className)}
        title={
          [headline, atLabel && `${atLabel} dan beri`, elapsedLabel, assignee]
            .filter(Boolean)
            .join(" · ")
        }
      >
        <Icon className="h-3 w-3 flex-shrink-0" />
        {elapsedLabel || headline}
      </span>
    )
  }

  return (
    <div className={cn("mt-1 space-y-0.5", className)}>
      <p
        className={cn(
          "flex items-center gap-1 text-[11px] font-medium leading-tight",
          tone
        )}
      >
        <Icon className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">
          {headline}
          {atLabel ? ` ${atLabel}` : ""}
        </span>
        {elapsedLabel && (
          <span className="flex-shrink-0 font-semibold tabular-nums">
            · {elapsedLabel}
          </span>
        )}
      </p>
      {assignee && (
        <p className="flex items-center gap-1 truncate text-[11px] leading-tight text-gray-500">
          <UserIcon className="h-3 w-3 flex-shrink-0" />
          {assignee}
        </p>
      )}
    </div>
  )
}
