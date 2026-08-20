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
import { useScanSettings, type ScanMode } from "../api/scanSettings"
import {
  parseVisualDocument,
  parseVisualLayout,
  mergeVisualResults,
  extractPinfl,
  extractDocNumber,
  pinflBirthDate,
  type VisualParseResult,
  type WordBox,
  type RegionBox,
} from "./visualDocParser"

/** Tesseract natijasidan so'zlarni koordinatalari bilan ajratib oladi */
function wordsFromResult(data: any): WordBox[] {
  const out: WordBox[] = []
  for (const block of data?.blocks ?? []) {
    for (const para of block?.paragraphs ?? []) {
      for (const line of para?.lines ?? []) {
        for (const w of line?.words ?? []) {
          const b = w?.bbox
          if (!b || !w.text) continue
          out.push({
            text: w.text,
            x0: b.x0,
            y0: b.y0,
            x1: b.x1,
            y1: b.y1,
            conf: w.confidence ?? 0,
          })
        }
      }
    }
  }
  return out
}

/** Auto rejimda MRZ uchun necha urinish beriladi — keyin vizualga o'tiladi */
const AUTO_MRZ_ATTEMPTS = 6

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

/* Kesilgan zonani OCR uchun tayyorlash. Ikki rejim:
   - "binary": kontrast cho'zish + Otsu binarizatsiyasi (tekis yorug'likda eng aniq)
   - "gray": faqat kontrast cho'zilgan kulrang (yaltirash/soya bo'lganda yaxshiroq)
   Jonli siklda rejimlar navbatlashadi — turli sharoitda tezroq natija chiqadi */
/* "adaptive" — LOKAL chegara (integral tasvir bilan): hujjat yuzasidagi
   yozuvlar uchun eng ishonchli. Global Otsu yaltirash, soya yoki gilyosh
   naqsh bo'lgan joyda butun bo'lakni qoraytirib/oqartirib yuboradi. */
type PrepMode = "binary" | "gray" | "adaptive"

