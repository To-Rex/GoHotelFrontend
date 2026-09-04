import { useCallback, useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookUser,
  Camera,
  CheckCircle2,
  CreditCard,
  Flashlight,
  ImageUp,
  Loader2,
  RefreshCw,
  ScanLine,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { apiErrorMessage } from "@/lib/apiError"
import { useScanSettings, type ScanMode } from "../api/scanSettings"
import { JPEG_QUALITY, ServerScanUnavailable, scanDocumentOnServer } from "../api/documentScan"
import {
  extractDocNumber,
  extractPinfl,
  FieldAccumulator,
  parseVisualDocument,
  parseVisualLayout,
  type VisualParseResult,
  type WordBox,
} from "./visualDocParser"
import {
  assessImageQuality,
  cropCanvas,
  decodeIdCardQr,
  orientationCandidates,
  probeVideoFrame,
  rectifyDocument,
  videoFrameCanvas,
  type FrameProbe,
  type ImageQuality,
} from "./documentVision"
import {
  isLikelyUzbekPinfl,
  mergeScannedDocs,
  type DocumentSide,
  type DocumentType,
  type DocumentCheck,
  type RecognitionResult,
  type ScannedDoc,
  type ScannedField,
} from "./documentScannerTypes"
import { parseMrzText } from "./mrzParser"
import { DocumentCaptureGuide } from "./DocumentCaptureGuide"

export type { ScannedDoc } from "./documentScannerTypes"

interface DocumentScannerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onResult: (doc: ScannedDoc) => void
}

type OcrProfile =
  | "mrz"
  | "mrzLatin"
  | "digitsLatin"
  | "digitsCyrillic"
  | "visualFast"
  | "visualLatin"
  | "visualCyrillic"
type PrepMode = "binary" | "gray" | "adaptive"

const DOC_SPECS: Record<DocumentType, { aspect: number; widthFrac: number; mrzFrac: number }> = {
  ID_CARD: { aspect: 85.6 / 54, widthFrac: 0.88, mrzFrac: 0.46 },
  PASSPORT: { aspect: 125 / 88, widthFrac: 0.86, mrzFrac: 0.38 },
}

/**
 * Qurilmadagi zaxira OCR uchun kesim kengliklari. Kadr allaqachon qo'lda
 * olingan va to'g'rilangan, shuning uchun bu yerda qayta masshtablash yo'q.
 */
const FAST_TEXT_WIDTH = 1280
const FAST_MRZ_WIDTH = 1500

// Every Latin profile shares one language group on purpose.  Tesseract runs its
// LSTM once per loaded language, so adding "uzb" to a live-camera pass doubled
// its cost without adding characters: MRZ, card numbers and the Uzbek Latin
// alphabet are all ASCII.  "uzb" is kept only for the slower recovery pass,
// where its dictionary genuinely helps ambiguous words.
const OCR_LANGUAGES: Record<OcrProfile, string> = {
  mrz: "eng",
  mrzLatin: "eng",
  digitsLatin: "eng",
  digitsCyrillic: "rus+uzb_cyrl",
  visualFast: "eng",
  visualLatin: "eng+uzb",
  visualCyrillic: "rus+uzb_cyrl",
}

interface PooledWorker {
  worker: any
  profile: OcrProfile | null
}

interface WorkerSlot {
  pooled: Promise<PooledWorker>
  usedAt: number
}

/**
 * One worker per language group, instead of one worker that reinitializes.
 * Switching an ID card between its front (text) and back (MRZ) used to reload
 * a language model mid-scan, which cost seconds; a pool makes that switch free
 * and lets the scanner warm the common English model the moment it opens.
 */
const workerPool = new Map<string, WorkerSlot>()
const MAX_POOLED_WORKERS = 3
let ocrProgressListener: ((progress: number) => void) | null = null
let workerQueue: Promise<void> = Promise.resolve()

function queueWorker<T>(job: () => Promise<T>): Promise<T> {
  const next = workerQueue.then(job, job)
  workerQueue = next.then(
    () => undefined,
    () => undefined
  )
  return next
}

/** Frees the least recently used model once the pool exceeds its cap. */
function evictWorkers(keep: string) {
  while (workerPool.size > MAX_POOLED_WORKERS) {
    let victimKey: string | null = null
    let victimUsedAt = Number.POSITIVE_INFINITY
    for (const [languages, slot] of workerPool) {
      if (languages === keep) continue
      if (slot.usedAt < victimUsedAt) {
        victimUsedAt = slot.usedAt
        victimKey = languages
      }
    }
    if (!victimKey) return
    const victim = workerPool.get(victimKey)!
    workerPool.delete(victimKey)
    // All OCR runs through a single queue, so no evicted worker is mid-job.
    void victim.pooled.then((entry) => entry.worker.terminate?.()).catch(() => undefined)
  }
}

async function applyOcrProfile(entry: PooledWorker, profile: OcrProfile) {
  if (entry.profile === profile) return
  const worker = entry.worker
  const Tesseract = await import("tesseract.js")
  if (profile === "mrz" || profile === "mrzLatin") {
    await worker.setParameters({
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<",
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
      tessedit_do_invert: "0",
      load_system_dawg: "0",
      load_freq_dawg: "0",
      user_defined_dpi: "300",
      preserve_interword_spaces: "1",
    } as any)
  } else if (profile === "digitsLatin" || profile === "digitsCyrillic") {
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
    // Never use an ASCII whitelist here: it silently removes Uzbek Cyrillic
    // and Russian characters even if their traineddata is loaded.
    await worker.setParameters({
      tessedit_char_whitelist: "",
      tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
      tessedit_do_invert: "0",
      user_defined_dpi: "300",
      preserve_interword_spaces: "1",
    } as any)
  }
  entry.profile = profile
}

async function getWorker(profile: OcrProfile): Promise<any> {
  const languages = OCR_LANGUAGES[profile]
  let slot = workerPool.get(languages)
  if (!slot) {
    const pooled = (async (): Promise<PooledWorker> => {
      const Tesseract = await import("tesseract.js")
      const worker = await Tesseract.createWorker(languages, 1, {
        workerPath: "/ocr/worker.min.js",
        corePath: "/ocr",
        langPath: "/ocr",
        logger: (message: any) => {
          if (message?.status === "recognizing text") {
            ocrProgressListener?.(Math.round((message.progress || 0) * 100))
          }
        },
        errorHandler: () => ocrProgressListener?.(-1),
      })
      return { worker, profile: null }
    })()
    pooled.catch(() => {
      if (workerPool.get(languages)?.pooled === pooled) workerPool.delete(languages)
    })
    slot = { pooled, usedAt: Date.now() }
    workerPool.set(languages, slot)
    evictWorkers(languages)
  }
  slot.usedAt = Date.now()
  const entry = await slot.pooled
  await applyOcrProfile(entry, profile)
  return entry.worker
}

