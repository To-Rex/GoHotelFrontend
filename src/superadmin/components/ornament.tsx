import { useId, type CSSProperties } from "react"

import { cn } from "@/lib/utils"
import { UZ, octagramPoints, rhombusPoints } from "../lib/ornament"

/* O'zbek naqshi unsurlari — faqat ingichka chiziq va tekis rang.
   Bezak sahifaga xalaqit bermasligi kerak: past shaffoflik, chetlari
   so'nib boradi, sichqonchaga to'sqinlik qilmaydi (pointer-events: none). */

const STAR_24 = octagramPoints(12, 12, 11)
const STAR_24_INNER = octagramPoints(12, 12, 5.2, 22.5)

/** Sakkiz qirrali yulduz — holat va ro'yxat belgisi. */
export function StarMark({
  className,
  filled = true,
  style,
}: {
  className?: string
  filled?: boolean
  style?: CSSProperties
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={cn("h-3 w-3 flex-shrink-0", className)}
      style={style}
    >
      <polygon
        points={STAR_24}
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={filled ? 0 : 2.2}
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Yuklanish belgisi — sekin aylanuvchi yulduz. */
export function StarSpinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("h-7 w-7 animate-[spin_2.4s_linear_infinite] motion-reduce:animate-none", className)}>
      <polygon points={STAR_24} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <polygon points={STAR_24_INNER} fill="currentColor" opacity="0.6" />
    </svg>
  )
}

const TILE = 56
const R = 13

function girihTile(): string {
  const star = (cx: number, cy: number, r = R, rot = 0) => `M${octagramPoints(cx, cy, r, rot).replace(/ /g, " L")} Z`
  const d: string[] = [
    star(28, 28),
    star(28, 28, 5.5, 22.5),
    star(0, 0),
    star(TILE, 0),
    star(0, TILE),
    star(TILE, TILE),
  ]
  // Markaziy yulduz uchlaridan burchakdagi yulduzlar uchlariga — panjara
  const k = R * Math.SQRT1_2
  const diag: [number, number, number, number][] = [
    [28 + k, 28 - k, TILE - k, k],
    [28 - k, 28 - k, k, k],
    [28 + k, 28 + k, TILE - k, TILE - k],
    [28 - k, 28 + k, k, TILE - k],
  ]
  for (const [x1, y1, x2, y2] of diag) d.push(`M${x1.toFixed(2)},${y1.toFixed(2)} L${x2.toFixed(2)},${y2.toFixed(2)}`)
  // Qirralar o'rtasidagi romblar va ularga boruvchi chiziqlar
  for (const [cx, cy] of [[28, 0], [0, 28], [TILE, 28], [28, TILE]] as const) {
    d.push(`M${rhombusPoints(cx, cy, 4).replace(/ /g, " L")} Z`)
  }
  d.push("M28,15 L28,4 M28,41 L28,52 M15,28 L4,28 M41,28 L52,28")
  d.push(`M${R},0 L24,0 M${TILE - R},0 L32,0 M0,${R} L0,24 M0,${TILE - R} L0,32`)
  return d.join(" ")
}
const GIRIH_D = girihTile()

/** Girih to'ri — sarlavha fonida. Rang `currentColor`, shaffoflik va
 *  so'nish (mask) chaqiruvchi tomonidan beriladi. */
export function GirihPattern({ className }: { className?: string }) {
  const id = `girih-${useId().replace(/[^a-zA-Z0-9]/g, "")}`
  return (
    <svg aria-hidden className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}>
      <defs>
        <pattern id={id} width={TILE} height={TILE} patternUnits="userSpaceOnUse">
          <path d={GIRIH_D} fill="none" stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

/** Hoshiya — bo'limlarni ajratuvchi naqshli chiziq (romb va nuqta zanjiri). */
export function HoshiyaRule({ className }: { className?: string }) {
  const id = `hoshiya-${useId().replace(/[^a-zA-Z0-9]/g, "")}`
  return (
    <svg
      aria-hidden
      className={cn(
        "pointer-events-none block h-2.5 w-full [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]",
        className
      )}
      style={{ color: UZ.tilla }}
    >
      <defs>
        <pattern id={id} width="20" height="10" patternUnits="userSpaceOnUse">
          <path d="M0,5 L5.5,5 M14.5,5 L20,5" stroke="currentColor" strokeWidth="0.8" opacity="0.55" />
          <polygon points={rhombusPoints(10, 5, 4.5, 4)} fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.8" />
          <circle cx="10" cy="5" r="1" fill="currentColor" opacity="0.9" />
        </pattern>
      </defs>
      <rect width="100%" height="10" fill={`url(#${id})`} />
    </svg>
  )
}

/** Rozetka — bo'sh holat uchun katta naqsh (16 qirrali: ikki yulduz ustma-ust). */
export function Rosette({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden className={cn("h-28 w-28", className)} style={style}>
      <g fill="none" stroke="currentColor" strokeLinejoin="round">
        <circle cx="60" cy="60" r="56" strokeWidth="0.8" opacity="0.5" />
        <polygon points={octagramPoints(60, 60, 52)} strokeWidth="1" />
        <polygon points={octagramPoints(60, 60, 52, 22.5)} strokeWidth="1" opacity="0.7" />
        <circle cx="60" cy="60" r="30" strokeWidth="0.8" opacity="0.6" />
        <polygon points={octagramPoints(60, 60, 24)} strokeWidth="1" />
        <circle cx="60" cy="60" r="9" strokeWidth="0.8" />
      </g>
      <polygon points={octagramPoints(60, 60, 6)} fill="currentColor" />
    </svg>
  )
}

/** Sahifa emblemasi — lojuvard koshin ustida tilla yulduz. */
export function Emblem() {
  return (
    <span
      aria-hidden
      className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border"
      style={{ background: "#141c33", borderColor: "rgba(106,134,234,0.35)" }}
    >
      <svg viewBox="0 0 24 24" className="h-7 w-7">
        <polygon points={STAR_24} fill="none" stroke={UZ.tilla} strokeWidth="1.3" strokeLinejoin="round" />
        <polygon points={STAR_24_INNER} fill={UZ.feruza} />
      </svg>
    </span>
  )
}