function preprocessCrop(
  src: HTMLCanvasElement | HTMLVideoElement,
  crop: { sx: number; sy: number; sw: number; sh: number },
  mode: PrepMode,
  // Vizual matn MRZ'dan kichikroq bosiladi — u yerda kattaroq nishon beriladi
  targetW = 1600
): HTMLCanvasElement {
  // Passportning 44 belgili qatorlari uchun ham yetarli aniqlik: ~36px/belgi.
  // KATTA kadrlar KICHRAYTIRILADI ham (0.25x gacha) — yuqori aniqlikdagi
  // kamerada OCR bir xil o'lchamda ishlaydi, tezlik barqaror bo'ladi
  const scale = Math.min(Math.max(targetW / crop.sw, 0.25), 4)
  const out = document.createElement("canvas")
  out.width = Math.round(crop.sw * scale)
  out.height = Math.round(crop.sh * scale)
  const ctx = out.getContext("2d", { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(src as any, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, out.width, out.height)

  const img = ctx.getImageData(0, 0, out.width, out.height)
  const d = img.data
  const W = out.width
  const H = out.height
  const gray = new Uint8ClampedArray(d.length / 4)
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    gray[j] = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000
  }

  /* O'TKIRLASHTIRISH (unsharp mask) — kattalashtirilgan yoki fokusdan
     chiqqan suratda harflar chekkasi yoyilib ketadi; 3×3 o'rtacha bilan
     ayirma qo'shilsa, chekkalar tiklanadi va OCR sezilarli aniqroq o'qiydi.
     Faqat kattalashtirilgan (scale > 1.1) tasvirda qo'llanadi. */
  if (scale > 1.1 && W > 8 && H > 8) {
    const blurred = new Uint8ClampedArray(gray.length)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let sum = 0
        let count = 0
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy
          if (yy < 0 || yy >= H) continue
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx
            if (xx < 0 || xx >= W) continue
            sum += gray[yy * W + xx]
            count++
          }
        }
        blurred[y * W + x] = sum / count
      }
    }
    const amount = 0.9
    for (let j = 0; j < gray.length; j++) {
      gray[j] = Math.max(0, Math.min(255, gray[j] + amount * (gray[j] - blurred[j])))
    }
  }

  const hist = new Uint32Array(256)
  for (let j = 0; j < gray.length; j++) hist[Math.round(gray[j])]++

  // Kontrast cho'zish: 2% va 98% percentillar orasini to'liq diapazonga yoyish
  const total = gray.length
  let lo = 0
  let hi = 255
  {
    let acc = 0
    for (let v = 0; v < 256; v++) {
      acc += hist[v]
      if (acc >= total * 0.02) {
        lo = v
        break
      }
    }
    acc = 0
    for (let v = 255; v >= 0; v--) {
      acc += hist[v]
      if (acc >= total * 0.02) {
        hi = v
        break
      }
    }
    if (hi <= lo) {
      lo = 0
      hi = 255
    }
  }
  const range = hi - lo || 1
  const stretched = new Uint8ClampedArray(total)
  const hist2 = new Uint32Array(256)
  for (let j = 0; j < total; j++) {
    const v = Math.max(0, Math.min(255, ((gray[j] - lo) * 255) / range))
    stretched[j] = v
    hist2[Math.round(v)]++
  }

  if (mode === "gray") {
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      d[i] = d[i + 1] = d[i + 2] = stretched[j]
    }
  } else if (mode === "adaptive") {
    /* LOKAL chegara (Bradley-Roth usuli, integral tasvir bilan O(n)):
       har piksel o'z atrofidagi (w×w) oyna o'rtachasi bilan solishtiriladi.
       Notekis yorug'lik, yaltirash va soya bo'lgan hujjatlarda global
       Otsu'dan ancha aniq — yozuvlar yo'qolib ketmaydi. */
    const W = out.width
    const H = out.height
    // Integral tasvir (prefix sum) — (W+1)×(H+1)
    const integral = new Float64Array((W + 1) * (H + 1))
    for (let y = 0; y < H; y++) {
      let rowSum = 0
      for (let x = 0; x < W; x++) {
        rowSum += stretched[y * W + x]
        integral[(y + 1) * (W + 1) + (x + 1)] =
          integral[y * (W + 1) + (x + 1)] + rowSum
      }
    }
    // Oyna o'lchami — kenglikning ~1/16 qismi (belgi balandligiga yaqin)
    const half = Math.max(6, Math.round(W / 32))
    // Matn fon o'rtachasidan shu foizga qorong'i bo'lsa — qora deb olinadi
    const T = 0.86
    for (let y = 0; y < H; y++) {
      const y1 = Math.max(0, y - half)
      const y2 = Math.min(H - 1, y + half)
      for (let x = 0; x < W; x++) {
        const x1 = Math.max(0, x - half)
        const x2 = Math.min(W - 1, x + half)
        const count = (x2 - x1 + 1) * (y2 - y1 + 1)
        const sum =
          integral[(y2 + 1) * (W + 1) + (x2 + 1)] -
          integral[y1 * (W + 1) + (x2 + 1)] -
          integral[(y2 + 1) * (W + 1) + x1] +
          integral[y1 * (W + 1) + x1]
        const mean = sum / count
        const idx = y * W + x
        const v = stretched[idx] < mean * T ? 0 : 255
        const p = idx * 4
        d[p] = d[p + 1] = d[p + 2] = v
      }
    }
  } else {
    // Otsu: sinflararo dispersiyani maksimallashtiruvchi chegara
    let sumAll = 0
    for (let v = 0; v < 256; v++) sumAll += v * hist2[v]
    let sumB = 0
    let wB = 0
    let best = 0
    let threshold = 127
    for (let v = 0; v < 256; v++) {
      wB += hist2[v]
      if (wB === 0) continue
      const wF = total - wB
      if (wF === 0) break
      sumB += v * hist2[v]
      const mB = sumB / wB
      const mF = (sumAll - sumB) / wF
      const between = wB * wF * (mB - mF) * (mB - mF)
      if (between > best) {
        best = between
        threshold = v
      }
    }
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      const v = stretched[j] < threshold ? 0 : 255
      d[i] = d[i + 1] = d[i + 2] = v
    }
  }
  ctx.putImageData(img, 0, 0)
  return out
}

/* OCR resurslari LOKAL serverdan (public/ocr) yuklanadi — CDN'ga bog'liqlik
   YO'Q: tashqi internet sekin yoki yopiq bo'lsa ham skaner ishlayveradi
   (fayllar PWA tomonidan oldindan keshlab ham qo'yiladi).
   Worker BIR MARTA yaratiladi va sessiya davomida "issiq" turadi — dialog
   yopib-ochilganda qayta yuklab o'tirmaydi, skan darhol boshlanadi. */
