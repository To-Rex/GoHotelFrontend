import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  BedDouble,
  Camera,
  LogIn,
  Maximize2,
  ScanFace,
  User,
  UserX,
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
  useRejectSighting,
  useSightings,
  type Sighting,
} from "../api/vision"
import {
  groupSightingsByGuest,
  imageIdOf,
  selectArrivals,
  type RecognizedGuest,
} from "../lib/recognized"
import { tr } from "@/i18n"

/**
 * Kamera tanigan mehmonlar — navbardagi panel.
 *
 * Mehmon eshikdan kirganda kamera uni taniydi va u shu yerda paydo bo'ladi:
 * yuzi, ismi, nechanchi marta kelayotgani. Ustiga bosilsa yangi bandlov
 * dialogi o'sha mehmon tanlangan holda ochiladi — qabulxonachi ismini
 * qidirib o'tirmaydi.
 *
 * Qarorlar:
 *
 * 1. **Faqat xodimning filiali.** Yonidagi filialda tanilgan odamni
 *    ko'rsatish uni o'z broniga tortib qo'yishga olib kelardi.
 * 2. **Broni bor mehmonga boshqa tugma.** Ochiq broni bo'lganini kutib olish
 *    kerak, yangi bron yaratish emas — panel buni ajratib ko'rsatadi.
 * 3. **Ko'rilgan yozuv yopiladi.** Aks holda bir marta kelgan mehmon
 *    ro'yxatda soatlab osilib turardi.
 * 4. **Bir mehmon — bir qator.** Kamera oldida turgan odam har necha
 *    soniyada qayta tanilib, yangi epizod yoziladi; ro'yxat ularni mehmon
 *    bo'yicha yig'adi va olib tashlash hammasini yopadi.
 * 5. **Yangi kelgan mehmon — toast.** Qabulxonachi panelni ochmasa ham
 *    ko'radi; bir mehmon haqida 10 daqiqada bir martadan ko'p emas.
 */

const WINDOW_MINUTES = 30
const POLL_MS = 8000
/** Panelda ko'rsatiladigan mehmonlar soni (odamlar, ko'rinishlar emas) */
const LIST_LIMIT = 20
/** Toast ekranda turadigan vaqt (sichqoncha ustida turganda to'xtaydi) */
const TOAST_MS = 10_000
const MAX_TOASTS = 3
const TOASTED_KEY = "gohotel.vision.toasted"

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return tr("hozirgina")
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return tr("{{minutes}} daq. oldin", { minutes })
  return tr("{{hours}} soat oldin", { hours: Math.floor(minutes / 60) })
}

