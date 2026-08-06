import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, ImageUp, Loader2, RefreshCw, ScanLine, CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * Passport / ID karta skaneri.
 *
 * Hujjat pastidagi MRZ (mashina o'qiy oladigan zona) qatorlari kameradan
 * JONLI rejimda o'qiladi: har ~sekundda kadr olinib, brauzerning o'zida OCR
 * qilinadi (tesseract.js — dinamik import) va `mrz` kutubxonasi bilan tahlil
 * qilinadi; ism-familiya, seriya-raqam, tug'ilgan sana, JSHSHIR ajratib
 * olinadi. Telefonda orqa kamera, kompyuterda web-kamera; kamera bo'lmasa
 * rasm yuklash ham mumkin. Ma'lumot qurilmadan chiqmaydi.
 */

export interface ScannedDoc {
  firstName?: string
  lastName?: string
  birthDate?: string // yyyy-MM-dd
  documentNumber?: string // passport seriya-raqami
  personalNumber?: string // JSHSHIR / shaxsiy raqam
  documentType?: "PASSPORT" | "ID_CARD"
  nationality?: string // 3 harfli MRZ kodi (UZB, RUS...)
}

interface DocumentScannerProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onResult: (doc: ScannedDoc) => void
}

type Phase = "camera" | "processing" | "result" | "error"

// Yo'naltiruvchi ramka — kadrning qaysi qismi MRZ deb olinadi (foizlarda).
// Overlay ham, kesish ham aynan shu qiymatlardan foydalanadi (WYSIWYG).
const GUIDE = { left: 0.04, right: 0.96, top: 0.58, bottom: 0.95 }

const titleCase = (s: string) =>
  s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ")

// MRZ'dagi YYMMDD sanani to'liq sanaga aylantirish: kelajakka tushib qolsa
// o'tgan asrga suriladi (tug'ilgan sana kelajakda bo'lolmaydi)
function mrzDateToIso(yymmdd?: string | null): string | undefined {
  if (!yymmdd || !/^\d{6}$/.test(yymmdd)) return undefined
  const yy = Number(yymmdd.slice(0, 2))
  const mm = yymmdd.slice(2, 4)
  const dd = yymmdd.slice(4, 6)
  const nowYear = new Date().getFullYear()
  let year = 2000 + yy
  if (year > nowYear) year = 1900 + yy
  return `${year}-${mm}-${dd}`
}

function cleanField(s?: string | null): string | undefined {
  if (!s) return undefined
  const v = s.replace(/</g, " ").replace(/\s+/g, " ").trim()
  return v || undefined
}

/* Kesilgan zonani OCR uchun tayyorlash: kattalashtirish, oq-qora
   binarizatsiya (MRZ — oq fonda qora monospace matn, shunda eng aniq o'qiladi) */
function preprocessRegion(
  src: HTMLCanvasElement | HTMLVideoElement,
  srcW: number,
  srcH: number,
  region: { left: number; right: number; top: number; bottom: number }
): HTMLCanvasElement {
  const sx = Math.floor(srcW * region.left)
  const sw = Math.floor(srcW * (region.right - region.left))
  const sy = Math.floor(srcH * region.top)
  const sh = Math.floor(srcH * (region.bottom - region.top))

  const targetW = 1600
  const scale = Math.min(Math.max(targetW / sw, 1), 4)
  const out = document.createElement("canvas")
  out.width = Math.round(sw * scale)
  out.height = Math.round(sh * scale)
  const ctx = out.getContext("2d", { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(src as any, sx, sy, sw, sh, 0, 0, out.width, out.height)

  // Grayscale + o'rtacha yorqinlikka nisbatan binarizatsiya
  const img = ctx.getImageData(0, 0, out.width, out.height)
  const d = img.data
  let sum = 0
  const gray = new Uint8ClampedArray(d.length / 4)
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000
    gray[j] = g
    sum += g
  }
  const mean = sum / gray.length
  const threshold = mean * 0.82
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const v = gray[j] < threshold ? 0 : 255
    d[i] = d[i + 1] = d[i + 2] = v
  }
  ctx.putImageData(img, 0, 0)
  return out
}

