import { useEffect, useState } from "react"
import { Download, IdCard, Loader2 } from "lucide-react"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { tr } from "@/i18n"
import {
  SCAN_SIDES,
  fetchGuestDocumentImage,
  useGuestDocumentImages,
  type GuestDocumentImage,
  type ScanImages,
} from "../api/documentImages"
import type { DocumentSide } from "./documentScannerTypes"

/* Mehmonning saqlangan hujjat suratlari (pasport / ID karta) va hali
   saqlanmagan skaner suratlari. Rasm API orqali olinadi — MinIO havolasi
   HTTPS sahifada ochilmaydi va tashqariga ko'rinmasligi kerak. */

const sideLabel = (side: DocumentSide | null | undefined): string => {
  switch (side) {
    case "passport":
      return tr("Pasport sahifasi")
    case "front":
      return tr("Old tomoni")
    case "back":
      return tr("Orqa tomoni")
    default:
      return tr("Yuklangan surat")
  }
}

const pad = (n: number) => String(n).padStart(2, "0")
const fmtWhen = (iso: string | null) => {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function SavedThumb({
  guestId,
  image,
  onOpen,
}: {
  guestId: string
  image: GuestDocumentImage
  onOpen: (url: string, image: GuestDocumentImage) => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null
    fetchGuestDocumentImage(guestId, image.id)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [guestId, image.id])

  return (
    <button
      type="button"
      disabled={!url}
      onClick={() => url && onOpen(url, image)}
      className="group w-[120px] shrink-0 text-left disabled:cursor-default"
      title={tr("Kattalashtirish")}
    >
      <div className="flex h-[78px] w-full items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 transition-colors group-hover:border-primary-300">
        {url ? (
          <img src={url} alt={sideLabel(image.side)} className="h-full w-full object-cover" />
        ) : failed ? (
          <IdCard className="h-5 w-5 text-gray-300" />
        ) : (
          <Loader2 className="h-4 w-4 animate-spin text-gray-300" />
        )}
      </div>
      <p className="mt-1 truncate text-[11px] font-medium text-gray-700">{sideLabel(image.side)}</p>
      <p className="truncate text-[10px] text-gray-400">{fmtWhen(image.created_at)}</p>
    </button>
  )
}

/** Mehmon kartasidagi hujjat suratlari. Surat yo'q yoki ko'rishga ruxsat
 *  bo'lmasa (`hideWhenEmpty`) hech narsa chizilmaydi. */
export function GuestDocumentImages({
  guestId,
  hideWhenEmpty = true,
  className,
}: {
  guestId: string | null | undefined
  hideWhenEmpty?: boolean
  className?: string
}) {
  const { data: images = [], isLoading, isError } = useGuestDocumentImages(guestId)
  const [viewing, setViewing] = useState<{ url: string; image: GuestDocumentImage } | null>(null)

  if (!guestId || isError) return null
  if (!isLoading && images.length === 0 && hideWhenEmpty) return null

  return (
    <div className={className}>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <IdCard className="h-3.5 w-3.5" />
        {tr("Hujjat suratlari")}
      </p>
      {isLoading ? (
        <div className="flex gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-[78px] w-[120px] animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : images.length === 0 ? (
        <p className="text-xs text-gray-400">{tr("Hujjat surati saqlanmagan")}</p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((image) => (
            <SavedThumb
              key={image.id}
              guestId={guestId}
              image={image}
              onOpen={(url, img) => setViewing({ url, image: img })}
            />
          ))}
        </div>
      )}

      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="pr-6 text-base">
              {viewing ? sideLabel(viewing.image.side) : ""}
            </DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-2">
              <img
                src={viewing.url}
                alt={sideLabel(viewing.image.side)}
                className="max-h-[70vh] w-full rounded-lg border border-gray-200 object-contain"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                <span>
                  {fmtWhen(viewing.image.created_at)}
                  {viewing.image.uploaded_by_name ? ` · ${viewing.image.uploaded_by_name}` : ""}
                </span>
                <a
                  href={viewing.url}
                  download={`${viewing.image.side || "document"}-${viewing.image.id.slice(0, 8)}.jpg`}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-primary-700 hover:bg-primary-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  {tr("Yuklab olish")}
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Skanerlangan, lekin hali saqlanmagan suratlar — "saqlangach mehmon
 *  kartasiga yoziladi" degan eslatma bilan. */
export function PendingScanImages({ scan, className }: { scan: ScanImages | null; className?: string }) {
  const [entries, setEntries] = useState<{ side: DocumentSide; url: string }[]>([])
  // Havolalar effekt ichida yaratiladi va o'sha yerda bo'shatiladi —
  // StrictMode qayta o'rnatganda ham rasm uzilib qolmaydi
  useEffect(() => {
    const list = scan
      ? SCAN_SIDES.flatMap((side) => {
          const blob = scan.images[side]
          return blob ? [{ side, url: URL.createObjectURL(blob) }] : []
        })
      : []
    setEntries(list)
    return () => list.forEach((e) => URL.revokeObjectURL(e.url))
  }, [scan])

  if (entries.length === 0) return null
  return (
    <div
      className={
        "flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 py-2 " +
        (className || "")
      }
    >
      <div className="flex shrink-0 gap-1">
        {entries.map((e) => (
          <img
            key={e.side}
            src={e.url}
            alt={sideLabel(e.side)}
            title={sideLabel(e.side)}
            className="h-9 w-14 rounded border border-emerald-200 object-cover"
          />
        ))}
      </div>
      <p className="text-[11px] leading-snug text-emerald-800">
        {tr("Hujjat surati saqlangach mehmon kartasiga yoziladi")}
      </p>
    </div>
  )
}
