import { useEffect, useRef, type ComponentType, type ReactNode } from "react"

import { cn } from "@/lib/utils"

/* Yordamchi sahifasining yon paneli — kerak bo'lganda siljib chiqadi.

   docked  — chat yonida turadi: kengligi 0 dan to'liqqa silliq o'sadi,
             chat shunga qarab torayadi (ustiga yopilmaydi).
   overlay — joy yetmaganda: chat ustidan tortma bo'lib chiqadi, orqa fon
             xiralashadi; fonni bosish, Esc yoki ✕ yopadi.

   Yopiq panel ham DOM'da qoladi (yopilish ham animatsiya bilan bo'lishi
   uchun), lekin `inert` — unga na fokus, na ekran o'quvchi kiradi.
   Harakatni kamaytirish yoqilgan bo'lsa (tizim sozlamasi), animatsiyasiz. */

const EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]"

const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))

export function SidePanel({
  id,
  side,
  open,
  docked,
  width,
  overlayMaxWidth,
  label,
  onClose,
  children,
}: {
  id: string
  side: "left" | "right"
  open: boolean
  docked: boolean
  width: number
  overlayMaxWidth: number
  label: string
  onClose: () => void
  children: ReactNode
}) {
  const panelRef = useRef<HTMLElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const overlay = !docked

  // Tortma Esc bilan yopiladi. Matn maydonidagi Esc — o'sha maydonniki
  // (masalan, suhbat nomini tahrirlashni bekor qilish), panelni yopmaydi.
  useEffect(() => {
    if (!overlay || !open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || isEditable(e.target)) return
      onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [overlay, open, onClose])

  // Tortma ochilganda fokus panelga o'tadi, yopilganda — uni ochgan tugmaga qaytadi.
  // Fokus qayerdan kelgani noma'lum bo'lsa (masalan, havola orqali ochilgan) —
  // shu panelni boshqaruvchi tugmaga (aria-controls). Faqat haqiqiy ochilish/
  // yopilishda: sahifa yuklanganda yoki oyna o'lchami o'zgarganda fokus tegilmaydi.
  const wasOpen = useRef(open)
  useEffect(() => {
    const opened = open && !wasOpen.current
    const closed = !open && wasOpen.current
    wasOpen.current = open
    if (!overlay) return
    if (opened) {
      const from = document.activeElement
      returnFocus.current = from instanceof HTMLElement && from !== document.body ? from : null
      panelRef.current?.focus({ preventScroll: true })
    } else if (closed) {
      const active = document.activeElement
      const lost = !active || active === document.body || !!panelRef.current?.contains(active)
      const back = returnFocus.current?.isConnected
        ? returnFocus.current
        : document.querySelector<HTMLElement>(`[aria-controls="${id}"]`)
      returnFocus.current = null
      if (lost && back) back.focus({ preventScroll: true })
    }
  }, [overlay, open, id])

  if (docked) {
    return (
      <div
        className={cn(
          "relative h-full flex-shrink-0 overflow-hidden transition-[width] duration-300 motion-reduce:transition-none",
          EASE,
        )}
        style={{ width: open ? width : 0 }}
        inert={!open}
        data-panel-state={open ? "open" : "closed"}
      >
        {/* Ichki panel qarama-qarshi chetga bog'langan: o'ram kengayganda
            panel chetdan siljib kirgandek ko'rinadi (bir joyda ochilib qolmaydi) */}
        <aside
          ref={panelRef}
          id={id}
          aria-label={label}
          className={cn(
            "absolute inset-y-0 flex flex-col border-border bg-card transition-opacity duration-300 motion-reduce:transition-none",
            side === "left" ? "right-0 border-r" : "left-0 border-l",
            open ? "opacity-100" : "opacity-0",
          )}
          style={{ width }}
        >
          {children}
        </aside>
      </div>
    )
  }

  return (
    <div
      className={cn("fixed inset-0 z-50", !open && "pointer-events-none")}
      inert={!open}
      data-panel-state={open ? "open" : "closed"}
    >
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/45 transition-opacity duration-300 motion-reduce:transition-none",
          open ? "opacity-100" : "opacity-0",
        )}
      />
      <aside
        ref={panelRef}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={cn(
          "absolute inset-y-0 flex w-[88%] flex-col bg-card shadow-2xl outline-none duration-300 motion-reduce:transition-none",
          EASE,
          side === "left" ? "left-0" : "right-0",
          // Tailwind v4 siljitishni `translate` xususiyati bilan beradi (transform emas).
          // Ochilishda ko'rinish darhol yoqiladi — fokus panelga o'ta oladi;
          // yopilishda siljish tugagach o'chadi — panel yo'lda yo'qolib qolmaydi.
          open
            ? "visible translate-x-0 transition-[translate]"
            : cn("invisible transition-[translate,visibility]", side === "left" ? "-translate-x-full" : "translate-x-full"),
        )}
        style={{ maxWidth: overlayMaxWidth }}
      >
        {children}
      </aside>
    </div>
  )
}

/** Sarlavhadagi panel tugmasi: ochiq bo'lsa ajralib turadi, kerak bo'lsa son belgisi bilan.
 *  Yozuvi chat ustunining kengligiga qarab (`@container` — sahifadagi `section`):
 *  ikkala panel ochilib chat torayganda faqat belgi qoladi, sarlavhaga joy bo'shaydi. */
export function PanelToggle({
  active,
  controls,
  onClick,
  icon: Icon,
  label,
  badge = 0,
  badgeTone = "primary",
  badgeLabel,
}: {
  active: boolean
  controls: string
  onClick: () => void
  icon: ComponentType<{ className?: string }>
  label: string
  badge?: number
  badgeTone?: "primary" | "danger"
  badgeLabel?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      aria-controls={controls}
      title={badge > 0 && badgeLabel ? `${label} · ${badgeLabel}` : label}
      className={cn(
        "relative inline-flex h-9 flex-shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm font-medium transition-colors @2xl:px-2.5",
        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden @2xl:inline">{label}</span>
      {badge > 0 && (
        <>
          <span
            aria-hidden
            className={cn(
              "absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white ring-2 ring-card",
              badgeTone === "danger" ? "bg-red-500" : "bg-primary",
            )}
          >
            {badge > 99 ? "99+" : badge}
          </span>
          {badgeLabel && <span className="sr-only">{badgeLabel}</span>}
        </>
      )}
    </button>
  )
}
