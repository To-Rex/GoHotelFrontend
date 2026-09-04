import { useEffect, useRef, useState } from "react"
import {
  BedDouble,
  Camera,
  LogIn,
  Maximize2,
  ScanFace,
  User,
  X,
} from "lucide-react"

import { ImageLightbox } from "@/components/ui/image-lightbox"
import { OverlayDialog } from "@/components/ui/overlay-dialog"

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

function Avatar({
  sighting,
  className = "h-11 w-11 rounded-full",
  iconSize = 18,
  onZoom,
}: {
  sighting: Sighting
  /** O'lcham va shakl — kichik menyuda doira, katta oynada karta */
  className?: string
  iconSize?: number
  /** Berilsa suratga bosish uni katta formatda ochadi */
  onZoom?: (url: string) => void
}) {
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
        alt={sighting.guest_name || "Mehmon"}
        title={onZoom ? "Suratni katta ko'rish" : undefined}
        onClick={
          onZoom
            ? (e) => {
                // Qator bosilganda bandlov ochiladi — surat bosilganda esa
                // faqat surat kattalashishi kerak
                e.stopPropagation()
                onZoom(url)
              }
            : undefined
        }
        className={cn(
          "flex-shrink-0 border border-border object-cover",
          onZoom && "cursor-zoom-in",
          className
        )}
      />
    )
  }
  return (
    <span
      className={cn(
        "flex flex-shrink-0 items-center justify-center bg-muted text-muted-foreground",
        className
      )}
    >
      <User size={iconSize} />
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
  /* Katta ko'rinish: kichik panel tez qarash uchun, mehmonni kutib
     turganda esa katta oyna — suratlar yirik, ustidan bosib bandlov
     ochish ham oson */
  const [expanded, setExpanded] = useState(false)
  const [zoom, setZoom] = useState<{ url: string; name: string } | null>(null)
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
  if (items.length === 0 && !open && !expanded) return null

  const pick = (sighting: Sighting) => {
    setOpen(false)
    setExpanded(false)
    if (sighting.guest_id) onPickGuest(sighting.guest_id, sighting)
  }

  const openZoom = (sighting: Sighting) => (url: string) =>
    setZoom({ url, name: sighting.guest_name || "Mehmon" })

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
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setExpanded(true)
              }}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Kattaroq ko'rish"
              aria-label="Kattaroq ko'rish"
            >
              <Maximize2 size={14} />
            </button>
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
                  <Avatar sighting={sighting} onZoom={openZoom(sighting)} />
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

      <OverlayDialog
        open={expanded}
        onClose={() => setExpanded(false)}
        icon={<Camera size={18} className="text-muted-foreground" />}
        title="Kamera tanigan mehmonlar"
        subtitle={`Oxirgi ${WINDOW_MINUTES} daqiqa · suratga bosib katta ko'ring`}
        maxWidth="max-w-3xl"
      >
        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Hozircha tanilgan mehmon yo'q.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((sighting) => (
              <div
                key={sighting.id}
                className="overflow-hidden rounded-xl border border-border bg-card"
              >
                <Avatar
                  sighting={sighting}
                  className="h-44 w-full rounded-none"
                  iconSize={48}
                  onZoom={openZoom(sighting)}
                />
                <div className="p-3">
                  <p className="truncate text-base font-semibold">
                    {sighting.guest_name || "Mehmon"}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {timeAgo(sighting.seen_at)}
                    {sighting.visits > 0 && ` · ${sighting.visits}-tashrif`}
                    {sighting.camera_name ? ` · ${sighting.camera_name}` : ""}
                  </p>
                  <p
                    className={cn(
                      "mt-1 inline-flex items-center gap-1 text-xs font-medium",
                      sighting.has_active_reservation
                        ? "text-emerald-600"
                        : "text-primary-600"
                    )}
                  >
                    {sighting.has_active_reservation ? (
                      <>
                        <LogIn size={13} />
                        Broni bor — kutib oling
                      </>
                    ) : (
                      <>
                        <BedDouble size={13} />
                        Yangi bandlov ochish
                      </>
                    )}
                  </p>
                  <div className="mt-2.5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => pick(sighting)}
                      className="flex-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-700"
                    >
                      {sighting.has_active_reservation
                        ? "Bronini ochish"
                        : "Bandlov ochish"}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => dismiss(e, sighting)}
                      className="rounded-lg border border-border px-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="Ro'yxatdan olib tashlash"
                      aria-label="Ro'yxatdan olib tashlash"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </OverlayDialog>

      <ImageLightbox
        url={zoom?.url || null}
        alt={zoom?.name}
        caption={zoom?.name}
        onClose={() => setZoom(null)}
      />
    </div>
  )
}
