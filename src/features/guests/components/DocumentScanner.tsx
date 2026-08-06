import { useCallback, useEffect, useRef, useState } from "react"
import {
  Camera,
  ImageUp,
  Loader2,
  RefreshCw,
  ScanLine,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  BookUser,
  ArrowLeft,
} from "lucide-react"
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
 * Avval hujjat turi tanlanadi, so'ng kamerada aynan shu hujjat shaklidagi
 * ramka ko'rsatiladi. Ramkadagi tasvir JONLI rejimda o'qiladi: kadr olinib,
 * brauzerning o'zida OCR qilinadi (tesseract.js — dinamik import) va hujjat
 * pastidagi MRZ qatorlari `mrz` kutubxonasi bilan tahlil qilinadi — ism,
 * familiya, seriya-raqam, tug'ilgan sana, JSHSHIR ajratib olinadi.
 * Telefonda orqa kamera, kompyuterda web-kamera; rasm yuklash ham mumkin.
 * Ma'lumotlar qurilmadan chiqmaydi.
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

type DocType = "PASSPORT" | "ID_CARD"
type Phase = "select" | "camera" | "processing" | "result" | "error"

// Kamera oynasi 4:3 — ramka geometriyasi shu nisbatga nisbatan hisoblanadi
const CONTAINER_ASPECT = 4 / 3

// Har bir hujjat turi uchun ramka o'lchamlari va MRZ zonasi
const DOC_SPECS: Record<
  DocType,
  { aspect: number; widthFrac: number; mrzFrac: number; hint: string }
> = {
  // ID-1 karta: 85.6×54mm (orqa tomonda 3 qatorli MRZ)
  ID_CARD: {
    aspect: 85.6 / 54,
    widthFrac: 0.88,
    mrzFrac: 0.34,
    hint: "ID kartaning ORQA tomonini ramkaga joylang",
  },
  // Passport ma'lumotlar sahifasi: 125×88mm (pastda 2 qatorli MRZ)
  PASSPORT: {
    aspect: 125 / 88,
    widthFrac: 0.86,
    mrzFrac: 0.26,
    hint: "Passportning ma'lumotlar sahifasini ramkaga joylang",
  },
}

interface Region {
  left: number
  right: number
  top: number
  bottom: number
}

// Tanlangan hujjat uchun ramka (konteyner ulushlarida, markazda)
function frameRegion(t: DocType): Region {
  const spec = DOC_SPECS[t]
  const w = spec.widthFrac
  const h = (spec.widthFrac * CONTAINER_ASPECT) / spec.aspect
  const left = (1 - w) / 2
  const top = (1 - Math.min(h, 0.94)) / 2
  return { left, right: left + w, top, bottom: top + Math.min(h, 0.94) }
}

// Ramka ichidagi MRZ zonasi (hujjatning pastki qismi)
function mrzRegion(t: DocType): Region {
  const f = frameRegion(t)
  const fh = f.bottom - f.top
  return {
    left: f.left + 0.01,
    right: f.right - 0.01,
    top: f.bottom - fh * DOC_SPECS[t].mrzFrac,
    bottom: f.bottom,
  }
}

/* object-cover bilan ko'rsatilgan videoda konteyner ulushlarini manba kadr
   piksellariga o'girish: konteynerda ko'ringan qism — manbaning markaziy
   CONTAINER_ASPECT nisbatli bo'lagi */
function containerToSource(
  videoW: number,
  videoH: number,
  r: Region
): { sx: number; sy: number; sw: number; sh: number } {
  const rv = videoW / videoH
  let visW = videoW
  let visH = videoH
  if (rv > CONTAINER_ASPECT) {
    visW = videoH * CONTAINER_ASPECT
  } else if (rv < CONTAINER_ASPECT) {
    visH = videoW / CONTAINER_ASPECT
  }
  const x0 = (videoW - visW) / 2
  const y0 = (videoH - visH) / 2
  return {
    sx: Math.floor(x0 + r.left * visW),
    sy: Math.floor(y0 + r.top * visH),
    sw: Math.floor((r.right - r.left) * visW),
    sh: Math.floor((r.bottom - r.top) * visH),
  }
}

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