async function recognize(
  profile: OcrProfile,
  canvas: HTMLCanvasElement,
  blocks = false,
  rotateAuto = false
): Promise<any> {
  return queueWorker(async () => {
    const worker = await getWorker(profile)
    const { data } = await worker.recognize(
      canvas,
      // The live camera guide keeps documents landscape.  Skipping automatic
      // orientation detection on that fast path removes an expensive extra
      // OCR operation; uploaded MRZ images are explicitly rotated below.
      rotateAuto ? { rotateAuto: true } : {},
      blocks ? ({ text: true, blocks: true } as any) : ({ text: true } as any)
    )
    return data
  })
}

function wordsFromResult(data: any): WordBox[] {
  const words: WordBox[] = []
  for (const block of data?.blocks ?? []) {
    for (const paragraph of block?.paragraphs ?? []) {
      for (const line of paragraph?.lines ?? []) {
        for (const word of line?.words ?? []) {
          const bbox = word?.bbox
          if (!bbox || !word.text) continue
          words.push({
            text: word.text,
            x0: bbox.x0,
            y0: bbox.y0,
            x1: bbox.x1,
            y1: bbox.y1,
            conf: word.confidence ?? 0,
          })
        }
      }
    }
  }
  return words
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  return canvas
}

function otsuThreshold(histogram: Uint32Array, total: number) {
  let sum = 0
  for (let value = 0; value < 256; value++) sum += value * histogram[value]
  let sumBackground = 0
  let backgroundWeight = 0
  let best = 0
  let threshold = 127
  for (let value = 0; value < 256; value++) {
    backgroundWeight += histogram[value]
    if (!backgroundWeight) continue
    const foregroundWeight = total - backgroundWeight
    if (!foregroundWeight) break
    sumBackground += value * histogram[value]
    const backgroundMean = sumBackground / backgroundWeight
    const foregroundMean = (sum - sumBackground) / foregroundWeight
    const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2
    if (variance > best) {
      best = variance
      threshold = value
    }
  }
  return threshold
}

/**
 * Scratch buffers for OCR preprocessing.  A 1300px card frame needs several
 * megabytes of intermediate arrays; allocating them per camera frame made the
 * garbage collector, not the OCR, the limiting factor of the live scanner.
 * Every buffer is consumed synchronously inside prepareForOcr, so a single
 * shared set is safe.
 */
const scratch: {
  gray: Uint8ClampedArray | null
  stretched: Uint8ClampedArray | null
  sharpened: Uint8ClampedArray | null
  integral: Uint32Array | null
} = { gray: null, stretched: null, sharpened: null, integral: null }

function scratchBytes(key: "gray" | "stretched" | "sharpened", size: number) {
  const existing = scratch[key]
  if (existing && existing.length >= size) return existing
  const created = new Uint8ClampedArray(size)
  scratch[key] = created
  return created
}

/**
 * Contrast stretch + safe edge enhancement + adaptive/global binarisation.
 * This can recover medium low-contrast text but never fabricates characters;
 * heavily blurred frames are still rejected by the camera quality gate.
 */
function prepareForOcr(source: HTMLCanvasElement, mode: PrepMode, targetWidth: number, sharpenEdges = false) {
  const scale = Math.min(Math.max(targetWidth / source.width, 0.3), 3.2)
  const canvas = createCanvas(source.width * scale, source.height * scale)
  const context = canvas.getContext("2d", { willReadFrequently: true })!
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = "high"
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  const image = context.getImageData(0, 0, canvas.width, canvas.height)
  const pixels = image.data
  const total = canvas.width * canvas.height
  const gray = scratchBytes("gray", total)
  const histogram = new Uint32Array(256)
  for (let index = 0, pixel = 0; index < pixels.length; index += 4, pixel++) {
    const value = Math.round((pixels[index] * 299 + pixels[index + 1] * 587 + pixels[index + 2] * 114) / 1000)
    gray[pixel] = value
    histogram[value]++
  }
  let low = 0
  let high = 255
  let running = 0
  for (let value = 0; value < 256; value++) {
    running += histogram[value]
    if (running >= total * 0.015) {
      low = value
      break
    }
  }
  running = 0
  for (let value = 255; value >= 0; value--) {
    running += histogram[value]
    if (running >= total * 0.015) {
      high = value
      break
    }
  }
  const range = Math.max(1, high - low)
  const stretched = scratchBytes("stretched", total)
  for (let index = 0; index < total; index++) {
    const value = Math.max(0, Math.min(255, Math.round(((gray[index] - low) * 255) / range)))
    stretched[index] = value
  }

  let enhanced = stretched
  if (sharpenEdges && canvas.width > 2 && canvas.height > 2) {
    const sharpened = scratchBytes("sharpened", total)
    sharpened.set(stretched.subarray(0, total))
    const amount = 0.58
    for (let y = 1; y < canvas.height - 1; y++) {
      for (let x = 1; x < canvas.width - 1; x++) {
        const index = y * canvas.width + x
        const localBlur =
          (stretched[index - 1] + stretched[index + 1] + stretched[index - canvas.width] + stretched[index + canvas.width]) / 4
        sharpened[index] = Math.max(0, Math.min(255, Math.round(stretched[index] + (stretched[index] - localBlur) * amount)))
      }
    }
    enhanced = sharpened
  }

  const enhancedHistogram = new Uint32Array(256)
  for (let index = 0; index < total; index++) enhancedHistogram[enhanced[index]]++

  if (mode === "gray") {
    for (let index = 0, pixel = 0; index < pixels.length; index += 4, pixel++) {
      pixels[index] = pixels[index + 1] = pixels[index + 2] = enhanced[pixel]
    }
  } else if (mode === "adaptive") {
    const width = canvas.width
    const height = canvas.height
    // Integer sums stay exact here (total * 255 stays far below 2^32) while
    // halving the memory a Float64 integral image needed.
    const cells = (width + 1) * (height + 1)
    let integral = scratch.integral
    if (!integral || integral.length < cells) {
      integral = new Uint32Array(cells)
      scratch.integral = integral
    }
    // Only the zero row and column are read without being written below, so a
    // reused buffer needs its border cleared rather than a full-array fill.
    for (let x = 0; x <= width; x++) integral[x] = 0
    for (let y = 0; y <= height; y++) integral[y * (width + 1)] = 0
    for (let y = 0; y < height; y++) {
      let row = 0
      for (let x = 0; x < width; x++) {
        row += enhanced[y * width + x]
        integral[(y + 1) * (width + 1) + x + 1] = integral[y * (width + 1) + x + 1] + row
      }
    }
    const radius = Math.max(8, Math.round(width / 34))
    for (let y = 0; y < height; y++) {
      const y0 = Math.max(0, y - radius)
      const y1 = Math.min(height - 1, y + radius)
      for (let x = 0; x < width; x++) {
        const x0 = Math.max(0, x - radius)
        const x1 = Math.min(width - 1, x + radius)
        const sum =
          integral[(y1 + 1) * (width + 1) + x1 + 1] -
          integral[y0 * (width + 1) + x1 + 1] -
          integral[(y1 + 1) * (width + 1) + x0] +
          integral[y0 * (width + 1) + x0]
        const average = sum / ((x1 - x0 + 1) * (y1 - y0 + 1))
        const value = enhanced[y * width + x] < average * 0.86 ? 0 : 255
        const index = (y * width + x) * 4
        pixels[index] = pixels[index + 1] = pixels[index + 2] = value
      }
    }
  } else {
    const threshold = otsuThreshold(enhancedHistogram, total)
    for (let index = 0, pixel = 0; index < pixels.length; index += 4, pixel++) {
      const value = enhanced[pixel] < threshold ? 0 : 255
      pixels[index] = pixels[index + 1] = pixels[index + 2] = value
    }
  }
  context.putImageData(image, 0, 0)
  return canvas
}

