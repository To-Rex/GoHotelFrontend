import { useCallback, useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  ArrowLeft,
  BookUser,
  Camera,
  CheckCircle2,
  CreditCard,
  ImageUp,
  Loader2,
  RefreshCw,
  ScanLine,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useScanSettings, type ScanMode } from "../api/scanSettings"
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
  selectBestQualityFrame,
  videoFrameCanvas,
  type FrameProbe,
  type ImageQuality,
  type QualityFrame,
} from "./documentVision"
import {
  isLikelyUzbekPinfl,
  mergeScannedDocs,
  type DocumentSide,
  type DocumentType,
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

type Phase = "select" | "camera" | "processing" | "flip" | "result" | "error"
type ActiveMethod = "mrz" | "visual"
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
 * Live-frame geometry.  A card filling the guide of a 1560px frame lands at
 * roughly 16 pixels per millimetre, which puts ID-card body text at the ~33px
 * x-height Tesseract reads best.  The pass widths below then match the crops
 * they receive, so the fast path resamples nothing: capturing larger and
 * rescaling afterwards cost time without adding a single readable character.
 */
const LIVE_FRAME_WIDTH = 1560
const FAST_TEXT_WIDTH = 1280
const FAST_MRZ_WIDTH = 1500

/**
 * Live frames always take the cheap guided path.  Running full rectification
 * per frame — OpenCV edge detection plus four OCR passes — costs seconds each
 * and froze the preview; escalation happens once, through the automatic
 * capture below, instead of on every frame.
 */
const AUTO_CAPTURE_AFTER_MS = 6000
/** Hard deadline: capture even when the live passes have read nothing at all. */
const AUTO_CAPTURE_DEADLINE_MS = 10000

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

function addDocToAccumulator(accumulator: FieldAccumulator, doc: ScannedDoc, sourceId: string) {
  const fields: ScannedField[] = [
    "firstName",
    "lastName",
    "birthDate",
    "documentNumber",
    "personalNumber",
    "nationality",
  ]
  for (const field of fields) {
    const value = doc[field]
    if (typeof value === "string" && value) {
      accumulator.addField(field, value, doc.fieldConfidence?.[field] ?? 1, sourceId)
    }
  }
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

/** A stable key for a complete ICAO result; used only in live-camera memory. */
function verifiedMrzKey(doc: ScannedDoc): string | undefined {
  if (!doc.documentNumber || !doc.birthDate || !doc.firstName || !doc.lastName || !doc.mrzFormat) return undefined
  const normalize = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "")
  return [doc.mrzFormat, doc.documentNumber, doc.birthDate, doc.firstName, doc.lastName, doc.personalNumber ?? ""]
    .map(normalize)
    .join("|")
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

function mrzRegion(type: DocumentType) {
  const frame = frameRegion(type)
  const height = frame.bottom - frame.top
  return {
    left: frame.left + 0.01,
    right: frame.right - 0.01,
    top: frame.bottom - height * DOC_SPECS[type].mrzFrac,
    bottom: frame.bottom,
  }
}

function sideTitle(type: DocumentType, side: DocumentSide) {
  if (type === "PASSPORT") return "Passportning ma’lumotlar sahifasi"
  return side === "front" ? "ID kartaning old tomoni" : "ID kartaning orqa tomoni (MRZ)"
}

function sideHint(type: DocumentType, side: DocumentSide, method: ActiveMethod) {
  if (type === "PASSPORT") {
    return method === "mrz"
      ? "Pasport pastidagi MRZ qatorlari sariq zonada to‘liq va ravshan bo‘lsin"
      : "Pasport ma’lumotlar sahifasini to‘liq ramkaga joylang"
  }
  if (side === "front") return "ID kartaning yozuvli old tomonini ramkaga tekis joylang"
  return method === "mrz"
    ? "ID kartaning orqa tomonidagi MRZ qatorlari sariq zonada to‘liq bo‘lsin"
    : "ID kartaning orqa tomonini to‘liq ramkaga joylang"
}

export function DocumentScanner({ open, onOpenChange, onResult }: DocumentScannerProps) {
  const [phase, setPhase] = useState<Phase>("select")
  const [docType, setDocType] = useState<DocumentType>("ID_CARD")
  const [side, setSide] = useState<DocumentSide>("front")
  const [activeMethod, setActiveMethod] = useState<ActiveMethod>("mrz")
  const [result, setResult] = useState<ScannedDoc | null>(null)
  const [frontDoc, setFrontDoc] = useState<ScannedDoc | undefined>()
  const [progress, setProgress] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const [quality, setQuality] = useState<ImageQuality | null>(null)
  const [docDetected, setDocDetected] = useState(false)
  const [visualFilled, setVisualFilled] = useState(0)
  const [mrzMatches, setMrzMatches] = useState(0)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const { data: scanSettings } = useScanSettings()
  const scanMode: ScanMode = scanSettings?.mode ?? "auto"

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const liveActiveRef = useRef(false)
  const busyRef = useRef(false)
  const docTypeRef = useRef<DocumentType>(docType)
  const sideRef = useRef<DocumentSide>(side)
  const scanModeRef = useRef<ScanMode>(scanMode)
  const frontDocRef = useRef<ScannedDoc | undefined>(undefined)
  const bestFrameRef = useRef<QualityFrame<HTMLCanvasElement> | null>(null)
  const lastQualityUpdateAtRef = useRef(0)
  const lastProgressRenderRef = useRef(-1)

  useEffect(() => {
    docTypeRef.current = docType
  }, [docType])
  useEffect(() => {
    sideRef.current = side
  }, [side])
  useEffect(() => {
    scanModeRef.current = scanMode
  }, [scanMode])
  useEffect(() => {
    const listener = (value: number) => {
      if (value < 0) return
      // OCR emits many tiny progress changes.  Rendering each one competes
      // with the camera preview on mobile, while 5% steps remain responsive.
      if (value === 0 || value === 100 || Math.abs(value - lastProgressRenderRef.current) >= 5) {
        lastProgressRenderRef.current = value
        setProgress(value)
      }
    }
    ocrProgressListener = listener
    return () => {
      if (ocrProgressListener === listener) ocrProgressListener = null
    }
  }, [])

  /** Clears every per-attempt indicator before a fresh camera pass. */
  const resetLiveState = useCallback(() => {
    setAttempts(0)
    setVisualFilled(0)
    setMrzMatches(0)
    setDocDetected(false)
    bestFrameRef.current = null
  }, [])

  const stopCamera = useCallback(() => {
    liveActiveRef.current = false
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setTorchOn(false)
  }, [])

  const startCamera = useCallback(async (): Promise<boolean> => {
    setCameraError(null)
    stopCamera()
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Bu brauzer kamera skanerini qo‘llamaydi — rasm yuklab davom eting")
      return false
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          // OCR consumes a 1680px camera crop.  Requesting 4K here caused
          // needless downscaling, slower autofocus and extra thermal load on
          // phones without adding readable MRZ detail.
          width: { ideal: 2560 },
          height: { ideal: 1440 },
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
        // These camera capabilities are optional; scanning still works without them.
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
      const message =
        error?.name === "NotAllowedError"
          ? "Kamera ruxsati berilmadi — brauzer sozlamasidan ruxsat bering yoki rasm yuklang"
          : "Kamera ochilmadi — boshqa kamera yoki rasm yuklashni sinab ko‘ring"
      setCameraError(message)
      return false
    }
  }, [stopCamera])

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

  const completeSide = useCallback(
    (doc: ScannedDoc) => {
      stopCamera()
      const currentType = docTypeRef.current
      const currentSide = sideRef.current
      if (currentType === "ID_CARD" && currentSide === "front") {
        const withSide: ScannedDoc = { ...doc, documentType: "ID_CARD", scannedSides: ["front"] }
        frontDocRef.current = withSide
        setFrontDoc(withSide)
        setPhase("flip")
        return
      }
      const merged =
        currentType === "ID_CARD" && currentSide === "back"
          ? mergeScannedDocs(frontDocRef.current, { ...doc, scannedSides: ["back"] }) ?? doc
          : doc
      setResult(merged)
      setPhase("result")
    },
    [stopCamera]
  )

  const scanCanvas = useCallback(async (
    source: HTMLCanvasElement,
    includePortraitOrientations: boolean,
    fastLive = false,
    measuredQuality?: ImageQuality
  ) => {
    setProgress(0)
    const outcome = await recognizeDocument(
      source,
      docTypeRef.current,
      sideRef.current,
      scanModeRef.current,
      includePortraitOrientations,
      fastLive,
      measuredQuality
    )
    lastQualityUpdateAtRef.current = Date.now()
    setQuality(outcome.quality)
    return outcome
  }, [])

  /**
   * Runs the full recognition pipeline on one frame and shows the outcome for
   * review.  Both the shutter button and the automatic capture use it, so a
   * self-taken photo behaves exactly like a tapped one — it never fills the
   * booking form on its own.
   */
  const finishWithFrame = useCallback(
    async (frame: HTMLCanvasElement, note: string, fallbackDoc?: ScannedDoc) => {
      liveActiveRef.current = false
      // Do not leave a hidden camera stream running while a still image is
      // processed or an error/review screen is displayed.
      stopCamera()
      busyRef.current = true
      setPhase("processing")
      try {
        const outcome = await scanCanvas(frame, false)
        const recognition = outcome.recognition
        if (recognition) {
          completeSide({
            ...recognition.doc,
            requiresReview: true,
            warnings: [...(recognition.doc.warnings ?? []), note],
          })
          return
        }
        if (fallbackDoc) {
          completeSide({ ...fallbackDoc, requiresReview: true, verified: false })
          return
        }
        setErrorMsg(
          sideRef.current === "front"
            ? "Old tomondagi yozuvlar o‘qilmadi. Hujjatni tekis, ravshan va yaltirashsiz suratga oling."
            : "MRZ ishonchli o‘qilmadi. Hujjatning pastki qatorlari to‘liq, fokusda va yaltirashsiz bo‘lsin."
        )
        setPhase("error")
      } catch {
        setErrorMsg("Skanerlashda xatolik yuz berdi. Qayta urinib ko‘ring yoki rasm yuklang.")
        setPhase("error")
      } finally {
        busyRef.current = false
      }
    },
    [completeSide, scanCanvas, stopCamera]
  )

  const runLiveLoop = useCallback(async () => {
    if (liveActiveRef.current) return
    liveActiveRef.current = true
    let attempt = 0
    let lastCaptureAt = 0
    let steadyTicks = 0
    let probe: FrameProbe | null = null
    const startedAt = Date.now()
    const frameConsensus = new FieldAccumulator(docTypeRef.current)
    const mrzVotes = new Map<string, { count: number; lastAt: number; doc: ScannedDoc }>()
    try {
      // Every Latin flow shares the English model, so warming it here costs
      // nothing later — the ID front/back switch no longer reloads a model.
      await queueWorker(async () =>
        getWorker(sideRef.current === "front" ? "visualFast" : docTypeRef.current === "ID_CARD" ? "mrzLatin" : "mrz")
      )
    } catch {
      setCameraError("OCR moduli yuklanmadi. Internet/ilova keshi holatini tekshiring yoki rasm yuklang")
      liveActiveRef.current = false
      return
    }
    while (liveActiveRef.current) {
      const video = videoRef.current
      if (!video || video.videoWidth < 100 || busyRef.current) {
        await new Promise((resolve) => window.setTimeout(resolve, 90))
        continue
      }
      // One small pixel read per tick yields focus, document presence and
      // motion together.  Previously each tick built a 720px preview canvas and
      // then a second 360px canvas inside the quality check.
      probe = probeVideoFrame(video, frameRegion(docTypeRef.current), probe)
      const now = Date.now()
      const detected = probe.quality.usable && probe.document.present
      if (now - lastQualityUpdateAtRef.current >= 200) {
        lastQualityUpdateAtRef.current = now
        setQuality(probe.quality)
        setDocDetected(detected)
      }
      steadyTicks = probe.document.steady ? steadyTicks + 1 : 0

      // The shutter fires by itself the moment a document is in the guide and
      // has stopped moving.  When detection stays uncertain — a pale card on a
      // pale desk — a slower unconditional attempt still keeps scanning alive.
      const readyToShoot =
        probe.quality.usable &&
        steadyTicks >= 2 &&
        now - lastCaptureAt >= (detected ? 240 : 1800)
      if (!readyToShoot) {
        // The live passes are deliberately cheap, so they can stall on a
        // crooked or dim document.  Rather than spinning until the operator
        // gives up, the scanner takes the shot itself and puts the full
        // pipeline — rectification, every language, numeric re-reads — on the
        // best frame it has kept.
        const elapsed = now - startedAt
        const hasPartialRead = frameConsensus.filledCount >= 2 || mrzVotes.size > 0
        if (
          bestFrameRef.current &&
          attempt >= 2 &&
          (elapsed >= AUTO_CAPTURE_DEADLINE_MS || (hasPartialRead && elapsed >= AUTO_CAPTURE_AFTER_MS))
        ) {
          const partial: ScannedDoc = {
            ...frameConsensus.doc,
            documentType: docTypeRef.current,
            source: "visual",
            scannedSides: [sideRef.current],
            warnings: ["Avtomatik olingan kadr — maydonlarni tekshiring"],
          }
          await finishWithFrame(
            bestFrameRef.current.value,
            "Skaner kadrni o‘zi oldi — natijani tekshirib tasdiqlang",
            hasPartialRead ? partial : undefined
          )
          return
        }
        await new Promise((resolve) => window.setTimeout(resolve, 80))
        continue
      }

      busyRef.current = true
      lastCaptureAt = now
      const frame: QualityFrame<HTMLCanvasElement> = {
        value: videoFrameCanvas(video, LIVE_FRAME_WIDTH),
        quality: probe.quality,
        capturedAt: now,
      }
      bestFrameRef.current = selectBestQualityFrame([frame, bestFrameRef.current].filter(Boolean) as QualityFrame<HTMLCanvasElement>[]) ?? frame
      const currentSide = sideRef.current
      const method: ActiveMethod = currentSide === "front" || scanModeRef.current === "visual" ? "visual" : "mrz"
      setActiveMethod(method)
      try {
        const outcome = await scanCanvas(frame.value, false, true, probe.quality)
        attempt++
        setAttempts(attempt)
        const candidate = outcome.recognition
        if (candidate && liveActiveRef.current) {
          if (candidate.verified) {
            // A valid check digit from one blurred frame is strong evidence but
            // not enough for zero-wrong-auto-fill policy.  Two fresh frames
            // must yield the exact same complete MRZ payload.
            const key = outcome.quality.usable ? verifiedMrzKey(candidate.doc) : undefined
            if (key) {
              for (const [voteKey, vote] of mrzVotes) {
                if (Date.now() - vote.lastAt > 5000) mrzVotes.delete(voteKey)
              }
              const previous = mrzVotes.get(key)
              const distinctFrame = !previous || Math.abs(frame.capturedAt - previous.lastAt) >= 180
              const vote = distinctFrame
                ? {
                    count: (previous?.count ?? 0) + 1,
                    lastAt: Math.max(previous?.lastAt ?? 0, frame.capturedAt),
                    doc: candidate.doc,
                  }
                : previous
              if (vote) {
                mrzVotes.set(key, vote)
                setMrzMatches(vote.count)
                if (vote.count >= 2) {
                  completeSide({
                    ...vote.doc,
                    warnings: [...(vote.doc.warnings ?? []), "Ikki tiniq kamera kadri MRZ’ni bir xil tasdiqladi"],
                  })
                  return
                }
              }
            }
          } else if (outcome.quality.usable) {
            addDocToAccumulator(frameConsensus, candidate.doc, `frame-${attempt}`)
            setVisualFilled(frameConsensus.filledCount)
            if (frameConsensus.isConfirmedComplete()) {
              completeSide({
                ...frameConsensus.doc,
                documentType: docTypeRef.current,
                source: candidate.source,
                // Multiple frames make this high confidence, but only a fully
                // validated MRZ is marked verified.
                verified: false,
                requiresReview: true,
                scannedSides: [sideRef.current],
                warnings: ["Ikki mustaqil kadr mos keldi — formaga qo‘llashdan oldin tekshiring"],
              })
              return
            }
          }
        }
      } catch {
        setCameraError("OCR kadrni o‘qiy olmadi. Fokus yoki yaltirashni tekshiring")
      } finally {
        busyRef.current = false
      }
      await new Promise((resolve) => window.setTimeout(resolve, 60))
    }
  }, [completeSide, finishWithFrame, scanCanvas])

  useEffect(() => {
    if (!open) {
      stopCamera()
      return
    }
    setPhase("select")
    setResult(null)
    setFrontDoc(undefined)
    frontDocRef.current = undefined
    setErrorMsg(null)
    setCameraError(null)
    setQuality(null)
    resetLiveState()
    // Every fast path — ID front, ID back and passport MRZ — reads Latin, so
    // one English model serves all of them.  Loading it while the operator is
    // still choosing a document type takes the model boot off the scan path.
    void queueWorker(async () => getWorker("visualFast")).catch(() => {})
    return stopCamera
  }, [open, resetLiveState, stopCamera])

  useEffect(() => {
    if (!open || phase !== "camera") {
      if (phase !== "camera") liveActiveRef.current = false
      return
    }
    let cancelled = false
    void (async () => {
      const started = await startCamera()
      if (started && !cancelled) await runLiveLoop()
    })()
    return () => {
      cancelled = true
      liveActiveRef.current = false
    }
  }, [open, phase, runLiveLoop, startCamera])

  const chooseType = (type: DocumentType) => {
    setDocType(type)
    docTypeRef.current = type
    const nextSide: DocumentSide = type === "ID_CARD" ? "front" : "passport"
    setSide(nextSide)
    sideRef.current = nextSide
    setActiveMethod(nextSide === "front" || scanMode === "visual" ? "visual" : "mrz")
    resetLiveState()
    void queueWorker(async () => getWorker(nextSide === "front" ? "visualFast" : "mrz")).catch(() => {})
    setPhase("camera")
  }

  const capture = async () => {
    const video = videoRef.current
    if (!video?.videoWidth || busyRef.current) return
    const frame = bestFrameRef.current?.value ?? videoFrameCanvas(video, 2400)
    await finishWithFrame(frame, "Qo‘lda olingan bitta kadr — natijani tekshirib tasdiqlang")
  }

  const onFileSelected = async (file: File | null) => {
    if (!file) return
    liveActiveRef.current = false
    stopCamera()
    setPhase("processing")
    setProgress(0)
    try {
      const bitmap = await createImageBitmap(file)
      const canvas = createCanvas(bitmap.width, bitmap.height)
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0)
      bitmap.close?.()
      const outcome = await scanCanvas(canvas, true)
      if (!outcome.recognition) {
        setErrorMsg("Rasmda ishonchli hujjat ma’lumoti topilmadi. To‘liq, ravshan va yaltirashsiz rasm tanlang.")
        setPhase("error")
        return
      }
      const doc = outcome.recognition.verified
        ? {
            ...outcome.recognition.doc,
            requiresReview: true,
            warnings: [...(outcome.recognition.doc.warnings ?? []), "Yuklangan bitta rasm — natijani tekshirib tasdiqlang"],
          }
        : outcome.recognition.doc
      completeSide(doc)
    } catch {
      setErrorMsg("Rasmni o‘qib bo‘lmadi — boshqa rasm tanlang")
      setPhase("error")
    }
  }

  const startBackSide = () => {
    const nextSide: DocumentSide = "back"
    setSide(nextSide)
    sideRef.current = nextSide
    setActiveMethod(scanMode === "visual" ? "visual" : "mrz")
    resetLiveState()
    void queueWorker(async () => getWorker("mrzLatin")).catch(() => {})
    setPhase("camera")
  }

  const apply = () => {
    if (result) onResult(result)
    onOpenChange(false)
  }

  const frame = frameRegion(docType)
  const mrz = mrzRegion(docType)
  const needsReview = Boolean(result?.requiresReview || !result?.verified)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine size={18} /> Xavfsiz hujjat skaneri
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
                  Avval old tomoni, keyin orqa MRZ tomoni olinadi
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
                <span className="text-sm font-semibold">Xalqaro passport</span>
                <span className="text-[11px] leading-snug text-muted-foreground">
                  TD1, TD2 va TD3 MRZ formatlari qo‘llanadi
                </span>
              </button>
            </div>
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              MRZ nazorat raqamlari bilan tekshiriladi. Vizual OCR O‘zbek lotin/kirill, rus va ingliz yozuvlarida zaxira yo‘l sifatida ishlaydi.
            </p>
          </div>
        )}

        {phase === "camera" && (
          <div className="space-y-3">
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
              {activeMethod === "mrz" && side !== "front" && (
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
              <div
                className={`pointer-events-none absolute left-2 top-2 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white ${
                  docDetected ? "bg-emerald-600/90" : "bg-black/65"
                }`}
              >
                {docDetected
                  ? activeMethod === "mrz"
                    ? "Hujjat aniqlandi · MRZ o‘qilmoqda"
                    : "Hujjat aniqlandi · o‘qilmoqda"
                  : "Hujjat qidirilmoqda…"}
                {attempts > 0 ? ` · ${attempts}` : ""}
                {activeMethod === "mrz" && mrzMatches > 0 ? ` · ${mrzMatches}/2 tasdiq` : ""}
                {activeMethod === "visual" && visualFilled ? ` · ${visualFilled}/5` : ""}
              </div>
              <div className="absolute right-2 top-2 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-medium text-white">
                {sideTitle(docType, side)}
              </div>
              <p className="pointer-events-none absolute inset-x-2 bottom-1 text-center text-[11px] font-medium text-white/95">
                {sideHint(docType, side, activeMethod)}
              </p>
            </div>

            <DocumentCaptureGuide documentType={docType} side={side} active quality={quality} />

            {quality && (
              <p
                className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
                  quality.usable ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
                }`}
              >
                <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                {quality.hint}
              </p>
            )}
            {cameraError && (
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                <AlertCircle size={15} className="mt-0.5 shrink-0" /> {cameraError}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={capture} disabled={Boolean(cameraError) || quality?.usable === false} className="gap-2">
                <Camera size={16} /> Hozir olish
              </Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
                <ImageUp size={16} /> Rasm yuklash
              </Button>
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>Hujjat ramkada turganda skaner o‘zi suratga oladi — tugmani bosish shart emas.</span>
              {torchSupported && (
                <button type="button" onClick={() => void toggleTorch()} className="font-medium text-primary hover:underline">
                  {torchOn ? "Chiroqni o‘chirish" : "Chiroqni yoqish"}
                </button>
              )}
            </div>
          </div>
        )}

        {phase === "processing" && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="text-sm font-medium">Hujjat tekshirilmoqda… {progress > 0 ? `${progress}%` : ""}</p>
            <p className="text-center text-xs text-muted-foreground">
              Perspektiva, fokus va MRZ nazorat raqamlari tekshiriladi.
            </p>
          </div>
        )}

        {phase === "flip" && (
          <div className="space-y-4">
            <p className="flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2.5 text-sm text-sky-800">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> Old tomon olindi. Endi ID kartani orqa tomoniga ag‘daring — MRZ orqali ma’lumotlar tekshiriladi.
            </p>
            <DocumentCaptureGuide documentType="ID_CARD" side="back" active />
            {frontDoc && (
              <p className="text-xs text-muted-foreground">
                Old tomondan topilgan maydonlar: {[frontDoc.firstName, frontDoc.lastName, frontDoc.documentNumber].filter(Boolean).join(" · ") || "ma’lumot hali aniqlanmadi"}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  resetLiveState()
                  setPhase("camera")
                }}
                className="gap-2"
              >
                <RefreshCw size={15} /> Old tomonni qayta olish
              </Button>
              <Button onClick={startBackSide} className="gap-2">
                <ScanLine size={15} /> Orqa tomonni skanerlash
              </Button>
            </div>
          </div>
        )}

        {phase === "result" && result && (
          <div className="space-y-3">
            <p
              className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                needsReview ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {needsReview ? <AlertCircle size={16} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={16} className="mt-0.5 shrink-0" />}
              {needsReview
                ? "Natijani tekshirib tasdiqlang — barcha maydonlar avtomatik ishonchli deb hisoblanmaydi."
                : "MRZ nazorat raqamlari to‘liq tasdiqlandi."}
            </p>
            {result.qrConfirmed && (
              <p className="flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> QR kodi va MRZ ma’lumoti bir-birini tasdiqladi.
              </p>
            )}
            {(result.warnings ?? []).map((warning) => (
              <p key={warning} className="text-xs text-amber-700">• {warning}</p>
            ))}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-muted/60 p-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Ism</p><p className="mt-0.5 font-medium">{result.firstName || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Familiya</p><p className="mt-0.5 font-medium">{result.lastName || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Tug‘ilgan sana</p><p className="mt-0.5 font-medium">{result.birthDate || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Hujjat raqami</p><p className="mt-0.5 font-medium">{result.documentNumber || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">JSHSHIR</p><p className="mt-0.5 font-medium">{result.personalNumber || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Format</p><p className="mt-0.5 font-medium">{result.mrzFormat || (result.documentType === "PASSPORT" ? "Passport" : "ID karta")}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  resetLiveState()
                  setPhase("camera")
                }}
                className="gap-2"
              >
                <RefreshCw size={15} /> Qayta skanerlash
              </Button>
              <Button onClick={apply} className="gap-2">
                <CheckCircle2 size={15} /> {needsReview ? "Tekshirib, qo‘llash" : "Formani to‘ldirish"}
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
              <Button
                variant="outline"
                onClick={() => {
                  resetLiveState()
                  setPhase("camera")
                }}
                className="gap-2"
              >
                <RefreshCw size={15} /> Qayta urinish
              </Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
                <ImageUp size={16} /> Rasm yuklash
              </Button>
            </div>
            {docType === "ID_CARD" && side === "front" && (
              <button type="button" onClick={startBackSide} className="w-full text-xs text-primary hover:underline">
                Old tomonni o‘tkazib yuborib, orqa MRZ tomonini skanerlash
              </button>
            )}
            <button type="button" onClick={() => setPhase("select")} className="flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft size={13} /> Hujjat turini almashtirish
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