export function DocumentScanner({ open, onOpenChange, onResult }: DocumentScannerProps) {
  const [phase, setPhase] = useState<Phase>("camera")
  const [progress, setProgress] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const [ocrReady, setOcrReady] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [result, setResult] = useState<ScannedDoc | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const workerRef = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  // Jonli skan sikli uchun: faolmi va hozir band emasmi
  const liveActiveRef = useRef(false)
  const busyRef = useRef(false)

  const stopCamera = useCallback(() => {
    liveActiveRef.current = false
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    try {
      // Telefonda orqa (environment) kamera, kompyuterda mavjud web-kamera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      streamRef.current = stream
      // Qo'llab-quvvatlansa uzluksiz fokus — MRZ ravshan bo'lishi uchun
      try {
        const track = stream.getVideoTracks()[0]
        const caps: any = track.getCapabilities?.()
        if (caps?.focusMode?.includes?.("continuous")) {
          await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as any] })
        }
      } catch {}
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
    } catch {
      setCameraError(
        "Kameraga ruxsat berilmadi yoki kamera topilmadi — rasm yuklash orqali davom eting"
      )
    }
  }, [])

  const getWorker = async () => {
    if (workerRef.current) return workerRef.current
    const Tesseract = await import("tesseract.js")
    const worker = await Tesseract.createWorker("eng", 1, {
      logger: (m: any) => {
        if (m.status === "recognizing text") {
          setProgress(Math.round((m.progress || 0) * 100))
        }
      },
    })
    // MRZ faqat shu belgilar to'plamidan iborat; PSM 6 — yaxlit matn bloki
    await worker.setParameters({
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<",
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
    })
    workerRef.current = worker
    setOcrReady(true)
    return worker
  }

  const tryParseMrz = async (text: string): Promise<ScannedDoc | null> => {
    const { parse } = await import("mrz")
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.replace(/[^A-Z0-9<]/g, ""))
      .filter((l) => l.length >= 24 && l.includes("<"))
    if (!lines.length) return null

    const norm = (l: string, len: number) =>
      l.length > len ? l.slice(0, len) : l.padEnd(len, "<")

    const candidates: string[][] = []
    for (let i = 0; i < lines.length; i++) {
      // TD1 — ID karta: 3 qator × 30 belgi
      if (i + 2 < lines.length && /^[IAC]/.test(lines[i])) {
        candidates.push([norm(lines[i], 30), norm(lines[i + 1], 30), norm(lines[i + 2], 30)])
      }
      // TD3 — passport: 2 qator × 44 belgi
      if (i + 1 < lines.length && /^P/.test(lines[i])) {
        candidates.push([norm(lines[i], 44), norm(lines[i + 1], 44)])
      }
    }

    for (const cand of candidates) {
      try {
        // autocorrect — OCR'ning O↔0, I↔1 kabi tipik xatolarini tuzatadi
        const parsed = parse(cand, { autocorrect: true }) as any
        const f = parsed?.fields || {}
        if (!f.documentNumber || !f.lastName || !f.birthDate) continue
        const personal =
          cleanField(f.personalNumber) || cleanField(f.optional1) || undefined
        return {
          firstName: f.firstName ? titleCase(cleanField(f.firstName) || "") : undefined,
          lastName: f.lastName ? titleCase(cleanField(f.lastName) || "") : undefined,
          birthDate: mrzDateToIso(f.birthDate),
          documentNumber: cleanField(f.documentNumber)?.replace(/\s+/g, ""),
          personalNumber: personal?.replace(/\s+/g, ""),
          documentType: parsed?.format === "TD3" ? "PASSPORT" : "ID_CARD",
          nationality: cleanField(f.nationality)?.toUpperCase(),
        }
      } catch {
        continue
      }
    }
    return null
  }

  // Bitta kadrda MRZ'ni izlash: avval ramka zonasi, keyin kengroq pastki qism
  const scanFrameOnce = async (
    src: HTMLCanvasElement | HTMLVideoElement,
    w: number,
    h: number,
    regions: Array<{ left: number; right: number; top: number; bottom: number }>
  ): Promise<ScannedDoc | null> => {
    const worker = await getWorker()
    for (const region of regions) {
      const prepared = preprocessRegion(src, w, h, region)
      const { data } = await worker.recognize(prepared)
      const doc = await tryParseMrz(data.text || "")
      if (doc) return doc
    }
    return null
  }

  const onFound = (doc: ScannedDoc) => {
    liveActiveRef.current = false
    stopCamera()
    setResult(doc)
    setPhase("result")
  }

  // JONLI skan sikli: kamera ochiq ekan, kadrlar ketma-ket tekshiriladi
  const runLiveLoop = useCallback(async () => {
    if (liveActiveRef.current) return
    liveActiveRef.current = true
    // OCR modulini oldindan yuklab olamiz (birinchi kadr tez bo'lsin)
    try {
      await getWorker()
    } catch {
      liveActiveRef.current = false
      return
    }
    while (liveActiveRef.current) {
      const video = videoRef.current
      if (video && video.videoWidth > 0 && !busyRef.current) {
        busyRef.current = true
        try {
          const doc = await scanFrameOnce(video, video.videoWidth, video.videoHeight, [
            GUIDE,
            { left: 0.02, right: 0.98, top: 0.45, bottom: 1 },
          ])
          if (doc && liveActiveRef.current) {
            busyRef.current = false
            onFound(doc)
            return
          }
          setAttempts((a) => a + 1)
        } catch {
          // bitta kadr xatosi siklni to'xtatmaydi
        }
        busyRef.current = false
      }
      await new Promise((r) => setTimeout(r, 600))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Dialog ochilganda kamera + jonli sikl; yopilganda hammasi tozalanadi
  useEffect(() => {
    if (open) {
      setPhase("camera")
      setResult(null)
      setErrorMsg(null)
      setAttempts(0)
      startCamera().then(() => runLiveLoop())
    } else {
      stopCamera()
      if (workerRef.current) {
        workerRef.current.terminate().catch(() => {})
        workerRef.current = null
        setOcrReady(false)
      }
    }
    return () => {
      stopCamera()
      if (workerRef.current) {
        workerRef.current.terminate().catch(() => {})
        workerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // "Qayta skanerlash" — kamera fazasiga qaytilganda siklni qayta boshlaymiz
  useEffect(() => {
    if (open && phase === "camera" && !liveActiveRef.current) {
      setAttempts(0)
      startCamera().then(() => runLiveLoop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // Qo'lda suratga olish — to'liq kadr bo'yicha ham sinab ko'radi
  const capture = async () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    liveActiveRef.current = false
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext("2d")!.drawImage(video, 0, 0)
    stopCamera()
    setPhase("processing")
    setProgress(0)
    try {
      const doc = await scanFrameOnce(canvas, canvas.width, canvas.height, [
        GUIDE,
        { left: 0.02, right: 0.98, top: 0.45, bottom: 1 },
        { left: 0, right: 1, top: 0, bottom: 1 },
      ])
      if (doc) return onFound(doc)
      setErrorMsg(
        "MRZ qatorlari o'qilmadi. Hujjat pastidagi 2-3 qatorli zona ramkada ravshan ko'rinsin, yorug'lik yetarli bo'lsin."
      )
      setPhase("error")
    } catch {
      setErrorMsg("Skanerlashda xatolik yuz berdi. Qayta urinib ko'ring.")
      setPhase("error")
    }
  }

  const onFileSelected = async (file: File | null) => {
    if (!file) return
    liveActiveRef.current = false
    setPhase("processing")
    setProgress(0)
    try {
      const bitmap = await createImageBitmap(file)
      const canvas = document.createElement("canvas")
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0)
      stopCamera()
      const doc = await scanFrameOnce(canvas, canvas.width, canvas.height, [
        { left: 0.02, right: 0.98, top: 0.45, bottom: 1 },
        { left: 0, right: 1, top: 0, bottom: 1 },
      ])
      if (doc) return onFound(doc)
      setErrorMsg(
        "Rasmda MRZ qatorlari topilmadi — hujjatning pastki zonasi to'liq va ravshan tushgan rasmni tanlang."
      )
      setPhase("error")
    } catch {
      setErrorMsg("Rasm o'qilmadi — boshqa rasm tanlang")
      setPhase("error")
    }
  }

  const apply = () => {
    if (result) onResult(result)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine size={18} /> Hujjatni skanerlash
          </DialogTitle>
        </DialogHeader>

        {/* Yashirin fayl tanlash — kamera ishlamasa zaxira yo'l */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            onFileSelected(e.target.files?.[0] ?? null)
            e.target.value = ""
          }}
        />

        {phase === "camera" && (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-xl bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="aspect-[4/3] w-full object-cover"
              />
              {/* MRZ zonasi ramkasi — kesish aynan shu chegaralarda bo'ladi */}
              <div
                className="pointer-events-none absolute rounded-lg border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
                style={{
                  left: `${GUIDE.left * 100}%`,
                  right: `${(1 - GUIDE.right) * 100}%`,
                  top: `${GUIDE.top * 100}%`,
                  bottom: `${(1 - GUIDE.bottom) * 100}%`,
                }}
              />
              {/* Jonli holat indikatori */}
              <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white">
                {ocrReady ? (
                  <>
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                    Avtomatik o'qilmoqda{attempts > 0 ? ` · ${attempts}` : ""}...
                  </>
                ) : (
                  <>
                    <Loader2 size={11} className="animate-spin" />
                    OCR tayyorlanmoqda...
                  </>
                )}
              </div>
              <p className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-[11px] font-medium text-white/90">
                Hujjat pastidagi MRZ qatorlarini ramkaga joylang
              </p>
            </div>
            {cameraError && (
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                <AlertCircle size={15} className="mt-0.5 shrink-0" /> {cameraError}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={capture} disabled={!!cameraError} className="gap-2">
                <Camera size={16} /> Suratga olish
              </Button>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <ImageUp size={16} /> Rasm yuklash
              </Button>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Ramkadagi zona avtomatik o'qiladi — hujjatni yaqin tutib, bir necha soniya
              qimirlatmay turing. Passportda pastki 2 qator, ID kartaning orqa tomonida 3
              qator (MRZ) bo'ladi. Ma'lumotlar faqat shu qurilmada qayta ishlanadi.
            </p>
          </div>
        )}

        {phase === "processing" && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="text-sm font-medium">O'qilmoqda... {progress > 0 && `${progress}%`}</p>
            <p className="text-xs text-muted-foreground">
              Birinchi ishga tushirishda OCR moduli yuklab olinadi
            </p>
          </div>
        )}

        {phase === "result" && result && (
          <div className="space-y-3">
            <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              <CheckCircle2 size={16} /> Hujjat muvaffaqiyatli o'qildi
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-muted/60 p-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Ism</p>
                <p className="mt-0.5 font-medium">{result.firstName || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Familiya</p>
                <p className="mt-0.5 font-medium">{result.lastName || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tug'ilgan sana</p>
                <p className="mt-0.5 font-medium">{result.birthDate || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Hujjat raqami</p>
                <p className="mt-0.5 font-medium">{result.documentNumber || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Shaxsiy raqam/JSHSHIR</p>
                <p className="mt-0.5 font-medium">{result.personalNumber || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Hujjat turi</p>
                <p className="mt-0.5 font-medium">
                  {result.documentType === "PASSPORT" ? "Passport" : "ID karta"}
                  {result.nationality ? ` · ${result.nationality}` : ""}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setPhase("camera")} className="gap-2">
                <RefreshCw size={15} /> Qayta skanerlash
              </Button>
              <Button onClick={apply} className="gap-2">
                <CheckCircle2 size={15} /> Formani to'ldirish
              </Button>
            </div>
          </div>
        )}

        {phase === "error" && (
          <div className="space-y-3">
            <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" /> {errorMsg}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setPhase("camera")} className="gap-2">
                <RefreshCw size={15} /> Qayta urinish
              </Button>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <ImageUp size={16} /> Rasm yuklash
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