function mergeVisualPasses(
  layout: VisualParseResult | null,
  text: VisualParseResult | null,
  accumulator: FieldAccumulator,
  frameId: string
) {
  // A detected label region is not a complete parse. Add both parsers so a
  // partial layout result can never discard valid text-parser fields.
  accumulator.add(layout, frameId)
  accumulator.add(text, frameId)
}

function visualResultFromAccumulator(
  accumulator: FieldAccumulator,
  type: DocumentType,
  pinflContext: boolean,
  side: DocumentSide
): RecognitionResult | null {
  if (!accumulator.filledCount) return null
  const doc: ScannedDoc = {
    ...accumulator.doc,
    documentType: type,
    source: "visual",
    verified: false,
    requiresReview: true,
    scannedSides: [side],
    warnings: ["Vizual OCR natijasi — formaga qo‘llashdan oldin tekshiring"],
    fieldConfidence: {},
  }
  if (doc.personalNumber && pinflContext && type === "ID_CARD" && isLikelyUzbekPinfl(doc.personalNumber)) {
    doc.pinflVerified = true
  } else {
    delete doc.personalNumber
  }
  const fields: ScannedField[] = [
    "firstName",
    "lastName",
    "birthDate",
    "documentNumber",
    "personalNumber",
    "nationality",
  ]
  for (const field of fields) {
    if (typeof doc[field] === "string") {
      doc.fieldConfidence![field] = Math.min(0.82, 0.42 + accumulator.sourceCount(field) * 0.16)
    }
  }
  return {
    doc,
    score: accumulator.filledCount * 12 + accumulator.agreedCount * 4,
    verified: false,
    requiresReview: true,
    source: "visual",
  }
}

async function scanVisualDocument(
  canvas: HTMLCanvasElement,
  type: DocumentType,
  side: DocumentSide,
  frameId: string,
  fastLive = false
): Promise<RecognitionResult | null> {
  const accumulator = new FieldAccumulator(type)
  let pinflContext = false
  const textZone = cropCanvas(canvas, canvas.width * 0.18, 0, canvas.width * 0.82, canvas.height)
  const fullPasses: Array<{ canvas: HTMLCanvasElement; mode: PrepMode; width: number }> = [
    { canvas, mode: "adaptive", width: 1900 },
    { canvas: textZone, mode: "gray", width: 2000 },
  ]
  // This is intentionally narrow: a well-aligned live card gets one OCR pass
  // first.  It stays in grayscale because Tesseract binarises internally, and
  // the adaptive threshold — an integral image over two megapixels — was by far
  // the most expensive step of a live frame.  No field is auto-applied from
  // this pass; independent camera-frame consensus is still required, and a
  // failed fast pass falls back to the full multi-language routine on retry.
  const fastPasses: Array<{ canvas: HTMLCanvasElement; mode: PrepMode; width: number }> = [
    { canvas: textZone, mode: "gray", width: FAST_TEXT_WIDTH },
  ]

  const readProfile = async (
    profile: "visualFast" | "visualLatin" | "visualCyrillic",
    digitsProfile: "digitsLatin" | "digitsCyrillic",
    passes: Array<{ canvas: HTMLCanvasElement; mode: PrepMode; width: number }>,
    includeNumericPass: boolean
  ) => {
    for (const pass of passes) {
      const prepared = prepareForOcr(pass.canvas, pass.mode, pass.width)
      const data = await recognize(profile, prepared, true, !fastLive)
      const text = data.text || ""
      const layout = parseVisualLayout(wordsFromResult(data), type)
      const parsedText = parseVisualDocument(text, type)
      mergeVisualPasses(layout, parsedText, accumulator, frameId)
      if (/\b(JSHSHIR|JSHIR|PINFL|ЖШШИР|ПИНФЛ)\b/i.test(text)) pinflContext = true
      const pinfl = extractPinfl(text)
      if (pinfl && pinflContext) accumulator.addField("personalNumber", pinfl, 4, frameId)
      const documentNumber = extractDocNumber(text)
      if (documentNumber) accumulator.addField("documentNumber", documentNumber, 3, frameId)
    }

    // A numeric-only pass is kept separate from positional layout coordinates,
    // avoiding the old bug where a region from one crop was applied to another.
    // It keeps the active language group, so it does not reinitialize the OCR
    // worker between each live-camera frame.
    if (includeNumericPass) {
      const numericCrop = cropCanvas(canvas, 0, canvas.height * 0.38, canvas.width, canvas.height * 0.62)
      const numericData = await recognize(digitsProfile, prepareForOcr(numericCrop, "adaptive", 1700, true))
      const numericText = numericData.text || ""
      const pinfl = extractPinfl(numericText)
      if (pinfl && pinflContext) accumulator.addField("personalNumber", pinfl, 4, frameId)
      const documentNumber = extractDocNumber(numericText)
      if (documentNumber) accumulator.addField("documentNumber", documentNumber, 3, frameId)
    }
  }

  // Uzbekistan's current cards predominantly have Latin labels.  Only switch
  // to the Cyrillic model if the fast local-language pass did not obtain the
  // minimum useful fields; that avoids an expensive language reload on every
  // ordinary card.
  if (fastLive) {
    await readProfile("visualFast", "digitsLatin", fastPasses, false)
  } else {
    await readProfile("visualLatin", "digitsLatin", fullPasses, true)
    if (!accumulator.isComplete()) {
      await readProfile("visualCyrillic", "digitsCyrillic", fullPasses, true)
    }
  }

  return visualResultFromAccumulator(accumulator, type, pinflContext, side)
}

function mrzCrops(canvas: HTMLCanvasElement, type: DocumentType) {
  // After perspective correction, both the Uzbekistan biometric passport
  // (TD3) and ID-card back (TD1) place their MRZ in the lower quarter.  Tight
  // overlapping zones prevent surrounding labels and portraits from being
  // mistaken for MRZ characters while retaining a safe fallback crop.
  const starts = type === "PASSPORT" ? [0.72, 0.66] : [0.71, 0.64]
  return starts.map((top) => cropCanvas(canvas, canvas.width * 0.015, canvas.height * top, canvas.width * 0.97, canvas.height * (0.985 - top)))
}

