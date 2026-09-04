import { useEffect } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Navbar menyularining "kattaroq ko'rinishi" uchun umumiy oyna.
 *
 * Kichik ochilma panel tez qarash uchun qulay, lekin qabulxonada ekran
 * uzoqroq turganda (masalan mehmon kelishini kutib) kattaroq oyna
 * kerak bo'ladi. Ikkala menyu ham shu o'ramni ishlatadi — yopish,
 * Escape va sarlavha bir joyda turadi.
 */
export function OverlayDialog({
  open,
  onClose,
  icon,
  title,
  subtitle,
  maxWidth = "max-w-2xl",
  children,
}: {
  open: boolean
  onClose: () => void
  icon?: React.ReactNode
  title: string
  subtitle?: string
  maxWidth?: string
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  /* Portal SHART: navbardagi backdrop-blur `position: fixed` uchun
     konteyner bo'lib qoladi — portalsiz "katta oyna" navbar ichida
     qisilib chiqardi. */
  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-[8vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={cn(
          "w-full overflow-hidden rounded-2xl border border-border bg-background shadow-2xl",
          maxWidth
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-border px-5 py-3.5">
          {icon}
          <div className="min-w-0">
            <p className="text-base font-semibold leading-tight">{title}</p>
            {subtitle && (
              <p className="text-[11px] text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Yopish"
            aria-label="Yopish"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4">{children}</div>
      </div>
    </div>,
    document.body
  )
}
