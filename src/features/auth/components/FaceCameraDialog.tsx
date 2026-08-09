import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, Loader2, AlertCircle, ScanFace } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * Yuz uchun umumiy kamera dialogi: old kamera jonli ko'rinadi.
 *
 * `auto` rejimda (login) kadrlar AVTOMATIK ravishda ketma-ket tekshiriladi —
 * yuz tanilishi bilanoq onCapture muvaffaqiyat qaytaradi va dialog yopiladi;
 * tugma zaxira yo'l sifatida qoladi. Auto'siz (yuz biriktirish) faqat tugma
 * bosilganda kadr olinadi. onCapture xato matni qaytarsa dialog ochiq qoladi.
 */

interface FaceCameraDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  actionLabel: string
  hint?: string
  /** Kadrlarni avtomatik tekshirish (login uchun) */
  auto?: boolean
  onCapture: (photo: Blob) => Promise<string | null>
}

export function FaceCameraDialog({
  open,
  onOpenChange,
  title,
  actionLabel,
  hint,
  auto = false,
  onCapture,
}: FaceCameraDialogProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const liveRef = useRef(false)
  const [attempts, setAttempts] = useState(0)

  const stopCamera = useCallback(() => {
    liveRef.current = false
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  // Bitta kadr olib tekshirish. silent=true (avto sikl) — "yuz topilmadi"
  // xatosi yumshoq holat sifatida ko'rsatiladi, sikl davom etadi
  const attempt = useCallback(
    async (silent: boolean) => {
      const video = videoRef.current
      if (!video || !video.videoWidth || busyRef.current) return false
      busyRef.current = true
      setBusy(true)
      try {
        const canvas = document.createElement("canvas")
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        canvas.getContext("2d")!.drawImage(video, 0, 0)
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", 0.9)
        )
        if (!blob) {
          if (!silent) setErrorMsg("Kadr olinmadi — qayta uriring")
          return false
        }
        const err = await onCapture(blob)
        if (err) {
          setErrorMsg(err)
          if (silent) setAttempts((a) => a + 1)
          return false
        }
        stopCamera()
        onOpenChange(false)
        return true
      } finally {
        busyRef.current = false
        setBusy(false)
      }
    },
    [onCapture, onOpenChange, stopCamera]
  )

  useEffect(() => {
    if (!open) {
      stopCamera()
      return
    }
    setErrorMsg(null)
    setCameraError(null)
    setAttempts(0)
    let cancelled = false
    ;(async () => {
      try {
        // Yuz uchun old (user) kamera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        // AVTO rejim: yuz tanilguncha kadrlar ketma-ket tekshiriladi
        if (auto) {
          liveRef.current = true
          while (liveRef.current && !cancelled) {
            const ok = await attempt(true)
            if (ok) return
            await new Promise((r) => setTimeout(r, 1200))
          }
        }
      } catch {
        if (!cancelled) {
          setCameraError("Kameraga ruxsat berilmadi yoki kamera topilmadi")
        }
      }
    })()
    return () => {
      cancelled = true
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // "Yuz topilmadi" — avto rejimda tabiiy oraliq holat (odam hali joylashmagan)
  const softError = auto && errorMsg && errorMsg.includes("aniqlanmadi")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanFace size={18} /> {title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-xl bg-black">
            {/* Ko'zgu effekti — o'zini tabiiy ko'rish uchun */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="aspect-[4/3] w-full -scale-x-100 object-cover"
            />
            {/* Yuz uchun oval yo'naltiruvchi ramka */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-[70%] w-[52%] rounded-[50%] border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
            {/* Avto rejim holati */}
            {auto && !cameraError && (
              <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white">
                {busy ? (
                  <>
                    <Loader2 size={11} className="animate-spin" />
                    Tekshirilmoqda...
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                    Yuz avtomatik aniqlanmoqda{attempts > 0 ? ` · ${attempts}` : ""}...
                  </>
                )}
              </div>
            )}
          </div>
          {hint && <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
          {cameraError && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              <AlertCircle size={15} className="mt-0.5 shrink-0" /> {cameraError}
            </p>
          )}
          {errorMsg &&
            (softError ? (
              <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                Yuz qidirilmoqda — kameraga to'g'ri qarab turing...
              </p>
            ) : (
              <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle size={15} className="mt-0.5 shrink-0" /> {errorMsg}
              </p>
            ))}
          <Button
            onClick={() => attempt(false)}
            disabled={!!cameraError || busy}
            className="w-full gap-2"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
            {actionLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