async function scanMrzDocument(
  canvas: HTMLCanvasElement,
  type: DocumentType,
  includePortraitOrientations: boolean,
  fastLive = false
): Promise<RecognitionResult | null> {
  let best: RecognitionResult | null = null
  // Do not clone the upright canvas.  The full recovery path creates only
  // additional rotations after the original orientation has failed.
  const orientations = fastLive
    ? [{ angle: 0 as const, canvas }]
    : [
        { angle: 0 as const, canvas },
        ...orientationCandidates(canvas, includePortraitOrientations).filter((candidate) => candidate.angle !== 0),
      ]
  const profile: OcrProfile = type === "ID_CARD" ? "mrzLatin" : "mrz"
  for (const oriented of orientations) {
    const crops = fastLive ? mrzCrops(oriented.canvas, type).slice(0, 1) : mrzCrops(oriented.canvas, type)
    // A guided, crisp live frame almost always resolves with its primary
    // binary MRZ crop.  Keep gray/overlap/orientation recovery for the full
    // path after two quick frames miss, rather than serializing four OCR jobs
    // per live frame.
    const modes = (fastLive ? ["binary"] : ["binary", "gray"]) as PrepMode[]
    for (const crop of crops) {
      for (const mode of modes) {
        const data = await recognize(
          profile,
          prepareForOcr(crop, mode, fastLive ? FAST_MRZ_WIDTH : 1900, !fastLive)
        )
        const result = parseMrzText(data.text || "", type)
        if (!result) continue
        if (result.verified) return result
        if (!best || result.score > best.score) best = result
      }
    }
  }
  return best
}

interface ScanOutcome {
  recognition: RecognitionResult | null
  quality: ImageQuality
  rectified: boolean
  qrConfirmed: boolean
}

