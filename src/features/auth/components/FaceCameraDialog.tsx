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
 * Yuz uchun umumiy kamera dialogi: old kamera jonli ko'rinadi, tugma
 * bosilganda kadr olinib `onCapture`ga beriladi. onCapture xato matni
 * qaytarsa dialog ochiq qoladi va xato ko'rsatiladi; null qaytarsa yopiladi.
 * Kirish (login) va yuz biriktirish (enroll) uchun birdek ishlatiladi.
 */

interface FaceCameraDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  actionLabel: string
  hint?: string
  onCapture: (photo: Blob) => Promise<string | null>
}

export function FaceCameraDialog({
  open,
  onOpenChange,
  title,
  actionLabel,
  hint,
  onCapture,
}: FaceCameraDialogProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    if (!open) {
      stopCamera()
      return
    }
    setErrorMsg(null)
    setCameraError(null)
    ;(async () => {
      try {
        // Yuz uchun old (user) kamera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
      } catch {
        setCameraError("Kameraga ruxsat berilmadi yoki kamera topilmadi")
      }
    })()
    return () => stopCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const capture = async () => {
    const video = videoRef.current
    if (!video || !video.videoWidth || busy) return
    setBusy(true)
    setErrorMsg(null)
    try {
      const canvas = document.createElement("canvas")
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext("2d")!.drawImage(video, 0, 0)
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.9)
      )
      if (!blob) {
        setErrorMsg("Kadr olinmadi — qayta uriring")
        return
      }
      const err = await onCapture(blob)
      if (err) {
        setErrorMsg(err)
      } else {
        stopCamera()
        onOpenChange(false)
      }
    } finally {
      setBusy(false)
    }
  }

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
          </div>
          {hint && <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
          {cameraError && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              <AlertCircle size={15} className="mt-0.5 shrink-0" /> {cameraError}
            </p>
          )}
          {errorMsg && (
            <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle size={15} className="mt-0.5 shrink-0" /> {errorMsg}
            </p>
          )}
          <Button onClick={capture} disabled={!!cameraError || busy} className="w-full gap-2">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
            {actionLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
