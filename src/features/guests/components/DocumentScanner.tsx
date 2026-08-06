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
 * Hujjatning pastki qismidagi MRZ (mashina o'qiy oladigan zona) qatorlari
 * kamera orqali suratga olinadi, brauzerning o'zida OCR qilinadi (tesseract.js,
 * sahifa yuklamasiga ta'sir qilmasligi uchun dinamik import) va `mrz`
 * kutubxonasi bilan tahlil qilinadi. Telefonda orqa kamera, kompyuterda esa
 * web-kamera ishlatiladi; kamera bo'lmasa rasm yuklash ham mumkin.
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

export function DocumentScanner({ open, onOpenChange, onResult }: DocumentScannerProps) {
  const [phase, setPhase] = useState<Phase>("camera")
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [result, setResult] = useState<ScannedDoc | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const workerRef = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    stopCamera()
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
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
    } catch {
      setCameraError(
        "Kameraga ruxsat berilmadi yoki kamera topilmadi — rasm yuklash orqali davom eting"
      )
    }
  }, [stopCamera])

  // Dialog ochilganda kamerani ishga tushiramiz, yopilganda hammasini tozalaymiz
  useEffect(() => {
    if (open) {
      setPhase("camera")
      setResult(null)
      setErrorMsg(null)
      startCamera()
    } else {
      stopCamera()
      if (workerRef.current) {
        workerRef.current.terminate().catch(() => {})
        workerRef.current = null
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

  // Kamera fazasiga qaytilganda video oqimni qayta ulaymiz
  useEffect(() => {
    if (open && phase === "camera") startCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

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
    // MRZ faqat shu belgilar to'plamidan iborat — aniqlikni sezilarli oshiradi
    await worker.setParameters({
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<",
    })
    workerRef.current = worker
    return worker
  }

  // Rasm bo'lagini OCR uchun tayyorlash: kesish, kattalashtirish, kontrast
  const cropToCanvas = (
    src: HTMLCanvasElement,
    topRatio: number
  ): HTMLCanvasElement => {
    const sy = Math.floor(src.height * topRatio)
    const sh = src.height - sy
    const targetW = 1400
    const scale = Math.min(targetW / src.width, 3)
    const out = document.createElement("canvas")
    out.width = Math.round(src.width * scale)
    out.height = Math.round(sh * scale)
    const ctx = out.getContext("2d")!
    ctx.filter = "grayscale(1) contrast(1.6)"
    ctx.drawImage(src, 0, sy, src.width, sh, 0, 0, out.width, out.height)
    return out
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
        if (!f.documentNumber || !f.lastName) continue
        const personal =
          cleanField(f.personalNumber) || cleanField(f.optional1) || undefined
        const doc: ScannedDoc = {
          firstName: f.firstName ? titleCase(cleanField(f.firstName) || "") : undefined,
          lastName: f.lastName ? titleCase(cleanField(f.lastName) || "") : undefined,
          birthDate: mrzDateToIso(f.birthDate),
          documentNumber: cleanField(f.documentNumber)?.replace(/\s+/g, ""),
          personalNumber: personal?.replace(/\s+/g, ""),
          documentType: parsed?.format === "TD3" ? "PASSPORT" : "ID_CARD",
          nationality: cleanField(f.nationality)?.toUpperCase(),
        }
        return doc
      } catch {
        continue
      }
    }
    return null
  }

  const processCanvas = async (source: HTMLCanvasElement) => {
    setPhase("processing")
    setProgress(0)
    setErrorMsg(null)
    try {
      const worker = await getWorker()
      // MRZ hujjatning pastida — avval pastki qismlarni, keyin to'liq rasmni
      // sinab ko'ramiz (foydalanuvchi hujjatni har xil masofada tutishi mumkin)
      for (const topRatio of [0.55, 0.3, 0]) {
        const region = cropToCanvas(source, topRatio)
        const { data } = await worker.recognize(region)
        const doc = await tryParseMrz(data.text || "")
        if (doc) {
          setResult(doc)
          setPhase("result")
          return
        }
      }
      setErrorMsg(
        "MRZ qatorlari o'qilmadi. Hujjatning pastki 2-3 qatorli zonasi ravshan va to'liq ko'rinsin, yorug'lik yetarli bo'lsin."
      )
      setPhase("error")
    } catch {
      setErrorMsg("Skanerlashda xatolik yuz berdi. Qayta urinib ko'ring.")
      setPhase("error")
    }
  }

  const capture = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext("2d")!.drawImage(video, 0, 0)
    stopCamera()
    processCanvas(canvas)
  }

  const onFileSelected = async (file: File | null) => {
    if (!file) return
    try {
      const bitmap = await createImageBitmap(file)
      const canvas = document.createElement("canvas")
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0)
      stopCamera()
      processCanvas(canvas)
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
              {/* MRZ zonasi uchun yo'naltiruvchi ramka */}
              <div className="pointer-events-none absolute inset-x-6 bottom-6 rounded-lg border-2 border-emerald-400/90 py-5 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              <p className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-[11px] font-medium text-white/90">
                Hujjatning pastki MRZ qatorlarini ramkaga joylang
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
              Passportning pastki 2 qatorli yoki ID kartaning orqa tomonidagi 3 qatorli
              MRZ zonasi ravshan ko'rinishi kerak. Ma'lumotlar faqat shu qurilmada
              qayta ishlanadi — hech qayerga yuborilmaydi.
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