/* Kesilgan zonani OCR uchun tayyorlash: kattalashtirish va oq-qora
   binarizatsiya (MRZ — oq fonda qora monospace matn, shunda aniq o'qiladi) */
function preprocessCrop(
  src: HTMLCanvasElement | HTMLVideoElement,
  crop: { sx: number; sy: number; sw: number; sh: number }
): HTMLCanvasElement {
  // Passportning 44 belgili qatorlari uchun ham yetarli aniqlik bo'lsin
  const targetW = 1800
  const scale = Math.min(Math.max(targetW / crop.sw, 1), 4)
  const out = document.createElement("canvas")
  out.width = Math.round(crop.sw * scale)
  out.height = Math.round(crop.sh * scale)
  const ctx = out.getContext("2d", { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(src as any, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, out.width, out.height)

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
  const [phase, setPhase] = useState<Phase>("select")
  const [docType, setDocType] = useState<DocType>("ID_CARD")
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
  const liveActiveRef = useRef(false)
  const busyRef = useRef(false)
  const docTypeRef = useRef<DocType>("ID_CARD")

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
    // Diqqat: qatorda "<" bo'lishini talab qilib bo'lmaydi — passportning
    // 2-qatori (JSHSHIR to'liq 14 raqam bo'lsa) butunlay "<"siz keladi
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.replace(/[^A-Z0-9<]/g, ""))
      .filter((l) => l.length >= 24)
    if (!lines.length) return null

    const norm = (l: string, len: number) =>
      l.length > len ? l.slice(0, len) : l.padEnd(len, "<")

    const candidates: string[][] = []
    for (let i = 0; i < lines.length; i++) {
      // TD1 — ID karta: 3 qator × 30 belgi. Birinchi belgi noto'g'ri
      // o'qilgan bo'lishi mumkin — uzunliklar mos kelsa ham sinab ko'ramiz
      if (i + 2 < lines.length) {
        const triple = [lines[i], lines[i + 1], lines[i + 2]]
        const td1ish = triple.every((l) => l.length >= 26 && l.length <= 34)
        if (td1ish || /^[IAC]/.test(lines[i])) {
          candidates.push(triple.map((l) => norm(l, 30)))
        }
      }
      // TD3 — passport: 2 qator × 44 belgi
      if (i + 1 < lines.length) {
        const a = lines[i]
        const b = lines[i + 1]
        const td3ish = a.length >= 38 && b.length >= 38
        if (td3ish || /^P/.test(a)) {
          candidates.push([norm(a, 44), norm(b, 44)])
        }
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

  // Video kadrida MRZ'ni izlash: avval MRZ zonasi, keyin butun ramka
  const scanVideoFrame = async (video: HTMLVideoElement): Promise<ScannedDoc | null> => {
    const worker = await getWorker()
    const t = docTypeRef.current
    const regions = [mrzRegion(t), frameRegion(t)]
    for (const region of regions) {
      const crop = containerToSource(video.videoWidth, video.videoHeight, region)
      if (crop.sw < 50 || crop.sh < 20) continue
      const prepared = preprocessCrop(video, crop)
      const { data } = await worker.recognize(prepared)
      const doc = await tryParseMrz(data.text || "")
      if (doc) return doc
    }
    return null
  }

  // Yuklangan rasmda izlash: pastki qism, so'ng to'liq rasm
  const scanImageCanvas = async (canvas: HTMLCanvasElement): Promise<ScannedDoc | null> => {
    const worker = await getWorker()
    const crops = [
      { sx: 0, sy: Math.floor(canvas.height * 0.5), sw: canvas.width, sh: Math.ceil(canvas.height * 0.5) },
      { sx: 0, sy: 0, sw: canvas.width, sh: canvas.height },
    ]
    for (const crop of crops) {
      const prepared = preprocessCrop(canvas, crop)
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
          const doc = await scanVideoFrame(video)
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

  // Dialog ochilganda tur tanlashdan boshlaymiz; yopilganda hammasi tozalanadi
  useEffect(() => {
    if (open) {
      setPhase("select")
      setResult(null)
      setErrorMsg(null)
      setAttempts(0)
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

  // Kamera fazasiga o'tilganda oqim + jonli sikl ishga tushadi
  useEffect(() => {
    if (open && phase === "camera") {
      setAttempts(0)
      startCamera().then(() => runLiveLoop())
    }
    if (phase !== "camera") {
      liveActiveRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, open])

  const chooseType = (t: DocType) => {
    setDocType(t)
    docTypeRef.current = t
    setPhase("camera")
  }

  // Qo'lda suratga olish — jonli sikl topolmagan holatlar uchun
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
      const doc = await scanImageCanvas(canvas)
      if (doc) return onFound(doc)
      setErrorMsg(
        docType === "ID_CARD"
          ? "MRZ o'qilmadi. ID kartaning ORQA tomonidagi 3 qatorli zona ramkada ravshan ko'rinsin."
          : "MRZ o'qilmadi. Passport pastidagi 2 qatorli zona ramkada ravshan ko'rinsin."
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
      const doc = await scanImageCanvas(canvas)
      if (doc) return onFound(doc)
      setErrorMsg(
        "Rasmda MRZ qatorlari topilmadi — hujjatning MRZ zonasi to'liq va ravshan tushgan rasmni tanlang."
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

  const frame = frameRegion(docType)
  const mrz = mrzRegion(docType)

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

        {phase === "select" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Qaysi hujjat skanerlanadi?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => chooseType("ID_CARD")}
                className="flex flex-col items-center gap-2.5 rounded-xl border-2 border-border p-5 transition-all hover:border-primary hover:bg-primary/5"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <CreditCard size={24} />
                </span>
                <span className="text-sm font-semibold">ID karta</span>
                <span className="text-center text-[11px] leading-snug text-muted-foreground">
                  Orqa tomoni skanerlaniladi (3 qatorli MRZ)
                </span>
              </button>
              <button
                type="button"
                onClick={() => chooseType("PASSPORT")}
                className="flex flex-col items-center gap-2.5 rounded-xl border-2 border-border p-5 transition-all hover:border-primary hover:bg-primary/5"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <BookUser size={24} />
                </span>
                <span className="text-sm font-semibold">Passport</span>
                <span className="text-center text-[11px] leading-snug text-muted-foreground">
                  Ma'lumotlar sahifasi skanerlaniladi (2 qatorli MRZ)
                </span>
              </button>
            </div>
          </div>
        )}

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
              {/* Hujjat shaklidagi ramka — kesish aynan shu chegaralarda */}
              <div
                className="pointer-events-none absolute rounded-xl border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
                style={{
                  left: `${frame.left * 100}%`,
                  right: `${(1 - frame.right) * 100}%`,
                  top: `${frame.top * 100}%`,
                  bottom: `${(1 - frame.bottom) * 100}%`,
                }}
              />
              {/* MRZ zonasi — hujjat pastidagi o'qiladigan qatorlar */}
              <div
                className="pointer-events-none absolute rounded-md border-2 border-dashed border-amber-300/90"
                style={{
                  left: `${mrz.left * 100}%`,
                  right: `${(1 - mrz.right) * 100}%`,
                  top: `${mrz.top * 100}%`,
                  bottom: `${(1 - mrz.bottom) * 100}%`,
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
              {/* Hujjat turi ko'rsatkichi + almashtirish */}
              <button
                type="button"
                onClick={() => setPhase("select")}
                className="absolute right-2 top-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-black/80"
              >
                {docType === "ID_CARD" ? <CreditCard size={12} /> : <BookUser size={12} />}
                {docType === "ID_CARD" ? "ID karta" : "Passport"}
              </button>
              <p className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-[11px] font-medium text-white/90">
                {DOC_SPECS[docType].hint}
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
              Hujjatni ramkaga to'liq joylab, bir necha soniya qimirlatmay turing —
              sariq punktir zonadagi MRZ qatorlari avtomatik o'qiladi. Ma'lumotlar
              faqat shu qurilmada qayta ishlanadi, hech qayerga yuborilmaydi.
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
            <button
              type="button"
              onClick={() => setPhase("select")}
              className="flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft size={13} /> Hujjat turini almashtirish
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