function qrCorroboratesDocument(payload: string | undefined, doc: ScannedDoc | undefined) {
  if (!payload || !doc) return false
  const compactPayload = payload.toUpperCase().replace(/[^A-Z0-9]/g, "")
  const evidence = [doc.documentNumber, doc.personalNumber]
    .filter((value): value is string => Boolean(value && value.length >= 7))
    .map((value) => value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
  return evidence.some((value) => compactPayload.includes(value))
}

async function recognizeDocument(
  source: HTMLCanvasElement,
  type: DocumentType,
  side: DocumentSide,
  mode: ScanMode,
  includePortraitOrientations: boolean,
  fastLive = false,
  measuredQuality?: ImageQuality
): Promise<ScanOutcome> {
  const targetQuality = (canvas: HTMLCanvasElement, imageQuality?: ImageQuality) => {
    const focusCrop =
      side === "front"
        ? cropCanvas(canvas, canvas.width * 0.18, 0, canvas.width * 0.82, canvas.height)
        : mrzCrops(canvas, type)[0]
    const focusQuality = assessImageQuality(focusCrop)
    return focusQuality.usable ? imageQuality ?? assessImageQuality(canvas) : focusQuality
  }

  if (fastLive) {
    // The live loop already measured this frame.  Re-deriving whole-frame
    // quality here only repeated work; the zone-specific check below is the
    // part that actually guards MRZ and text sharpness, so it is kept.
    const quality = targetQuality(source, measuredQuality)
    // Most live captures are already inside the on-screen card guide, so a
    // single landscape MRZ/text pass runs before OpenCV, QR and recovery OCR.
    // A missed or crooked document falls through to the full path later.
    if (!quality.usable) return { recognition: null, quality, rectified: false, qrConfirmed: false }
    if (side !== "front" && mode !== "visual") {
      const mrz = await scanMrzDocument(source, type, false, true)
      if (mrz?.verified) return { recognition: mrz, quality, rectified: false, qrConfirmed: false }
      // An MRZ that will not verify used to return nothing frame after frame,
      // leaving a passport with a worn or shadowed code stuck until the
      // fallback timer.  In automatic mode the printed page is read instead —
      // an unverified MRZ costs the same wait either way.
      if (mode === "mrz") return { recognition: null, quality, rectified: false, qrConfirmed: false }
    }
    const visual = await scanVisualDocument(source, type, side, `fast-${Date.now()}`, true)
    return { recognition: visual, quality, rectified: false, qrConfirmed: false }
  }

  const normalized = await rectifyDocument(source, type)
  // The target zone must itself be sharp.  A crisp table/background cannot
  // make a blurry MRZ or ID field safe to auto-fill.
  const quality = targetQuality(normalized.canvas, normalized.quality)
  let mrz: RecognitionResult | null = null
  let visual: RecognitionResult | null = null

  if (side !== "front" && mode !== "visual") {
    mrz = await scanMrzDocument(normalized.canvas, type, includePortraitOrientations)
    if (mrz?.verified || mode === "mrz") {
      // QR is supplementary evidence, never a source of booking data.  Do it
      // only after a usable MRZ exists so failed camera frames do not spend
      // time decoding a QR code.
      const qrPayload =
        mrz && type === "ID_CARD" && side === "back" ? await decodeIdCardQr(normalized.canvas) : undefined
      const qrConfirmed = qrCorroboratesDocument(qrPayload, mrz?.doc)
      if (mrz && qrConfirmed) mrz.doc.qrConfirmed = true
      if (mrz && !quality.usable) {
        mrz.doc.warnings = [...(mrz.doc.warnings ?? []), "MRZ zonasi yetarlicha tiniq emas — qayta oling yoki tekshirib tasdiqlang"]
        mrz.doc.requiresReview = true
      }
      return { recognition: mrz, quality, rectified: normalized.rectified, qrConfirmed }
    }
  }
  if (side === "front" || mode !== "mrz") {
    visual = await scanVisualDocument(normalized.canvas, type, side, `single-${Date.now()}`)
  }
  const recognition = visual && (!mrz || visual.score >= mrz.score || !mrz.doc.documentNumber) ? visual : mrz
  const qrPayload =
    recognition?.source === "mrz" && type === "ID_CARD" && side === "back"
      ? await decodeIdCardQr(normalized.canvas)
      : undefined
  const qrConfirmed = qrCorroboratesDocument(qrPayload, recognition?.doc)
  if (recognition && qrConfirmed) recognition.doc.qrConfirmed = true
  if (recognition && !quality.usable) {
    recognition.doc.warnings = [
      ...(recognition.doc.warnings ?? []),
      "Rasm sifati past bo‘lgani uchun natijani albatta tekshiring",
    ]
    recognition.doc.requiresReview = true
  }
  return { recognition, quality, rectified: normalized.rectified, qrConfirmed }
}

function frameRegion(type: DocumentType) {
  const spec = DOC_SPECS[type]
  const containerAspect = 4 / 3
  const width = spec.widthFrac
  const height = Math.min(0.94, (spec.widthFrac * containerAspect) / spec.aspect)
  const left = (1 - width) / 2
  const top = (1 - height) / 2
  return { left, right: left + width, top, bottom: top + height }
}


/* ==========================================================================
   Skaner komponenti

   Oqim ataylab qo'lda boshqariladi: xodim hujjatni ramkaga joylaydi va O'ZI
   suratga oladi. Avtomatik zatvor bilan taqqoslaganda bu sekinroq emas —
   aksincha, xodim qachon tayyor ekanini kameradan yaxshiroq biladi va kadr
   bir marta olinadi, o'nlab marta emas.

   ID karta uchun ikkala tomon olinadi va BITTA so'rovda yuboriladi: server
   faqat shundagina old tomondagi bosma ma'lumotni orqa tomondagi MRZ bilan
   solishtira oladi va ikkala tomon bitta hujjatga tegishli ekanini
   tekshira oladi. Passport uchun bitta sahifa yetarli.
   ========================================================================== */

type Phase = "select" | "capture" | "sending" | "result" | "error"

interface Shot {
  canvas: HTMLCanvasElement
  /** Yuborishga tayyor JPEG. Kadr bir marta kodlanadi: ko'rinish ham, yuklash
   *  ham shu bitta blobdan foydalanadi, shuning uchun "Yuborish" bosilganda
   *  kutish qolmaydi. */
  blob: Blob
  url: string
}

/** Hujjat turi -> qaysi tomonlar olinadi */
const DOC_SIDES: Record<DocumentType, DocumentSide[]> = {
  ID_CARD: ["front", "back"],
  PASSPORT: ["passport"],
}

/**
 * MRZ rejimida ID kartaning FAQAT ORQA tomoni olinadi: MRZ o'sha yerda,
 * old tomon esa bu rejimda umuman o'qilmaydi — uni suratga oldirish
 * bekorchi qadam edi. Passport uchun farqi yo'q (MRZ bosh sahifada).
 */
const activeSides = (type: DocumentType, mode: ScanMode): DocumentSide[] =>
  type === "ID_CARD" && mode === "mrz" ? ["back"] : DOC_SIDES[type]

/**
 * Yuboriladigan kadr kengligi. Ramkani to'ldirgan karta bu yerda millimetriga
 * ~17 pikselni beradi — tanish modeli uchun kerakligidan ko'ra ko'proq, lekin
 * kattaroq kadr aniqlik qo'shmay, kodlash va yuklashni sekinlashtiradi.
 */
const CAPTURE_WIDTH = 1500

const SIDE_TITLES: Record<DocumentSide, string> = {
  front: "ID kartaning old tomoni",
  back: "ID kartaning orqa tomoni",
  passport: "Passportning ma’lumotlar sahifasi",
}

const SIDE_HINTS: Record<DocumentSide, string> = {
  front: "Surat va yozuvlar turgan tomonni ramkaga to‘liq joylang",
  back: "Pastda ikki-uch qator mayda belgilar (MRZ) turgan tomonni oling",
  passport: "Surat va MRZ qatorlari bitta kadrga to‘liq tushsin",
}

const CHECK_STYLES = {
  ok: { icon: CheckCircle2, className: "text-emerald-600", row: "bg-emerald-50/60" },
  warn: { icon: AlertTriangle, className: "text-amber-600", row: "bg-amber-50/60" },
  fail: { icon: AlertCircle, className: "text-red-600", row: "bg-red-50/70" },
} as const

export function DocumentScanner({ open, onOpenChange, onResult }: DocumentScannerProps) {
  const [phase, setPhase] = useState<Phase>("select")
  const [docType, setDocType] = useState<DocumentType>("ID_CARD")
  const [stepIndex, setStepIndex] = useState(0)
  const [shots, setShots] = useState<Partial<Record<DocumentSide, Shot>>>({})
  const [result, setResult] = useState<ScannedDoc | null>(null)
  const [quality, setQuality] = useState<ImageQuality | null>(null)
  const [docDetected, setDocDetected] = useState(false)
  /** MRZ rejimida: kadrda MRZ qatorlari haqiqatan ko'rinyaptimi */
  const [mrzSeen, setMrzSeen] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [serverFellBack, setServerFellBack] = useState(false)
  const [progress, setProgress] = useState(0)

  const { data: scanSettings } = useScanSettings()
  const scanMode: ScanMode = scanSettings?.mode ?? "auto"
  const serverPreferred = scanSettings?.engine !== "device" && Boolean(scanSettings?.serverAvailable)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const guideActiveRef = useRef(false)
  const captureRef = useRef<() => void>(() => {})
  //: MRZ rejimi to'liq avtomatik: kadr olingach yuborish ham o'zi bo'ladi
  const autoSubmitRef = useRef(false)
  const scanAbortRef = useRef<AbortController | null>(null)
  const serverDownRef = useRef(false)
  const shotsRef = useRef<Partial<Record<DocumentSide, Shot>>>({})
  const docTypeRef = useRef<DocumentType>(docType)
  const scanModeRef = useRef<ScanMode>(scanMode)

  const sides = activeSides(docType, scanMode)
  const currentSide = sides[Math.min(stepIndex, sides.length - 1)]
  const currentShot = shots[currentSide]
  const allCaptured = sides.every((side) => shots[side])

  useEffect(() => {
    docTypeRef.current = docType
  }, [docType])
  useEffect(() => {
    scanModeRef.current = scanMode
  }, [scanMode])
  useEffect(() => {
    shotsRef.current = shots
  }, [shots])

  useEffect(() => {
    const listener = (value: number) => {
      if (value >= 0) setProgress(value)
    }
    ocrProgressListener = listener
    return () => {
      if (ocrProgressListener === listener) ocrProgressListener = null
    }
  }, [])

  const stopCamera = useCallback(() => {
    guideActiveRef.current = false
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setTorchOn(false)
  }, [])

  const clearShots = useCallback(() => {
    for (const shot of Object.values(shotsRef.current)) {
      if (shot) URL.revokeObjectURL(shot.url)
    }
    shotsRef.current = {}
    setShots({})
  }, [])

  const startCamera = useCallback(async (): Promise<boolean> => {
    setCameraError(null)
    stopCamera()
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Bu brauzer kamerani qo‘llamaydi — rasm yuklab davom eting")
      return false
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          // 1080p kadr CAPTURE_WIDTH uchun yetarli va telefonda 1440p ga
          // qaraganda sezilarli tez ochiladi — kamera kutish vaqti shu yerda
          // eng ko'p seziladi.
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      })
      streamRef.current = stream
      const track = stream.getVideoTracks()[0]
      const capabilities: any = track?.getCapabilities?.()
      setTorchSupported(Boolean(capabilities?.torch))
      try {
        const advanced: any = {}
        if (capabilities?.focusMode?.includes?.("continuous")) advanced.focusMode = "continuous"
        if (capabilities?.exposureMode?.includes?.("continuous")) advanced.exposureMode = "continuous"
        if (capabilities?.whiteBalanceMode?.includes?.("continuous")) advanced.whiteBalanceMode = "continuous"
        if (Object.keys(advanced).length) await track.applyConstraints({ advanced: [advanced] })
      } catch {
        // Bu imkoniyatlar ixtiyoriy — ularsiz ham skanerlash ishlaydi.
      }
      const video = videoRef.current
      if (!video) return false
      video.srcObject = stream
      await new Promise<void>((resolve) => {
        if (video.readyState >= HTMLMediaElement.HAVE_METADATA) return resolve()
        video.onloadedmetadata = () => resolve()
      })
      await video.play()
      return true
    } catch (error: any) {
      setCameraError(
        error?.name === "NotAllowedError"
          ? "Kamera ruxsati berilmadi — brauzer sozlamasidan ruxsat bering yoki rasm yuklang"
          : "Kamera ochilmadi — boshqa kamera yoki rasm yuklashni sinab ko‘ring"
      )
      return false
    }
  }, [stopCamera])

  /**
   * Yo'naltiruvchi sikl: FAQAT o'lchaydi, hech narsa tanimaydi.
   *
   * Uning yagona vazifasi — xodimga "hozir bosing" deb ko'rsatish: ramka
   * hujjat aniqlanganda va kadr tiniq bo'lganda yashil bo'ladi. OCR bu yerda
   * ishlamagani uchun kamera ko'rinishi telefonda ham silliq qoladi.
   */
  const runGuideLoop = useCallback(async () => {
    if (guideActiveRef.current) return
    guideActiveRef.current = true
    let probe: FrameProbe | null = null
    // Ko'rinishga faqat shu ikkitasi ta'sir qiladi. Ular o'zgarmaganda holat
    // ham yangilanmaydi: aks holda sekundiga sakkiz marta butun dialog qayta
    // chizilardi va kamera ko'rinishi aynan shundan sekinlashardi.
    let lastDetected: boolean | null = null
    let lastHint: string | null = null
    let lastUsable: boolean | null = null
    /* MRZ rejimida zatvor tugmasi YO'Q: surat MRZ QATORLARI kadrda
       haqiqatan ko'ringanda — va faqat shunda — o'zi olinadi. "Hujjat
       ko'rindi" yetarli emas: MRZ'siz tomon yoki begona qog'ozga zatvor
       otmasligi kerak. Uch ketma-ket kadr (~0.4 s) talab qilinadi —
       tezkor, lekin bitta tasodifiy kadrga ishonmaydi. */
    let stableFrames = 0
    let lastMrzSeen: boolean | null = null
    while (guideActiveRef.current) {
      const video = videoRef.current
      if (!video || video.videoWidth < 100) {
        await new Promise((resolve) => window.setTimeout(resolve, 120))
        continue
      }
      probe = probeVideoFrame(video, frameRegion(docTypeRef.current), probe)
      const detected = probe.quality.usable && probe.document.present
      if (scanModeRef.current === "mrz") {
        /* MRZ bandlarining o'zi yetarli dalil: "hujjat to'liq qamrovda"
           va "turg'unlik" shartlari bu yerda ortiqcha edi — ular zatvorni
           sekinlashtirardi. Xira (harakatdagi) kadrda shtrix o'tishlari
           o'z-o'zidan yo'qoladi, ya'ni tiniqlik sharti detektorga ichki
           qurilgan. */
        const seen = probe.quality.usable && probe.document.mrzLines >= 2
        if (seen !== lastMrzSeen) {
          lastMrzSeen = seen
          setMrzSeen(seen)
        }
        stableFrames = seen ? stableFrames + 1 : 0
        if (stableFrames >= 2) {
          /* Kadr olinadi va YUBORISH ham o'zi bo'ladi: o'qish dvigatel
             sozlamasiga qarab serverda yoki qurilmaning to'liq (qayta
             urinishli) quvurida bajariladi. Jonli kadrda OCR yurgizish
             sinaldi va rad etildi — u sekin qurilmada osilib, "olinmoqda"
             holatida qotib qolardi. */
          guideActiveRef.current = false
          autoSubmitRef.current = true
          captureRef.current()
          break
        }
      }
      if (detected !== lastDetected) {
        lastDetected = detected
        setDocDetected(detected)
      }
      if (probe.quality.usable !== lastUsable || probe.quality.hint !== lastHint) {
        lastUsable = probe.quality.usable
        lastHint = probe.quality.hint
        setQuality(probe.quality)
      }
      // MRZ rejimida halqa tezroq aylanadi — zatvor "ko'rishi bilanoq"
      // otishi kerak
      await new Promise((resolve) =>
        window.setTimeout(resolve, scanModeRef.current === "mrz" ? 70 : 120)
      )
    }
  }, [])

  useEffect(() => {
    const needsCamera = open && phase === "capture" && !currentShot
    if (!needsCamera) {
      guideActiveRef.current = false
      if (phase !== "capture") stopCamera()
      return
    }
    let cancelled = false
    void (async () => {
      const started = await startCamera()
      if (started && !cancelled) await runGuideLoop()
    })()
    return () => {
      cancelled = true
      guideActiveRef.current = false
    }
  }, [open, phase, currentShot, runGuideLoop, startCamera, stopCamera])

  useEffect(() => {
    if (open) return
    stopCamera()
    scanAbortRef.current?.abort()
    scanAbortRef.current = null
    autoSubmitRef.current = false
    clearShots()
  }, [open, clearShots, stopCamera])

  /* MRZ rejimi to'liq avtomatik: zatvor otgach yuborish tugmasini kutib
     o'tirilmaydi — kadr holatga tushishi bilan yuboriladi. Xato bo'lsa
     odatdagi xato ekrani chiqadi va undan qayta urinish mumkin. */
  useEffect(() => {
    if (!autoSubmitRef.current) return
    if (phase !== "capture" || !allCaptured) return
    autoSubmitRef.current = false
    void submit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, shots, allCaptured])

  const resetAll = useCallback(() => {
    clearShots()
    setStepIndex(0)
    setResult(null)
    setQuality(null)
    setDocDetected(false)
    setErrorMsg(null)
    setCameraError(null)
    setServerFellBack(false)
    serverDownRef.current = false
  }, [clearShots])

  useEffect(() => {
    if (!open) return
    setPhase("select")
    resetAll()
  }, [open, resetAll])

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0] as any
    if (!track || !torchSupported) return
    try {
      const next = !torchOn
      await track.applyConstraints({ advanced: [{ torch: next }] })
      setTorchOn(next)
    } catch {
      setCameraError("Kamera chirog‘ini yoqib bo‘lmadi")
    }
  }, [torchOn, torchSupported])

  const storeShot = useCallback((side: DocumentSide, canvas: HTMLCanvasElement) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        // Eski ko'rinish havolasi shu yerda bo'shatiladi, holat yangilagichi
        // ichida emas: React uni ikki marta chaqirishi mumkin va o'shanda
        // hali ishlatilayotgan havola bekor qilinib qo'yilardi.
        const previous = shotsRef.current[side]
        if (previous) URL.revokeObjectURL(previous.url)
        const shot: Shot = { canvas, blob, url: URL.createObjectURL(blob) }
        shotsRef.current = { ...shotsRef.current, [side]: shot }
        setShots(shotsRef.current)
      },
      "image/jpeg",
      JPEG_QUALITY
    )
  }, [])

  const capture = () => {
    const video = videoRef.current
    if (!video?.videoWidth) return
    storeShot(currentSide, videoFrameCanvas(video, CAPTURE_WIDTH))
    stopCamera()
  }
  // Yo'l-yo'riq halqasi barqaror callback — u eng so'nggi capture'ni shu
  // ref orqali ko'radi (MRZ rejimidagi avtomatik suratga olish uchun)
  captureRef.current = capture

  const retakeCurrent = () => {
    const shot = shotsRef.current[currentSide]
    if (shot) URL.revokeObjectURL(shot.url)
    const next = { ...shotsRef.current }
    delete next[currentSide]
    shotsRef.current = next
    setShots(next)
  }

  const onFileSelected = async (file: File | null) => {
    if (!file) return
    try {
      const bitmap = await createImageBitmap(file)
      const scale = Math.min(1, CAPTURE_WIDTH / bitmap.width)
      const canvas = createCanvas(bitmap.width * scale, bitmap.height * scale)
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      bitmap.close?.()
      storeShot(currentSide, canvas)
      stopCamera()
    } catch {
      setCameraError("Rasmni o‘qib bo‘lmadi — boshqa rasm tanlang")
    }
  }

  /** Serverga ulanib bo'lmaganda — kadrlarni qurilmaning o'zida o'qish. */
  const scanOnDevice = useCallback(async (): Promise<ScannedDoc | null> => {
    let merged: ScannedDoc | undefined
    for (const side of activeSides(docTypeRef.current, scanModeRef.current)) {
      const shot = shotsRef.current[side]
      if (!shot) continue
      const outcome = await recognizeDocument(
        shot.canvas,
        docTypeRef.current,
        side,
        scanModeRef.current,
        true
      )
      const doc = outcome.recognition?.doc
      if (!doc) continue
      merged = mergeScannedDocs(merged, { ...doc, scannedSides: [side] }) ?? doc
    }
    if (!merged) return null
    return {
      ...merged,
      documentType: docTypeRef.current,
      engine: "device",
      requiresReview: true,
      warnings: [
        ...(merged.warnings ?? []),
        "Server bilan bog‘lanib bo‘lmadi — hujjat qurilmada o‘qildi, maydonlarni tekshiring",
      ],
    }
  }, [])

  const submit = async () => {
    /* MRZ rejimidagi ID kartada yagona kadr ORQA tomon — u serverga ham
       aynan `back` sifatida ketishi shart, aks holda server uni old tomon
       deb bilib MRZ'ni izlamasdi. */
    const front =
      docType === "PASSPORT" ? shots.passport?.blob : shots.front?.blob
    const back = docType === "ID_CARD" ? shots.back?.blob : undefined
    if (!front && !back) return
    setErrorMsg(null)
    setProgress(0)
    setPhase("sending")

    if (serverPreferred && !serverDownRef.current) {
      const controller = new AbortController()
      scanAbortRef.current = controller
      try {
        const doc = await scanDocumentOnServer(
          { front, back },
          docType,
          controller.signal
        )
        setResult(doc)
        setPhase("result")
        return
      } catch (error: any) {
        if (controller.signal.aborted) return
        if (error instanceof ServerScanUnavailable) {
          serverDownRef.current = true
          setServerFellBack(true)
        } else {
          setErrorMsg(apiErrorMessage(error))
          setPhase("error")
          return
        }
      } finally {
        if (scanAbortRef.current === controller) scanAbortRef.current = null
      }
    }

    try {
      const doc = await scanOnDevice()
      if (!doc) {
        setErrorMsg(
          "Hujjat o‘qilmadi. Kadrlar tiniq, yaltirashsiz va hujjat to‘liq ramkada bo‘lsin."
        )
        setPhase("error")
        return
      }
      setResult(doc)
      setPhase("result")
    } catch {
      setErrorMsg("Hujjatni o‘qishda xatolik yuz berdi. Qayta urinib ko‘ring.")
      setPhase("error")
    }
  }

  const chooseType = (type: DocumentType) => {
    setDocType(type)
    docTypeRef.current = type
    resetAll()
    setPhase("capture")
  }

  const apply = () => {
    if (result) onResult(result)
    onOpenChange(false)
  }

  const frame = frameRegion(docType)
  const checks: DocumentCheck[] = result?.checks ?? []
  const failed = checks.filter((check) => check.status === "fail")
  const warned = checks.filter((check) => check.status === "warn")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine size={18} /> Hujjat skaneri
            {/* Faol rejim ko'rinib turadi — sozlama ta'sir qilyaptimi,
                taxmin qilib o'tirilmaydi */}
            <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5",
                  scanMode === "mrz"
                    ? "bg-emerald-100 text-emerald-700"
                    : scanMode === "visual"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {scanMode === "mrz"
                  ? "Rejim: MRZ"
                  : scanMode === "visual"
                    ? "Rejim: Vizual"
                    : "Rejim: Avto"}
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5">
                {scanSettings?.engine === "device" ? "Qurilma" : "Server"}
              </span>
            </span>
          </DialogTitle>
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => {
            void onFileSelected(event.target.files?.[0] ?? null)
            event.target.value = ""
          }}
        />

        {phase === "select" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Qaysi hujjat skanerlanadi?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => chooseType("ID_CARD")}
                className="flex flex-col items-center gap-2.5 rounded-xl border-2 border-border p-5 text-center transition-all hover:border-primary hover:bg-primary/5"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <CreditCard size={24} />
                </span>
                <span className="text-sm font-semibold">ID karta</span>
                <span className="text-[11px] leading-snug text-muted-foreground">
                  {scanMode === "mrz"
                    ? "MRZ rejimi: faqat orqa tomoni olinadi"
                    : "Ikkala tomoni olinadi — ular bir-birini tasdiqlaydi"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => chooseType("PASSPORT")}
                className="flex flex-col items-center gap-2.5 rounded-xl border-2 border-border p-5 text-center transition-all hover:border-primary hover:bg-primary/5"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <BookUser size={24} />
                </span>
                <span className="text-sm font-semibold">Passport</span>
                <span className="text-[11px] leading-snug text-muted-foreground">
                  Bitta sahifa yetarli — unda MRZ ham bor
                </span>
              </button>
            </div>
          </div>
        )}

        {phase === "capture" && (
          <div className="space-y-3">
            {/* Bosqichlar: qaysi tomon olingani ko'rinib tursin */}
            <div className="flex items-center gap-2">
              {sides.map((side, index) => {
                const done = Boolean(shots[side])
                const active = index === stepIndex
                return (
                  <div
                    key={side}
                    className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                      done
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : active
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border text-muted-foreground"
                    }`}
                  >
                    {done ? <CheckCircle2 size={14} /> : <Camera size={14} />}
                    {SIDE_TITLES[side]}
                  </div>
                )
              })}
            </div>

            {currentShot ? (
              <>
                <div className="overflow-hidden rounded-xl border bg-black">
                  <img src={currentShot.url} alt={SIDE_TITLES[currentSide]} className="w-full" />
                </div>
                <p className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                  Kadr olindi. Yozuvlar aniq o‘qilayotganini tekshiring — bulutli yoki
                  yaltiragan bo‘lsa qayta oling.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={retakeCurrent} className="gap-2">
                    <RefreshCw size={15} /> Qayta olish
                  </Button>
                  {stepIndex < sides.length - 1 ? (
                    <Button onClick={() => setStepIndex(stepIndex + 1)} className="gap-2">
                      Keyingi tomon <ArrowRight size={15} />
                    </Button>
                  ) : (
                    <Button onClick={submit} disabled={!allCaptured} className="gap-2">
                      <ScanLine size={15} /> Tekshirishga yuborish
                    </Button>
                  )}
                </div>
                {stepIndex > 0 && (
                  <button
                    type="button"
                    onClick={() => setStepIndex(stepIndex - 1)}
                    className="flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft size={13} /> Oldingi tomonga qaytish
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="relative overflow-hidden rounded-xl bg-black">
                  <video ref={videoRef} autoPlay playsInline muted className="aspect-[4/3] w-full object-cover" />
                  <div
                    className={`pointer-events-none absolute rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] transition-colors ${
                      docDetected ? "border-4 border-emerald-400" : "border-2 border-dashed border-white/70"
                    }`}
                    style={{
                      left: `${frame.left * 100}%`,
                      right: `${(1 - frame.right) * 100}%`,
                      top: `${frame.top * 100}%`,
                      bottom: `${(1 - frame.bottom) * 100}%`,
                    }}
                  />
                  <div
                    className={`pointer-events-none absolute left-2 top-2 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white ${
                      docDetected ? "bg-emerald-600/90" : "bg-black/65"
                    }`}
                  >
                    {scanMode === "mrz"
                      ? mrzSeen
                        ? "MRZ ko'rindi — qimirlatmang, surat olinmoqda..."
                        : "MRZ qatorlari (pastdagi mayda belgilar) ramkada ko'rinsin"
                      : docDetected
                        ? "Tayyor — suratga oling"
                        : "Hujjatni ramkaga joylang"}
                  </div>
                  <p className="pointer-events-none absolute inset-x-2 bottom-12 text-center text-[11px] font-medium text-white/95">
                    {SIDE_HINTS[currentSide]}
                  </p>

                  {/* Zatvor tasvirning O'ZIDA turadi: xodim hujjatni ramkaga
                      joylab turib, ko'zini kadrdan uzmasdan bosadi. Tugma
                      pastda, maslahatlar ortida bo'lganda har safar pastga
                      qarash kerak bo'lardi. */}
                  <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-6">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title="Rasm yuklash"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25"
                    >
                      <ImageUp size={18} />
                    </button>
                    {scanMode === "mrz" ? (
                      /* MRZ rejimi — tugmasiz: hujjat tanilganda surat o'zi
                         olinadi, bu yerda faqat holat ko'rinib turadi */
                      <div
                        className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-md text-base font-medium text-white shadow-lg transition-colors ${
                          mrzSeen ? "bg-emerald-600" : "bg-black/50"
                        }`}
                      >
                        <ScanLine size={20} />
                        {mrzSeen ? "MRZ ko'rindi — olinmoqda..." : "MRZ kutilmoqda"}
                      </div>
                    ) : (
                    <Button
                      onClick={capture}
                      disabled={Boolean(cameraError)}
                      size="lg"
                      className={`h-12 flex-1 gap-2 text-base shadow-lg transition-colors ${
                        docDetected ? "bg-emerald-600 hover:bg-emerald-700" : ""
                      }`}
                    >
                      <Camera size={20} /> Suratga olish
                    </Button>
                    )}
                    {torchSupported ? (
                      <button
                        type="button"
                        onClick={() => void toggleTorch()}
                        title={torchOn ? "Chiroqni o‘chirish" : "Chiroqni yoqish"}
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full backdrop-blur transition-colors ${
                          torchOn ? "bg-amber-400 text-gray-900" : "bg-white/15 text-white hover:bg-white/25"
                        }`}
                      >
                        <Flashlight size={18} />
                      </button>
                    ) : (
                      <span className="h-11 w-11 shrink-0" />
                    )}
                  </div>
                </div>

                {quality && !quality.usable && (
                  <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {quality.hint}
                  </p>
                )}
                {cameraError && (
                  <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    <AlertCircle size={15} className="mt-0.5 shrink-0" /> {cameraError}
                  </p>
                )}

                <DocumentCaptureGuide documentType={docType} side={currentSide} active quality={quality} />
              </>
            )}

            <button
              type="button"
              onClick={() => {
                stopCamera()
                setPhase("select")
              }}
              className="flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft size={13} /> Hujjat turini almashtirish
            </button>
          </div>
        )}

        {phase === "sending" && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="text-sm font-medium">
              Hujjat tekshirilmoqda…{" "}
              {serverPreferred && !serverFellBack ? "" : progress > 0 ? `${progress}%` : ""}
            </p>
            <p className="max-w-xs text-center text-xs text-muted-foreground">
              {serverPreferred && !serverFellBack
                ? "MRZ nazorat raqamlari tekshirilmoqda va ikki tomon bir-biriga solishtirilmoqda."
                : "Server bilan bog‘lanib bo‘lmadi — hujjat shu qurilmada o‘qilmoqda."}
            </p>
          </div>
        )}

        {phase === "result" && result && (
          <div className="space-y-3">
            <p
              className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ${
                result.verified
                  ? "bg-emerald-50 text-emerald-800"
                  : failed.length
                    ? "bg-red-50 text-red-700"
                    : "bg-amber-50 text-amber-800"
              }`}
            >
              {result.verified ? (
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              ) : (
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
              )}
              {result.verified
                ? "Hujjat tasdiqlandi: nazorat raqamlari to‘g‘ri va ikki manba bir-biriga mos."
                : failed.length
                  ? "Hujjat tasdiqlanmadi — quyidagi nomuvofiqliklarni tekshiring."
                  : "Ma’lumot olindi, lekin to‘liq tasdiqlanmadi — qiymatlarni hujjat bilan solishtiring."}
            </p>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-muted/60 p-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Familiya</p><p className="mt-0.5 font-medium">{result.lastName || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Ism</p><p className="mt-0.5 font-medium">{result.firstName || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Tug‘ilgan sana</p><p className="mt-0.5 font-medium">{result.birthDate || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Hujjat raqami</p><p className="mt-0.5 font-medium">{result.documentNumber || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">JSHSHIR</p><p className="mt-0.5 font-medium">{result.personalNumber || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Amal qilish muddati</p><p className="mt-0.5 font-medium">{result.expiryDate || "—"}</p></div>
            </div>

            {checks.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Tekshiruvlar ({checks.length - failed.length - warned.length}/{checks.length} muvaffaqiyatli)
                </p>
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-1.5">
                  {[...failed, ...warned, ...checks.filter((check) => check.status === "ok")].map((check) => {
                    const style = CHECK_STYLES[check.status]
                    const Icon = style.icon
                    return (
                      <div key={check.key} className={`flex items-start gap-2 rounded-md px-2 py-1.5 ${style.row}`}>
                        <Icon size={14} className={`mt-0.5 shrink-0 ${style.className}`} />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-900">{check.label}</p>
                          {check.detail && (
                            <p className="mt-0.5 break-words text-[11px] leading-snug text-gray-600">{check.detail}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              (result.warnings ?? []).map((warning) => (
                <p key={warning} className="text-xs text-amber-700">• {warning}</p>
              ))
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  resetAll()
                  setPhase("capture")
                }}
                className="gap-2"
              >
                <RefreshCw size={15} /> Qayta skanerlash
              </Button>
              <Button onClick={apply} className="gap-2">
                <CheckCircle2 size={15} /> {result.verified ? "Formani to‘ldirish" : "Tekshirib, qo‘llash"}
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
              <Button variant="outline" onClick={() => setPhase("capture")} className="gap-2">
                <ArrowLeft size={15} /> Kadrlarga qaytish
              </Button>
              <Button
                onClick={() => {
                  resetAll()
                  setPhase("capture")
                }}
                className="gap-2"
              >
                <RefreshCw size={15} /> Boshidan
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
