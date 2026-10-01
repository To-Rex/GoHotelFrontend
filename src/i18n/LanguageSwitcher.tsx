import { useEffect, useRef, useState } from "react"
import { Check, Globe } from "lucide-react"

import { cn } from "@/lib/utils"
import { LANGUAGES, getLang, setLang, tr } from "./index"

/** Qayerda turgani: ilova ichi (mavzu ranglari) yoki landing/login sahnasi. */
type Scene = "app" | "day" | "night"

const BUTTON: Record<Scene, string> = {
  app: "text-muted-foreground hover:bg-muted hover:text-foreground",
  day: "border border-orange-900/15 bg-white/80 text-zinc-700 hover:bg-white",
  night: "border border-white/15 bg-white/10 text-zinc-200 hover:bg-white/20",
}
const MENU: Record<Scene, string> = {
  app: "border-border bg-background text-foreground",
  day: "border-zinc-200 bg-white text-zinc-800",
  night: "border-white/10 bg-zinc-900 text-zinc-100",
}
const ITEM: Record<Scene, string> = {
  app: "hover:bg-muted",
  day: "hover:bg-zinc-100",
  night: "hover:bg-white/10",
}

/**
 * Til tanlagich: globus va joriy til kodi; bosilganda uch til ro'yxati.
 *
 * Til nomlari har doim o'z tilida yoziladi ("Русский", "English") —
 * interfeys tilini tushunmagan odam ham o'zinikini topadi. Tanlanganda
 * sahifa qayta yuklanadi (sababi: i18n/index.ts).
 */
export function LanguageSwitcher({
  scene = "app",
  className,
}: {
  scene?: Scene
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = getLang()
  const short = LANGUAGES.find((l) => l.code === current)?.short ?? "UZ"

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={tr("Til")}
        aria-label={tr("Til")}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition-colors",
          BUTTON[scene]
        )}
      >
        <Globe size={16} />
        <span className="tabular-nums">{short}</span>
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border py-1 shadow-xl",
            MENU[scene]
          )}
        >
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              role="menuitemradio"
              aria-checked={l.code === current}
              lang={l.code}
              onClick={() => {
                setOpen(false)
                setLang(l.code)
              }}
              className={cn(
                "flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium transition-colors",
                ITEM[scene]
              )}
            >
              <span className="w-6 text-[11px] font-bold opacity-60">{l.short}</span>
              <span className="flex-1 text-left">{l.label}</span>
              {l.code === current && <Check size={15} className="text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
