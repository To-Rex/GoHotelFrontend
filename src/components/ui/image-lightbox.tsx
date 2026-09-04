import { useEffect } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

/**
 * Suratni katta formatda ko'rish oynasi.
 *
 * Kamera tanigan mehmonning kichik dumaloq surati ba'zan yetmaydi —
 * qabulxonachi odamning yuziga qarab ishonch hosil qilmoqchi bo'ladi.
 * Suratga bosilganda shu oyna ochiladi: qora fon, katta surat, Escape
 * yoki istalgan joyga bosish bilan yopiladi.
 */
export function ImageLightbox({
  url,
  alt,
  caption,
  onClose,
}: {
  /** null — oyna yopiq */
  url: string | null
  alt?: string
  caption?: string
  onClose: () => void
}) {
  useEffect(() => {
    if (!url) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [url, onClose])

  if (!url) return null

  /* Portal SHART: oyna navbar menyusi ichidan chaqiriladi, navbarda esa
     backdrop-blur bor — u `position: fixed` uchun konteyner bo'lib
     qoladi va "butun ekran" oynasi navbar ichida qisilib chiqardi.
     body'ga ko'chirilgach surat chinakam dialog bo'lib ochiladi. */
  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-black/90 p-4"
      onClick={onClose}
      role="dialog"
      aria-label={alt || "Surat"}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
        title="Yopish"
        aria-label="Yopish"
      >
        <X size={20} />
      </button>
      <img
        src={url}
        alt={alt || ""}
        className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      {caption && (
        <p className="mt-3 max-w-lg text-center text-sm text-white/85">
          {caption}
        </p>
      )}
    </div>,
    document.body
  )
}