let sharedWorker: Promise<any> | null = null
let onOcrProgress: ((p: number) => void) | null = null
/** Worker'dagi joriy OCR profili — kerak bo'lgandagina almashtiriladi */
let workerProfile: OcrProfile | null = null

/** MRZ — mashina zonasi; VISUAL — hujjat yuzasidagi matn;
 *  DIGITS — faqat raqamlar (JSHSHIR va hujjat raqamini aniq o'qish uchun) */
type OcrProfile = "mrz" | "visual" | "digits"

async function applyProfile(worker: any, profile: OcrProfile) {
  if (workerProfile === profile) return
  const Tesseract = await import("tesseract.js")
  if (profile === "mrz") {
    // MRZ faqat shu belgilar to'plamidan iborat; PSM 6 — yaxlit matn bloki.
    // Lug'atlar o'chirilgan (MRZ so'z emas), invert-urinish ham o'chirilgan.
    await worker.setParameters({
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<",
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
      tessedit_do_invert: "0",
      load_system_dawg: "0",
      load_freq_dawg: "0",
      user_defined_dpi: "300",
      preserve_interword_spaces: "1",
    } as any)
  } else if (profile === "digits") {
    // FAQAT RAQAM (va hujjat raqami prefiksi uchun bosh harflar). Tor belgilar
    // to'plami OCR'ni raqamlarga "majburlaydi" — past sifatli suratlarda ham
    // JSHSHIR/seriya-raqam ancha aniq o'qiladi
    await worker.setParameters({
      tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ ",
      tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
      tessedit_do_invert: "0",
      load_system_dawg: "0",
      load_freq_dawg: "0",
      user_defined_dpi: "300",
      preserve_interword_spaces: "1",
    } as any)
  } else {
    // Vizual: yorliqlar va qiymatlar turli o'lchamda, sahifa bo'ylab tarqoq —
    // SPARSE_TEXT mos keladi; belgilar to'plami kengaytirilgan (sana ajratgichlari,
    // apostrof, tire), lug'at yoqilgan (ism-familiya so'z shaklida bo'ladi)
    await worker.setParameters({
      tessedit_char_whitelist:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,-/ '`",
      tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
      tessedit_do_invert: "0",
      load_system_dawg: "1",
      load_freq_dawg: "1",
      user_defined_dpi: "300",
      preserve_interword_spaces: "1",
    } as any)
  }
  workerProfile = profile
}

