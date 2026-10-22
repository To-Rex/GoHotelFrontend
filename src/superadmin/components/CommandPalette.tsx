import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router-dom"
import { Building2, CornerDownLeft, Search, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { useHotels } from "../api/panel"
import { tr } from "@/i18n"

export interface PaletteNavItem {
  label: string
  to: string
  icon: LucideIcon
}

/**
 * Tezkor qidiruv (Ctrl/Cmd+K): sahifalar va mehmonxonalar.
 *
 * Panel egasi ko'p mehmonxona bilan ishlaydi — har safar "Mehmonxonalar"
 * sahifasiga kirib, qidirib, keyin boshqarishni ochish ortiqcha. Bu oyna
 * istalgan sahifadan turib kerakli mehmonxonani topib, uning boshqaruv
 * sahifasini darhol ochadi.
 */
export function CommandPalette({
  open,
  onOpenChange,
  nav,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  nav: PaletteNavItem[]
}) {
  const navigate = useNavigate()
  const { data: hotels = [] } = useHotels()
  const [q, setQ] = useState("")
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQ("")
    setActive(0)
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20)
    return () => window.clearTimeout(timer)
  }, [open])

  const filteredNav = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return nav.slice(0, 8)
    return nav.filter((item) => item.label.toLowerCase().includes(needle))
  }, [nav, q])

  const filteredHotels = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return hotels.slice(0, 6)
    return hotels
      .filter((hotel) =>
        [hotel.name, hotel.code, hotel.city]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle))
      )
      .slice(0, 8)
  }, [hotels, q])

  const total = filteredNav.length + filteredHotels.length

  useEffect(() => {
    if (active >= total) setActive(0)
  }, [active, total])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onOpenChange(false)
      } else if (event.key === "ArrowDown") {
        event.preventDefault()
        setActive((value) => (total ? (value + 1) % total : 0))
      } else if (event.key === "ArrowUp") {
        event.preventDefault()
        setActive((value) => (total ? (value - 1 + total) % total : 0))
      } else if (event.key === "Enter") {
        event.preventDefault()
        const navItem = filteredNav[active]
        if (navItem) {
          navigate(navItem.to)
          onOpenChange(false)
          return
        }
        const hotel = filteredHotels[active - filteredNav.length]
        if (hotel) {
          navigate(`/panel/hotels/${hotel.id}`)
          onOpenChange(false)
        }
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [active, filteredHotels, filteredNav, navigate, onOpenChange, open, total])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center bg-black/70 px-4 pt-[12vh]"
      onClick={() => onOpenChange(false)}
      role="dialog"
      aria-label={tr("Tezkor qidiruv")}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-white/10 bg-[#111317]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-white/[0.07] px-4">
          <Search className="h-4 w-4 flex-shrink-0 text-slate-500" />
          <input
            ref={inputRef}
            value={q}
            onChange={(event) => {
              setQ(event.target.value)
              setActive(0)
            }}
            placeholder={tr("Sahifa yoki mehmonxona qidirish...")}
            className="h-12 min-w-0 flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
          />
          <kbd className="hidden rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-500 sm:block">
            ESC
          </kbd>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-2">
          {filteredNav.length > 0 && (
            <>
              <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                {tr("Sahifalar")}
              </p>
              {filteredNav.map((item, index) => (
                <button
                  key={item.to}
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => {
                    navigate(item.to)
                    onOpenChange(false)
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm",
                    active === index
                      ? "bg-white/[0.07] text-slate-100"
                      : "text-slate-400 hover:bg-white/[0.04]"
                  )}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0 text-slate-500" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {active === index && (
                    <CornerDownLeft className="h-3.5 w-3.5 text-slate-500" />
                  )}
                </button>
              ))}
            </>
          )}

          {filteredHotels.length > 0 && (
            <>
              <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                {tr("Mehmonxonalar")}
              </p>
              {filteredHotels.map((hotel, index) => {
                const itemIndex = filteredNav.length + index
                return (
                  <button
                    key={hotel.id}
                    type="button"
                    onMouseEnter={() => setActive(itemIndex)}
                    onClick={() => {
                      navigate(`/panel/hotels/${hotel.id}`)
                      onOpenChange(false)
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm",
                      active === itemIndex
                        ? "bg-white/[0.07] text-slate-100"
                        : "text-slate-400 hover:bg-white/[0.04]"
                    )}
                  >
                    <Building2 className="h-4 w-4 flex-shrink-0 text-slate-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{hotel.name}</span>
                      <span className="block truncate text-[11px] text-slate-600">
                        {hotel.code}
                        {hotel.city ? ` · ${hotel.city}` : ""}
                      </span>
                    </span>
                    {active === itemIndex && (
                      <CornerDownLeft className="h-3.5 w-3.5 text-slate-500" />
                    )}
                  </button>
                )
              })}
            </>
          )}

          {total === 0 && (
            <p className="px-3 py-8 text-center text-sm text-slate-500">
              {tr("Hech narsa topilmadi")}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-white/[0.07] px-4 py-2 text-[10px] text-slate-600">
          <span className="inline-flex items-center gap-1">
            <ArrowKeys /> {tr("tanlash")}
          </span>
          <span className="inline-flex items-center gap-1">
            <CornerDownLeft className="h-3 w-3" /> {tr("ochish")}
          </span>
          <span className="ml-auto">Ctrl / ⌘ + K</span>
        </div>
      </div>
    </div>,
    document.body
  )
}

function ArrowKeys() {
  return (
    <span className="inline-flex items-center gap-0.5">
      <kbd className="rounded border border-white/10 px-1">↑</kbd>
      <kbd className="rounded border border-white/10 px-1">↓</kbd>
    </span>
  )
}