/* Toast chiqarilgan mehmonlar — sahifa yangilansa ham qayta chiqmasin */
function readToasted(): Record<string, number> {
  try {
    const raw = sessionStorage.getItem(TOASTED_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function writeToasted(map: Record<string, number>) {
  try {
    // Eski yozuvlar (bir soatdan oshgan) tashlanadi — xotira o'smasin
    const cutoff = Date.now() - 60 * 60 * 1000
    const kept = Object.fromEntries(Object.entries(map).filter(([, at]) => at >= cutoff))
    sessionStorage.setItem(TOASTED_KEY, JSON.stringify(kept))
  } catch {
    /* sessionStorage yopiq — toast baribir ishlaydi */
  }
}

function Avatar({
  sighting,
  className = "h-16 w-16 rounded-xl",
  iconSize = 22,
  onZoom,
}: {
  sighting: Sighting
  /** O'lcham va shakl — menyuda kvadrat, katta oynada karta */
  className?: string
  iconSize?: number
  /** Berilsa suratga bosish uni katta formatda ochadi */
  onZoom?: (url: string) => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const urlRef = useRef<string | null>(null)
  // Guruhdagi eng aniq kadr — qatorning o'zi eng so'nggi ko'rinish bo'lsa ham
  const imageId = imageIdOf(sighting)

  useEffect(() => {
    let cancelled = false
    if (!sighting.has_thumbnail) return
    // Endpoint token talab qiladi va <img> sarlavha yubormaydi — shuning
    // uchun blob orqali.
    fetchSightingImage(imageId)
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
  }, [imageId, sighting.has_thumbnail])

  if (url) {
    return (
      <img
        src={url}
        alt={sighting.guest_name || tr("Mehmon")}
        title={onZoom ? tr("Suratni katta ko'rish") : undefined}
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
          "flex-shrink-0 border border-border object-cover object-top",
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

function StatusLine({ sighting, size = 12 }: { sighting: Sighting; size?: number }) {
  return sighting.has_active_reservation ? (
    <>
      <LogIn size={size} />
      {tr("Broni bor — kutib oling")}
    </>
  ) : (
    <>
      <BedDouble size={size} />
      {tr("Yangi bandlov ochish")}
    </>
  )
}

function metaLine(sighting: Sighting): string {
  return (
    timeAgo(sighting.seen_at) +
    (sighting.visits > 0 ? tr(" · {{visits}}-tashrif", { visits: sighting.visits }) : "") +
    (sighting.camera_name ? ` · ${sighting.camera_name}` : "") +
    // O'xshashlik foizi: xodim mos kelish qanchalik ishonchli ekanini
    // ko'radi va shubhali bo'lsa "Bu u emas" deydi
    (sighting.similarity > 0 ? tr(" · o'xshashlik {{pct}}%", { pct: Math.round(sighting.similarity * 100) }) : "")
  )
}

/** "Bu u emas" — tasdiq matni */
const confirmNotThem = (sighting: Sighting) =>
  window.confirm(
    tr("Bu «{{name}}» emasmi?\n\nMoslik bekor qilinadi: yuz \"tanilmagan\"ga qaytadi (to'g'ri mehmonga biriktirish mumkin), shu epizoddan o'rganilgan xato shablon o'chiriladi.", {
      name: sighting.guest_name || tr("Mehmon"),
    })
  )

/* Yangi tanilgan mehmon haqida xabar — ekranning o'ng yuqorisida */
function RecognizedToast({
  sighting,
  onOpen,
  onClose,
  onReject,
}: {
  sighting: RecognizedGuest
  onOpen: () => void
  onClose: () => void
  /** "Bu u emas" — ruxsati bo'lmasa berilmaydi */
  onReject?: () => void
}) {
  const [paused, setPaused] = useState(false)
  /* Ota komponent har so'rovda qayta chiziladi va `onClose` yangilanadi —
     taymer undan qayta boshlanmasligi uchun ref orqali */
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    if (paused) return
    const timer = window.setTimeout(() => onCloseRef.current(), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [paused])

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="pointer-events-auto w-[23rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl animate-in fade-in-0 slide-in-from-right-8 duration-300"
    >
      <div className="flex items-center gap-1.5 border-b border-border bg-primary-50/70 px-3.5 py-1.5 text-[11px] font-semibold text-primary-700 dark:bg-primary-500/10">
        <ScanFace size={13} />
        {tr("Kamera tanidi")}
        {sighting.camera_name && (
          <span className="truncate font-normal text-primary-600/80">· {sighting.camera_name}</span>
        )}
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-md p-0.5 text-primary-500 transition-colors hover:bg-primary-100 hover:text-primary-700 dark:hover:bg-primary-500/20"
          title={tr("Yopish")}
          aria-label={tr("Yopish")}
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex items-center gap-3 p-3.5">
        <Avatar sighting={sighting} className="h-20 w-20 rounded-xl" iconSize={28} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{sighting.guest_name || tr("Mehmon")}</p>
          <p className="truncate text-xs text-muted-foreground">{metaLine(sighting)}</p>
          <p
            className={cn(
              "mt-0.5 inline-flex items-center gap-1 text-xs font-medium",
              sighting.has_active_reservation ? "text-emerald-600" : "text-primary-600"
            )}
          >
            <StatusLine sighting={sighting} />
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={onOpen}
              className="flex-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-700"
            >
              {sighting.has_active_reservation ? tr("Bronini ochish") : tr("Bandlov ochish")}
            </button>
            {onReject && (
              <button
                type="button"
                onClick={onReject}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title={tr("Bu u emas — moslikni bekor qilish")}
              >
                <UserX size={13} />
                {tr("Bu u emas")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
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
  const [toasts, setToasts] = useState<RecognizedGuest[]>([])
  const menuRef = useRef<HTMLDivElement | null>(null)
  const knownRef = useRef<Set<string> | null>(null)
  const acknowledge = useAcknowledgeSighting()
  const reject = useRejectSighting()

  const branchId = user?.branch_id || null
  const allowed = !!branchId && can("guest.view")
  const canReject = can("guest.update")

  const { data, isError } = useSightings({
    branchId: branchId || undefined,
    minutes: WINDOW_MINUTES,
    limit: LIST_LIMIT,
    onlyMatched: true,
    includeAcknowledged: false,
    distinctGuests: true,
    // Panel yopiq turganda ham so'raladi: badge yangi mehmon kelganini
    // ko'rsatishi kerak, aks holda uni ochish uchun sabab bo'lmaydi.
    refetchMs: POLL_MS,
    enabled: allowed,
  })

  // Bir mehmon — bir qator (server yig'ib beradi, bu — zaxira)
  const items = useMemo(() => groupSightingsByGuest(data?.items || []), [data])

  /* Yangi tanilgan mehmon — toast. Birinchi so'rovda faqat yaqinda
     tanilganlar; keyin — yangi ko'rinish kelganlar. Bir mehmon haqida
     qayta xabar 10 daqiqadan keyin. */
  useEffect(() => {
    if (!data) return
    const now = Date.now()
    const toasted = readToasted()
    const arrivals = selectArrivals(items, knownRef.current, toasted, now)
    const known = new Set<string>()
    for (const s of items) s.sighting_ids.forEach((id) => known.add(id))
    knownRef.current = known
    if (arrivals.length === 0) return
    for (const s of arrivals) if (s.guest_id) toasted[s.guest_id] = now
    writeToasted(toasted)
    // Panel ochiq bo'lsa xodim ro'yxatni ko'rib turibdi — toast ortiqcha
    if (open || expanded) return
    setToasts((prev) => {
      const ids = new Set(arrivals.map((s) => s.guest_id))
      return [...arrivals, ...prev.filter((t) => !ids.has(t.guest_id))].slice(0, MAX_TOASTS)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

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

  const closeToast = (guestId: string | null | undefined) =>
    setToasts((prev) => prev.filter((t) => t.guest_id !== guestId))

  const pick = (sighting: Sighting) => {
    setOpen(false)
    setExpanded(false)
    closeToast(sighting.guest_id)
    if (sighting.guest_id) onPickGuest(sighting.guest_id, sighting)
  }

  const openZoom = (sighting: Sighting) => (url: string) =>
    setZoom({ url, name: sighting.guest_name || tr("Mehmon") })

  const dismiss = (event: React.MouseEvent, sighting: RecognizedGuest) => {
    event.stopPropagation()
    closeToast(sighting.guest_id)
    // Mehmonning barcha ko'rinishlari yopiladi — aks holda eski epizodi
    // qatorga qaytib chiqardi
    acknowledge.mutate({ id: sighting.id, allForGuest: true, ids: sighting.sighting_ids })
  }

  /* "Bu u emas": kamera adashgan — moslik bekor, xato shablon o'chadi.
     Yuz "tanilmagan" ro'yxatiga qaytadi va to'g'ri mehmonga biriktiriladi. */
  const notThem = (event: React.MouseEvent, sighting: RecognizedGuest) => {
    event.stopPropagation()
    if (!confirmNotThem(sighting)) return
    closeToast(sighting.guest_id)
    reject.mutate({ id: sighting.id, ids: sighting.sighting_ids })
  }

  // Toastlar panel tugmasidan mustaqil — sahifaning ustida
  const toastLayer =
    allowed && toasts.length > 0 && typeof document !== "undefined"
      ? createPortal(
          <div className="pointer-events-none fixed right-3 top-[4.5rem] z-[60] flex flex-col gap-2.5 sm:right-5">
            {toasts.map((t) => (
              <RecognizedToast
                key={t.guest_id || t.id}
                sighting={t}
                onOpen={() => pick(t)}
                onClose={() => closeToast(t.guest_id)}
                onReject={
                  canReject
                    ? () => {
                        if (!confirmNotThem(t)) return
                        closeToast(t.guest_id)
                        reject.mutate({ id: t.id, ids: t.sighting_ids })
                      }
                    : undefined
                }
              />
            ))}
          </div>,
          document.body
        )
      : null

  // Kamera yo'q, filial yo'q yoki endpoint mavjud emas — tugma umuman
  // chizilmaydi. Doim bo'sh turadigan tugma navbarda joy egallaydi va
  // hech narsa aytmaydi.
  if (!allowed || isError) return null
  if (items.length === 0 && !open && !expanded) return toastLayer

  return (
    <div className="relative" ref={menuRef}>
      {toastLayer}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
          open ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
        )}
        title={tr("Kamera tanigan mehmonlar")}
        aria-label={tr("Kamera tanigan mehmonlar")}
      >
        <ScanFace size={18} />
        {items.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-bold text-white">
            {items.length}
          </span>
        )}
      </button>

      {open && (
        /* Telefonda ekran kengligida (tugma o'ngda emas — chetdan chiqib
           ketmasin), kattaroq ekranda tugma ostida */
        <div className="fixed inset-x-3 top-[4.25rem] z-50 overflow-hidden rounded-xl border border-border bg-background shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[26rem]">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Camera size={15} className="text-muted-foreground" />
            <span className="text-sm font-semibold">{tr("Kamera tanidi")}</span>
            <span className="ml-auto text-[11px] text-muted-foreground">
              {tr("oxirgi {{WINDOW_MINUTES}} daqiqa", { WINDOW_MINUTES })}
            </span>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setExpanded(true)
              }}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title={tr("Kattaroq ko'rish")}
              aria-label={tr("Kattaroq ko'rish")}
            >
              <Maximize2 size={15} />
            </button>
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {tr("Hozircha tanilgan mehmon yo'q.")}
            </p>
          ) : (
            <div className="max-h-[min(30rem,calc(100dvh-7rem))] overflow-y-auto">
              {items.map((sighting) => (
                <div
                  key={sighting.guest_id || sighting.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => pick(sighting)}
                  onKeyDown={(e) => e.key === "Enter" && pick(sighting)}
                  className="flex w-full cursor-pointer items-center gap-3.5 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/60"
                >
                  <Avatar sighting={sighting} onZoom={openZoom(sighting)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">
                      {sighting.guest_name || tr("Mehmon")}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{metaLine(sighting)}</p>
                    <p
                      className={cn(
                        "mt-0.5 inline-flex items-center gap-1 text-xs font-medium",
                        sighting.has_active_reservation
                          ? "text-emerald-600"
                          : "text-primary-600"
                      )}
                    >
                      <StatusLine sighting={sighting} />
                    </p>
                  </div>
                  {canReject && (
                    <button
                      type="button"
                      onClick={(e) => notThem(e, sighting)}
                      className="flex-shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-amber-50 hover:text-amber-700"
                      title={tr("Bu u emas — moslikni bekor qilish")}
                      aria-label={tr("Bu u emas — moslikni bekor qilish")}
                    >
                      <UserX size={15} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => dismiss(e, sighting)}
                    className="flex-shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title={tr("Ro'yxatdan olib tashlash")}
                    aria-label={tr("Ro'yxatdan olib tashlash")}
                  >
                    <X size={15} />
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
        title={tr("Kamera tanigan mehmonlar")}
        subtitle={tr("Oxirgi {{WINDOW_MINUTES}} daqiqa · suratga bosib katta ko'ring", { WINDOW_MINUTES })}
        maxWidth="max-w-3xl"
      >
        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {tr("Hozircha tanilgan mehmon yo'q.")}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((sighting) => (
              <div
                key={sighting.guest_id || sighting.id}
                className="overflow-hidden rounded-xl border border-border bg-card"
              >
                <Avatar
                  sighting={sighting}
                  className="h-56 w-full rounded-none"
                  iconSize={52}
                  onZoom={openZoom(sighting)}
                />
                <div className="p-3">
                  <p className="truncate text-base font-semibold">
                    {sighting.guest_name || tr("Mehmon")}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {metaLine(sighting)}
                  </p>
                  <p
                    className={cn(
                      "mt-1 inline-flex items-center gap-1 text-xs font-medium",
                      sighting.has_active_reservation
                        ? "text-emerald-600"
                        : "text-primary-600"
                    )}
                  >
                    <StatusLine sighting={sighting} size={13} />
                  </p>
                  <div className="mt-2.5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => pick(sighting)}
                      className="flex-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-700"
                    >
                      {sighting.has_active_reservation
                        ? tr("Bronini ochish")
                        : tr("Bandlov ochish")}
                    </button>
                    {canReject && (
                      <button
                        type="button"
                        onClick={(e) => notThem(e, sighting)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 text-xs text-muted-foreground transition-colors hover:bg-amber-50 hover:text-amber-700"
                        title={tr("Bu u emas — moslikni bekor qilish")}
                      >
                        <UserX size={14} />
                        {tr("Bu u emas")}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => dismiss(e, sighting)}
                      className="rounded-lg border border-border px-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title={tr("Ro'yxatdan olib tashlash")}
                      aria-label={tr("Ro'yxatdan olib tashlash")}
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