async function getSharedWorker(profile: OcrProfile = "mrz"): Promise<any> {
  if (!sharedWorker) {
    sharedWorker = (async () => {
      const Tesseract = await import("tesseract.js")
      const worker = await Tesseract.createWorker("eng", 1, {
        workerPath: "/ocr/worker.min.js",
        corePath: "/ocr",
        langPath: "/ocr",
        logger: (m: any) => {
          if (m.status === "recognizing text") {
            onOcrProgress?.(Math.round((m.progress || 0) * 100))
          }
        },
      })
      workerProfile = null
      return worker
    })().catch((e) => {
      // Yaratish xatosida keyingi urinish yangidan boshlaydi
      sharedWorker = null
      throw e
    })
  }
  const worker = await sharedWorker
  await applyProfile(worker, profile)
  return worker
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

  // Mehmonxona sozlamasidagi skaner rejimi (mrz / visual / auto)
  const { data: scanSettings } = useScanSettings()
  const scanMode: ScanMode = scanSettings?.mode ?? "auto"
  // Jonli sikl ichida joriy qiymat kerak — ref orqali uzatiladi
  const scanModeRef = useRef<ScanMode>(scanMode)
  useEffect(() => {
    scanModeRef.current = scanMode
  }, [scanMode])
  // Jonli skanda hozir qaysi usul ishlayotgani (foydalanuvchiga ko'rsatiladi)
  const [activeMethod, setActiveMethod] = useState<"mrz" | "visual">("mrz")

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
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
      // Imkon qadar yuqori aniqlik — MRZ belgilari qanchalik katta piksellarda
      // bo'lsa, OCR shunchalik tez va aniq o'qiydi (qurilma qo'llamasa
      // brauzer o'zi mavjed eng yaqin o'lchamga tushiradi)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 2560 },
          height: { ideal: 1440 },
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

  // profile — "mrz" (mashina zonasi) yoki "visual" (hujjat yuzasidagi yozuvlar)
  const getWorker = async (profile: OcrProfile = "mrz") => {
    const worker = await getSharedWorker(profile)
    setOcrReady(true)
    return worker
  }

  /* MRZ tahlili — ENDI BAHOLI: har nomzod nazorat raqamlari (check digit)
     bo'yicha baholanadi. "strong" (hujjat raqami + tug'ilgan sana nazorat
     raqamlari to'g'ri) natija darhol qabul qilinadi — bu ham tezlik, ham
     noto'g'ri o'qishdan himoya beradi. */
  const tryParseMrz = async (
    text: string
  ): Promise<{ doc: ScannedDoc; score: number; strong: boolean } | null> => {
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

    let best: { doc: ScannedDoc; score: number; strong: boolean } | null = null
    for (const cand of candidates) {
      try {
        // autocorrect — OCR'ning O↔0, I↔1 kabi tipik xatolarini tuzatadi
        const parsed = parse(cand, { autocorrect: true }) as any
        const f = parsed?.fields || {}
        if (!f.documentNumber || !f.lastName || !f.birthDate) continue

        // Nazorat raqamlari bo'yicha ishonch bahosi
        const details: any[] = parsed?.details || []
        const ok = (field: string) =>
          details.find((x) => x.field === field)?.valid === true
        const dnOk = ok("documentNumberCheckDigit")
        const bdOk = ok("birthDateCheckDigit")
        const exOk = ok("expirationDateCheckDigit")
        const cmpOk = ok("compositeCheckDigit")
        const score =
          (dnOk ? 4 : 0) +
          (bdOk ? 3 : 0) +
          (exOk ? 1 : 0) +
          (cmpOk ? 2 : 0) +
          (parsed?.valid ? 2 : 0)

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
        const item = { doc, score, strong: dnOk && bdOk }
        if (!best || item.score > best.score) best = item
      } catch {
        continue
      }
    }
    return best
  }

  /* VIZUAL o'qish — bitta manbadan (video kadri yoki rasm) bir necha
     variant sinaladi va natijalar BIRLASHTIRILADI:
       • butun hujjat maydoni (yorliq + qiymat juftliklari to'liq ko'rinadi);
       • matn zonasi (o'ng ~62%) — surat kesib tashlanadi, matn kattaroq
         piksellarda tushadi va OCR ancha aniq o'qiydi;
       • tasvirni tayyorlashning ikki usuli navbatlashadi (adaptiv/kulrang).
     Har variant natijasi ovoz beradi — bitta o'tishdagi OCR xatosi
     boshqasi bilan to'g'rilanadi. */
  const scanVisualFrom = async (
    source: HTMLVideoElement | HTMLCanvasElement,
    region: Region,
    t: DocType,
    attempt: number
  ): Promise<VisualParseResult | null> => {
    const worker = await getWorker("visual")
    const isVideo = source instanceof HTMLVideoElement
    // Videoda ramka ichidagi qism kesiladi; yuklangan rasmda butun tasvir
    const full = isVideo
      ? containerToSource(source.videoWidth, source.videoHeight, region)
      : { sx: 0, sy: 0, sw: source.width, sh: source.height }
    if (full.sw < 60 || full.sh < 40) return null

    // Matn zonasi: O'zbek ID kartasi va passportida surat CHAP tomonda,
    // yozuvlar o'ngda joylashadi
    const textZone = {
      sx: Math.round(full.sx + full.sw * 0.34),
      sy: full.sy,
      sw: Math.round(full.sw * 0.66),
      sh: full.sh,
    }

    // Kadrlar orasida usullar navbatlashadi — turli yorug'likda ishonchli
    const primary: PrepMode = attempt % 2 === 0 ? "adaptive" : "gray"
    const secondary: PrepMode = attempt % 2 === 0 ? "gray" : "adaptive"
    const passes: Array<{ crop: typeof full; mode: PrepMode; width: number }> = [
      { crop: textZone, mode: primary, width: 2200 },
      { crop: full, mode: primary, width: 2000 },
      { crop: textZone, mode: secondary, width: 2200 },
    ]

    const results: VisualParseResult[] = []
    for (const pass of passes) {
      if (pass.crop.sw < 40) continue
      const prepared = preprocessCrop(source, pass.crop, pass.mode, pass.width)
      // blocks: true — so'zlarning koordinatalari kerak (layout parser uchun)
      const { data } = await worker.recognize(prepared, {}, {
        text: true,
        blocks: true,
      } as any)
      // ASOSIY yo'l: koordinatalar bo'yicha (ikki ustunli tartibni to'g'ri
      // o'qiydi, yorliqni qiymat deb olmaydi). Bo'lmasa — matn bo'yicha zaxira
      const layout = parseVisualLayout(wordsFromResult(data), t)
      const parsed = layout ?? parseVisualDocument(data.text || "", t)
      if (parsed) results.push(parsed)
      // Bitta o'tishda kuchli natija chiqsa — qolganini kutmaymiz (tezlik)
      if (parsed && parsed.score >= 12) break
    }
    if (!results.length) return null
    const merged = mergeVisualResults(results)
    let best: VisualParseResult = merged
      ? {
          doc: merged.doc,
          score: merged.score + merged.agreement,
          fieldScores: results[0].fieldScores,
          numericRegions: results[0].numericRegions,
        }
      : results[0]

    /* RAQAMLI MAYDONLARNI QAYTA O'QISH.
       JSHSHIR va hujjat raqami — eng ko'p adashiladigan joy: OCR raqamlarni
       harf deb o'qiydi yoki guruhlab bo'ladi. Yorliq ostidagi kichik soha
       FAQAT RAQAM rejimida qayta o'qilsa, past sifatli suratda ham aniq
       chiqadi. Bu — professional skanerlardagi "targeted re-OCR" usuli. */
    const regions = results.find((r) => r.numericRegions)?.numericRegions
    if (regions && (!best.doc.personalNumber || !best.doc.documentNumber)) {
      const digitWorker = await getWorker("digits")
      // Sohalar tayyorlangan tasvir koordinatasida — asl manbaga qaytaramiz
      const basePass = passes[0]
      const scale = Math.min(Math.max(basePass.width / basePass.crop.sw, 0.25), 4)
      const toSource = (r: RegionBox) => ({
        sx: Math.round(basePass.crop.sx + r.x0 / scale),
        sy: Math.round(basePass.crop.sy + r.y0 / scale),
        sw: Math.max(20, Math.round((r.x1 - r.x0) / scale)),
        sh: Math.max(12, Math.round((r.y1 - r.y0) / scale)),
      })

      if (!best.doc.personalNumber && regions.personalNumber) {
        const crop = toSource(regions.personalNumber)
        // Kichik soha — juda katta kattalashtirish mumkin (aniqlik uchun)
        for (const mode of ["adaptive", "gray"] as PrepMode[]) {
          const prepared = preprocessCrop(source, crop, mode, 1400)
          const { data } = await digitWorker.recognize(prepared)
          const found = extractPinfl(data.text || "")
          if (found) {
            best.doc.personalNumber = found
            best.score += 4
            const bd = pinflBirthDate(found)
            if (bd && !best.doc.birthDate) best.doc.birthDate = bd
            break
          }
        }
      }
      if (!best.doc.documentNumber && regions.documentNumber) {
        const crop = toSource(regions.documentNumber)
        for (const mode of ["adaptive", "gray"] as PrepMode[]) {
          const prepared = preprocessCrop(source, crop, mode, 1400)
          const { data } = await digitWorker.recognize(prepared)
          const found = extractDocNumber(data.text || "")
          if (found) {
            best.doc.documentNumber = found
            best.score += 4
            break
          }
        }
      }
    }
    return best
  }

  // Video kadrida MRZ'ni izlash. Tezlik uchun odatda FAQAT MRZ zonasi
  // skanerlaniladi (kichik — tez); har 3-urinishda butun ramka ham tekshiriladi
  // (hujjat ramkaga noto'g'ri joylangan holatlar uchun). Preprocessing rejimi
  // urinishlar orasida navbatlashadi — turli yorug'likda ishonchli.
  const scanVideoFrame = async (
    video: HTMLVideoElement,
    attempt: number
  ): Promise<{ doc: ScannedDoc; score: number; strong: boolean } | null> => {
    const t = docTypeRef.current
    const mode: PrepMode = attempt % 2 === 0 ? "binary" : "gray"

    // --- VIZUAL rejim: hujjatning butun old tomonidagi yozuvlar o'qiladi ---
    // (auto rejimda MRZ bir necha urinishdan keyin topilmasa shu yo'lga o'tiladi)
    const useVisual =
      scanModeRef.current === "visual" ||
      (scanModeRef.current === "auto" && attempt >= AUTO_MRZ_ATTEMPTS)
    if (useVisual) {
      const item = await scanVisualFrom(video, frameRegion(t), t, attempt)
      if (!item) return null
      // Vizualda nazorat raqami yo'q — bir kadr ichida ikki mustaqil manba
      // (JSHSHIR + yorliqli maydonlar) mos kelsa "strong" hisoblanadi
      return { doc: item.doc, score: item.score, strong: item.score >= 11 }
    }

    // --- MRZ rejimi (avvalgidek) ---
    const worker = await getWorker("mrz")
    // To'liq ramka skani katta va sekin — faqat har 4-urinishda (hujjat
    // ramkaga noto'g'ri joylangan holatlar uchun zaxira yo'l)
    const regions = attempt % 4 === 3 ? [mrzRegion(t), frameRegion(t)] : [mrzRegion(t)]
    let best: { doc: ScannedDoc; score: number; strong: boolean } | null = null
    for (const region of regions) {
      const crop = containerToSource(video.videoWidth, video.videoHeight, region)
      if (crop.sw < 50 || crop.sh < 20) continue
      const prepared = preprocessCrop(video, crop, mode)
      const { data } = await worker.recognize(prepared)
      const item = await tryParseMrz(data.text || "")
      if (item) {
        if (item.strong) return item
        if (!best || item.score > best.score) best = item
      }
    }
    return best
  }

  // Yuklangan rasmda izlash: pastki qism va to'liq rasm, ikkala preprocessing
  // rejimida — eng yuqori baholi natija olinadi (strong bo'lsa darhol)
  const scanImageCanvas = async (canvas: HTMLCanvasElement): Promise<ScannedDoc | null> => {
    const full = { sx: 0, sy: 0, sw: canvas.width, sh: canvas.height }
    const mode = scanModeRef.current

    // MRZ urinishi (mrz va auto rejimlarida)
    if (mode !== "visual") {
      const worker = await getWorker("mrz")
      const crops = [
        {
          sx: 0,
          sy: Math.floor(canvas.height * 0.5),
          sw: canvas.width,
          sh: Math.ceil(canvas.height * 0.5),
        },
        full,
      ]
      let best: { doc: ScannedDoc; score: number } | null = null
      for (const crop of crops) {
        for (const prep of ["binary", "gray"] as PrepMode[]) {
          const prepared = preprocessCrop(canvas, crop, prep)
          const { data } = await worker.recognize(prepared)
          const item = await tryParseMrz(data.text || "")
          if (item) {
            if (item.strong) return item.doc
            if (!best || item.score > best.score) best = item
          }
        }
      }
      if (best) return best.doc
      // "mrz" rejimida vizualga o'tilmaydi — natija yo'q
      if (mode === "mrz") return null
    }

    // Vizual urinish (visual va auto rejimlarida) — ko'p o'tishli, ovoz berish
    // bilan; ikki xil tayyorlash usuli natijalari birlashtiriladi
    const results: VisualParseResult[] = []
    for (const attempt of [0, 1]) {
      const item = await scanVisualFrom(canvas, frameRegion(docTypeRef.current), docTypeRef.current, attempt)
      if (item) results.push(item)
      if (item && item.score >= 14) break
    }
    if (!results.length) return null
    const merged = mergeVisualResults(results)
    return merged?.doc ?? results[0].doc
  }

  const onFound = (doc: ScannedDoc) => {
    liveActiveRef.current = false
    stopCamera()
    setResult(doc)
    setPhase("result")
  }

  // JONLI skan sikli: kadrlar UZLUKSIZ tekshiriladi (OCR tugashi bilan
  // keyingisi boshlanadi). Qabul qilish qoidalari:
  //   1. strong (hujjat raqami + tug'ilgan sana nazorat raqamlari to'g'ri) — darhol;
  //   2. ikki kadrda bir xil raqam+sana o'qilsa (konsensus) — qabul;
  //   3. 8+ urinishdan keyin yetarli baholi eng yaxshi natija — qabul.
  const runLiveLoop = useCallback(async () => {
    if (liveActiveRef.current) return
    liveActiveRef.current = true
    let attempt = 0
    let bestSeen: { doc: ScannedDoc; score: number } | null = null
    let lastKey = ""
    // Vizual usulda KADRLAR BO'YICHA ovoz berish: har kadr natijasi
    // to'planadi, maydonlar eng ko'p takrorlangan qiymat bilan tasdiqlanadi
    const visualVotes: VisualParseResult[] = []
    try {
      // Rejimga mos profil bilan oldindan isitiladi (birinchi kadr tez bo'lsin)
      await getWorker(scanModeRef.current === "visual" ? "visual" : "mrz")
    } catch {
      liveActiveRef.current = false
      return
    }
    setActiveMethod(scanModeRef.current === "visual" ? "visual" : "mrz")
    while (liveActiveRef.current) {
      const video = videoRef.current
      if (video && video.videoWidth > 0 && !busyRef.current) {
        busyRef.current = true
        try {
          // Auto rejimda MRZ topilmasa vizual usulga o'tiladi — holat
          // ko'rsatkichi buni foydalanuvchiga bildiradi
          const method: "mrz" | "visual" =
            scanModeRef.current === "visual" ||
            (scanModeRef.current === "auto" && attempt >= AUTO_MRZ_ATTEMPTS)
              ? "visual"
              : "mrz"
          setActiveMethod(method)
          const item = await scanVideoFrame(video, attempt)
          attempt++
          setAttempts(attempt)
          if (item && liveActiveRef.current) {
            if (method === "visual") {
              /* VIZUAL: bitta kadrga ishonilmaydi — natijalar to'planib,
                 maydon bo'yicha ovoz beriladi. Ikki kadr bir xil qiymatni
                 bergan maydon tasdiqlangan hisoblanadi. */
              visualVotes.push({
                doc: item.doc,
                score: item.score,
                fieldScores: {},
              })
              const merged = mergeVisualResults(visualVotes)
              if (merged) {
                const enough =
                  // Ikki mustaqil kadr asosiy maydonlarda kelishdi
                  merged.agreement >= 2 ||
                  // Yoki bitta kadrda juda kuchli natija (JSHSHIR + ism + sana)
                  item.strong ||
                  // Yoki uzoq urinishdan keyin yig'ilgan eng yaxshi natija
                  (attempt >= 10 && merged.score >= 8)
                if (enough) {
                  busyRef.current = false
                  onFound(merged.doc)
                  return
                }
              }
            } else {
              // MRZ: nazorat raqamlari bor — avvalgi qoidalar o'zgarishsiz
              const key = [
                item.doc.documentNumber,
                item.doc.birthDate,
                item.doc.lastName,
                item.doc.firstName,
              ].join("|")
              const consensus =
                key === lastKey &&
                !!(item.doc.documentNumber || (item.doc.lastName && item.doc.birthDate))
              lastKey = key
              if (!bestSeen || item.score > bestSeen.score) {
                bestSeen = { doc: item.doc, score: item.score }
              }
              if (item.strong || consensus || (attempt >= 8 && bestSeen.score >= 5)) {
                busyRef.current = false
                onFound(item.strong || consensus ? item.doc : bestSeen.doc)
                return
              }
            }
          }
        } catch {
          // bitta kadr xatosi siklni to'xtatmaydi
        }
        busyRef.current = false
      }
      // OCR o'zi vaqt oladi — oradagi pauza minimal (UI nafas olishi uchun)
      await new Promise((r) => setTimeout(r, 50))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Progress xabarlari shu ochiq nusxaga bog'lanadi
  useEffect(() => {
    const cb = (p: number) => setProgress(p)
    onOcrProgress = cb
    return () => {
      if (onOcrProgress === cb) onOcrProgress = null
    }
  }, [])

  // Dialog ochilganda tur tanlashdan boshlaymiz va OCR OLDINDAN isitiladi
  // (foydalanuvchi hujjat turini tanlaguncha worker tayyor bo'lib ulguradi).
  // Yopilganda faqat kamera to'xtatiladi — worker issiq qoladi, keyingi
  // ochilishda kutish umuman bo'lmaydi.
  useEffect(() => {
    if (open) {
      setPhase("select")
      setResult(null)
      setErrorMsg(null)
      setAttempts(0)
      getWorker().catch(() => {})
    } else {
      stopCamera()
    }
    return () => {
      stopCamera()
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
        scanMode === "visual"
          ? "Yozuvlar o'qilmadi. Hujjat ramkaga to'liq sig'sin, yorug'lik tekis va yaltirashsiz bo'lsin."
          : docType === "ID_CARD"
            ? "Hujjat o'qilmadi. ID kartaning ORQA tomonidagi 3 qatorli zona ramkada ravshan ko'rinsin."
            : "Hujjat o'qilmadi. Passport pastidagi 2 qatorli zona ramkada ravshan ko'rinsin."
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
        scanMode === "visual"
          ? "Rasmdan ma'lumot o'qilmadi — hujjat yozuvlari to'liq va ravshan tushgan rasmni tanlang."
          : "Rasmda MRZ qatorlari topilmadi — hujjatning MRZ zonasi to'liq va ravshan tushgan rasmni tanlang."
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
                  {scanMode === "visual"
                    ? "Old tomondagi yozuvlar o'qiladi"
                    : "Orqa tomoni skanerlaniladi (3 qatorli MRZ)"}
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
                  {scanMode === "visual"
                    ? "Ma'lumotlar sahifasidagi yozuvlar o'qiladi"
                    : "Ma'lumotlar sahifasi skanerlaniladi (2 qatorli MRZ)"}
                </span>
              </button>
            </div>
            {/* Joriy rejim — sozlamalarda administrator tanlaydi */}
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              <b className="text-foreground">
                {scanMode === "mrz"
                  ? "MRZ rejimi"
                  : scanMode === "visual"
                    ? "Vizual rejim"
                    : "Avtomatik rejim"}
              </b>
              {" — "}
              {scanMode === "mrz"
                ? "hujjatning mashina o'qiydigan (MRZ) zonasi o'qiladi: eng tez va aniq."
                : scanMode === "visual"
                  ? "hujjat yuzasidagi yozuvlar o'qiladi (MRZ yo'q yoki o'chgan hujjatlar uchun)."
                  : "avval MRZ, topilmasa hujjat yuzasidagi yozuvlar o'qiladi."}
              {" Rejimni sozlamalardan o'zgartirish mumkin."}
            </p>
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
              {/* MRZ zonasi — faqat MRZ o'qilayotganda ko'rsatiladi
                  (vizual usulda butun ramka o'qiladi) */}
              {activeMethod === "mrz" && (
                <div
                  className="pointer-events-none absolute rounded-md border-2 border-dashed border-amber-300/90"
                  style={{
                    left: `${mrz.left * 100}%`,
                    right: `${(1 - mrz.right) * 100}%`,
                    top: `${mrz.top * 100}%`,
                    bottom: `${(1 - mrz.bottom) * 100}%`,
                  }}
                />
              )}
              {/* Jonli holat indikatori — qaysi usul ishlayotgani bilan */}
              <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white">
                {ocrReady ? (
                  <>
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                    {activeMethod === "visual" ? "Yozuvlar" : "MRZ"} o'qilmoqda
                    {attempts > 0 ? ` · ${attempts}` : ""}...
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
                {activeMethod === "visual"
                  ? docType === "ID_CARD"
                    ? "ID kartaning yozuvli tomonini ramkaga joylang"
                    : "Passportning ma'lumotlar sahifasini ramkaga joylang"
                  : DOC_SPECS[docType].hint}
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
              {activeMethod === "visual"
                ? "Hujjatni ramkaga to'liq joylab, bir necha soniya qimirlatmay turing — yozuvlar avtomatik o'qiladi. Yorug'lik tekis bo'lsa aniqlik yuqori bo'ladi."
                : "Hujjatni ramkaga to'liq joylab, bir necha soniya qimirlatmay turing — sariq punktir zonadagi MRZ qatorlari avtomatik o'qiladi."}
              {" Ma'lumotlar faqat shu qurilmada qayta ishlanadi, hech qayerga yuborilmaydi."}
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
