import { useEffect, useRef, useState } from "react"
import { BedDouble, Camera, LogIn, ScanFace, User, X } from "lucide-react"

import { useAuthStore } from "@/store/auth"
import { usePermissions } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import {
  fetchSightingImage,
  useAcknowledgeSighting,
  useSightings,
  type Sighting,
} from "../api/vision"

/**
 * Kamera tanigan mehmonlar — navbardagi kichik panel.
 *
 * Mehmon eshikdan kirganda kamera uni taniydi va u shu yerda paydo bo'ladi:
 * yuzi, ismi, nechanchi marta kelayotgani. Ustiga bosilsa yangi bandlov
 * dialogi o'sha mehmon tanlangan holda ochiladi — qabulxonachi ismini
 * qidirib o'tirmaydi.
 *
 * Uch qaror:
 *
 * 1. **Faqat xodimning filiali.** Yonidagi filialda tanilgan odamni
 *    ko'rsatish uni o'z broniga tortib qo'yishga olib kelardi.
 * 2. **Broni bor mehmonga boshqa tugma.** Ochiq broni bo'lganini kutib olish
 *    kerak, yangi bron yaratish emas — panel buni ajratib ko'rsatadi.
 * 3. **Ko'rilgan yozuv yopiladi.** Aks holda bir marta kelgan mehmon
 *    ro'yxatda soatlab osilib turardi.
 */

const WINDOW_MINUTES = 30
const POLL_MS = 8000

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return "hozirgina"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} daq. oldin`
  return `${Math.floor(minutes / 60)} soat oldin`
}

function Avatar({ sighting }: { sighting: Sighting }) {
  const [url, setUrl] = useState<string | null>(null)
  const urlRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!sighting.has_thumbnail) return
    // Endpoint token talab qiladi va <img> sarlavha yubormaydi — shuning
    // uchun blob orqali.
    fetchSightingImage(sighting.id)
      .then((objectUrl) => {
        if (cancelled) {
          URL.revokeObjectURL(objectUrl)
          return
        }
        urlRef.current = objectUrl
        setUrl(objectUrl)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current)
        urlRef.current = null
      }
    }
  }, [sighting.id, sighting.has_thumbnail])

  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="h-11 w-11 flex-shrink-0 rounded-full border border-border object-cover"
      />
    )
  }
  return (
    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <User size={18} />
    </span>
  )
}

interface RecognizedGuestsMenuProps {
  /** Mehmon tanlanganda — bandlov dialogini shu mehmon bilan ochish. */
  onPickGuest: (guestId: string, sighting: Sighting) => void
}

export function RecognizedGuestsMenu({ onPickGuest }: RecognizedGuestsMenuProps) {
  const user = useAuthStore((s) => s.user)
  const { can } = usePermissions()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const acknowledge = useAcknowledgeSighting()

  const branchId = user?.branch_id || null

  const { data, isError } = useSightings({
    branchId: branchId || undefined,
    minutes: WINDOW_MINUTES,
    limit: 10,
    onlyMatched: true,
    includeAcknowledged: false,
    // Panel yopiq turganda ham so'raladi: badge yangi mehmon kelganini
    // ko'rsatishi kerak, aks holda uni ochish uchun sabab bo'lmaydi.
    refetchMs: POLL_MS,
    enabled: !!branchId && can("guest.view"),
  })

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const items = (data?.items || []).filter((s) => s.guest_id)

  // Kamera yo'q, filial yo'q yoki endpoint mavjud emas — tugma umuman
  // chizilmaydi. Doim bo'sh turadigan tugma navbarda joy egallaydi va
  // hech narsa aytmaydi.
  if (!branchId || isError || !can("guest.view")) return null
  if (items.length === 0 && !open) return null

  const pick = (sighting: Sighting) => {
    setOpen(false)
    if (sighting.guest_id) onPickGuest(sighting.guest_id, sighting)
  }

  const dismiss = (event: React.MouseEvent, sighting: Sighting) => {
    event.stopPropagation()
    acknowledge.mutate(sighting.id)
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
          open ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
        )}
        title="Kamera tanigan mehmonlar"
        aria-label="Kamera tanigan mehmonlar"
      >
        <ScanFace size={18} />
        {items.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-bold text-white">
            {items.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-background shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <Camera size={14} className="text-muted-foreground" />
            <span className="text-sm font-semibold">Kamera tanidi</span>
            <span className="ml-auto text-[11px] text-muted-foreground">
              oxirgi {WINDOW_MINUTES} daqiqa
            </span>
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
              Hozircha tanilgan mehmon yo'q.
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {items.map((sighting) => (
                <div
                  key={sighting.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => pick(sighting)}
                  onKeyDown={(e) => e.key === "Enter" && pick(sighting)}
                  className="flex w-full cursor-pointer items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/60"
                >
                  <Avatar sighting={sighting} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {sighting.guest_name || "Mehmon"}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {timeAgo(sighting.seen_at)}
                      {sighting.visits > 0 && ` · ${sighting.visits}-tashrif`}
                      {sighting.camera_name ? ` · ${sighting.camera_name}` : ""}
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium",
                        sighting.has_active_reservation
                          ? "text-emerald-600"
                          : "text-primary-600"
                      )}
                    >
                      {sighting.has_active_reservation ? (
                        <>
                          <LogIn size={12} />
                          Broni bor — kutib oling
                        </>
                      ) : (
                        <>
                          <BedDouble size={12} />
                          Yangi bandlov ochish
                        </>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => dismiss(e, sighting)}
                    className="flex-shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title="Ro'yxatdan olib tashlash"
                    aria-label="Ro'yxatdan olib tashlash"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
