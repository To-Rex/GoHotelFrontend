import type { DocumentType } from "./documentScannerTypes"

export interface ImageQuality {
  score: number
  sharpness: number
  brightness: number
  contrast: number
  glare: number
  usable: boolean
  hint: string
}

export interface RectifiedDocument {
  canvas: HTMLCanvasElement
  rectified: boolean
  quality: ImageQuality
}

/** A captured camera frame plus the measurements used to rank it. */
export interface QualityFrame<T> {
  value: T
  quality: ImageQuality
  capturedAt: number
}

interface Point {
  x: number
  y: number
}

let openCvPromise: Promise<any> | null = null

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  return canvas
}

export function cloneCanvas(source: HTMLCanvasElement) {
  const canvas = createCanvas(source.width, source.height)
  canvas.getContext("2d")!.drawImage(source, 0, 0)
  return canvas
}

export function cropCanvas(
  source: HTMLCanvasElement,
  left: number,
  top: number,
  width: number,
  height: number
) {
  const sx = Math.max(0, Math.min(source.width - 1, Math.round(left)))
  const sy = Math.max(0, Math.min(source.height - 1, Math.round(top)))
  const sw = Math.max(1, Math.min(source.width - sx, Math.round(width)))
  const sh = Math.max(1, Math.min(source.height - sy, Math.round(height)))
  const canvas = createCanvas(sw, sh)
  canvas.getContext("2d")!.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh)
  return canvas
}

/** The exact 4:3 object-cover area the scanner shows the operator. */
function visibleRect(video: HTMLVideoElement) {
  const sourceW = video.videoWidth
  const sourceH = video.videoHeight
  const targetAspect = 4 / 3
  const sourceAspect = sourceW / sourceH
  let width = sourceW
  let height = sourceH
  if (sourceAspect > targetAspect) width = sourceH * targetAspect
  else if (sourceAspect < targetAspect) height = sourceW / targetAspect
  return { x: (sourceW - width) / 2, y: (sourceH - height) / 2, width, height }
}

/** Mirrors the 4:3 object-cover viewport the scanner displays to the user. */
export function videoFrameCanvas(video: HTMLVideoElement, maximumWidth = 1920) {
  const rect = visibleRect(video)
  const scale = Math.min(1, maximumWidth / rect.width)
  const canvas = createCanvas(rect.width * scale, rect.height * scale)
  canvas
    .getContext("2d")!
    .drawImage(video, rect.x, rect.y, rect.width, rect.height, 0, 0, canvas.width, canvas.height)
  return canvas
}

export function rotateCanvas(source: HTMLCanvasElement, degrees: 0 | 90 | 180 | 270) {
  if (degrees === 0) return cloneCanvas(source)
  const vertical = degrees === 90 || degrees === 270
  const canvas = createCanvas(vertical ? source.height : source.width, vertical ? source.width : source.height)
  const ctx = canvas.getContext("2d")!
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((degrees * Math.PI) / 180)
  ctx.drawImage(source, -source.width / 2, -source.height / 2)
  return canvas
}

export function orientationCandidates(source: HTMLCanvasElement, includePortrait: boolean) {
  const degrees: Array<0 | 90 | 180 | 270> = includePortrait ? [0, 180, 90, 270] : [0, 180]
  // The upright source is already a valid candidate.  Avoid cloning a large
  // camera canvas just to return it unchanged; all consumers treat candidates
  // as read-only.
  return degrees.map((angle) => ({ angle, canvas: angle === 0 ? source : rotateCanvas(source, angle) }))
}

interface LuminanceStats {
  sum: number
  sumSq: number
  clipped: number
}

function fillGray(pixels: Uint8ClampedArray, gray: Float32Array): LuminanceStats {
  let sum = 0
  let sumSq = 0
  let clipped = 0
  for (let i = 0, p = 0; i < pixels.length; i += 4, p++) {
    const value = pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114
    gray[p] = value
    sum += value
    sumSq += value * value
    if (pixels[i] > 250 && pixels[i + 1] > 250 && pixels[i + 2] > 250) clipped++
  }
  return { sum, sumSq, clipped }
}

/**
 * Grayscale conversion limited to a rectangle.  The live probe only ever
 * analyses the capture guide, so converting the surrounding desk was a third of
 * the per-frame pixel work spent on pixels nothing reads.  Exposure statistics
 * come out of the same rectangle, which also stops a dark background from
 * reporting a well-lit document as underexposed.
 */
function fillGrayRegion(
  pixels: Uint8ClampedArray,
  gray: Float32Array,
  width: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): LuminanceStats {
  let sum = 0
  let sumSq = 0
  let clipped = 0
  for (let y = y0; y < y1; y++) {
    const rowOffset = y * width
    for (let x = x0; x < x1; x++) {
      const p = rowOffset + x
      const i = p * 4
      const value = pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114
      gray[p] = value
      sum += value
      sumSq += value * value
      if (pixels[i] > 250 && pixels[i + 1] > 250 && pixels[i + 2] > 250) clipped++
    }
  }
  return { sum, sumSq, clipped }
}

/** Variance of the Laplacian is a reliable, inexpensive focus measure. */
function laplacianSharpness(gray: Float32Array, width: number, height: number) {
  let laplacianSum = 0
  let laplacianSq = 0
  let laplacianCount = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = y * width + x
      const laplacian =
        4 * gray[index] - gray[index - 1] - gray[index + 1] - gray[index - width] - gray[index + width]
      laplacianSum += laplacian
      laplacianSq += laplacian * laplacian
      laplacianCount++
    }
  }
  return Math.sqrt(
    Math.max(0, laplacianSq / Math.max(1, laplacianCount) - (laplacianSum / Math.max(1, laplacianCount)) ** 2)
  )
}

function qualityFromStats(stats: LuminanceStats, count: number, sharpness: number): ImageQuality {
  const brightness = stats.sum / count
  const contrast = Math.sqrt(Math.max(0, stats.sumSq / count - brightness * brightness))
  const glare = stats.clipped / count

  const sharpScore = Math.min(1, sharpness / 18)
  const contrastScore = Math.min(1, contrast / 42)
  const lightScore = brightness < 42 || brightness > 238 ? 0 : 1 - Math.min(1, Math.abs(brightness - 145) / 120) * 0.35
  const glarePenalty = glare > 0.7 && contrast < 25 ? 0.45 : glare > 0.88 ? 0.2 : 0
  const score = Math.max(0, Math.min(1, sharpScore * 0.5 + contrastScore * 0.25 + lightScore * 0.25 - glarePenalty))

  let hint = "Hujjatni ramkada qimirlatmay turing"
  if (sharpness < 8) hint = "Fokus past — kamerani biroz uzoqlashtirib, ravshanlashtiring"
  else if (brightness < 55) hint = "Yorug‘lik kam — hujjatni yorug‘roq joyga olib boring"
  else if (brightness > 230 || (glare > 0.7 && contrast < 25)) hint = "Yaltirash bor — kamerani yoki hujjat burchagini ozgina o‘zgartiring"
  else if (contrast < 18) hint = "Kontrast past — soyani kamaytiring"

  return { score, sharpness, brightness, contrast, glare, usable: score >= 0.48, hint }
}

/**
 * Fast image-quality check.  It deliberately rejects unfocused and badly
 * exposed frames before expensive OCR starts, while merely warning about glare
 * (a white identity card must not itself be considered glare).
 */
export function assessImageQuality(source: HTMLCanvasElement): ImageQuality {
  const maxSide = 360
  const ratio = Math.min(1, maxSide / Math.max(source.width, source.height))
  const probe = createCanvas(source.width * ratio, source.height * ratio)
  const ctx = probe.getContext("2d", { willReadFrequently: true })!
  ctx.drawImage(source, 0, 0, probe.width, probe.height)
  const pixels = ctx.getImageData(0, 0, probe.width, probe.height).data
  const gray = new Float32Array(probe.width * probe.height)
  const stats = fillGray(pixels, gray)
  const sharpness = laplacianSharpness(gray, probe.width, probe.height)
  return qualityFromStats(stats, gray.length || 1, sharpness)
}

/* ------------------------------------------------ live auto-shutter probe */

/** On-screen capture guide, expressed as fractions of the 4:3 viewport. */
export interface GuideRegion {
  left: number
  right: number
  top: number
  bottom: number
}

export interface DocumentPresence {
  /** A document-like printed surface fills the guide. */
  present: boolean
  /** 0..1 — how much of the guide the printed structure spans. */
  coverage: number
  /** 0..1 — edge density inside the guide. */
  detail: number
  /** Mean absolute luminance change against the previous probe (0..255). */
  motion: number
  /** The document has stopped moving, so a capture will not be smeared. */
  steady: boolean
  /**
   * MRZ'ga o'xshash qatorlar soni (0..3): hujjat PASTIDA, deyarli butun
   * enni egallagan, juda zich qorong'i-yorug' almashinuvli chiziqlar.
   * MRZ rejimidagi avtomatik zatvor aynan shu >= 2 bo'lgandagina otadi —
   * shunchaki "hujjat ko'rindi" yetarli emas.
   */
  mrzLines: number
}

export interface FrameProbe {
  quality: ImageQuality
  document: DocumentPresence
  /** Retained so the next probe can measure motion against this frame. */
  gray: Float32Array
  width: number
  height: number
}

/**
 * A gradient step this size separates print from paper grain and sensor noise
 * while still firing on the low-contrast grey text of a worn ID card.
 */
const EDGE_THRESHOLD = 18

/** The guide is scored as a GRID x GRID board of occupancy cells. */
const GRID = 12

/**
 * Measures focus, document presence and motion inside the guide in one pass.
 *
 * The three share their pixel reads exactly: a Laplacian needs a pixel and its
 * four neighbours, and so does the gradient used for edge density, so splitting
 * them into separate loops read the same five values three times over. On a
 * phone this loop runs several times a second, and that redundancy was the
 * whole reason a live preview stuttered.
 *
 * Occupancy is scored per grid cell rather than per pixel row, because the
 * blank paper between two lines of text is a whole empty row — a row-by-row
 * projection would score a perfectly framed card as half covered.  A cell-based
 * score still separates a card from a single dark object, which lights up only
 * the few cells it physically covers.  Detecting the print rather than the card
 * outline matters because the outline disappears when a white card is laid on a
 * white desk, while its portrait and text never do.
 */
interface GuideBounds {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** Guide rectangle in probe pixels, always leaving a one-pixel gradient margin. */
function guideBounds(width: number, height: number, guide: GuideRegion): GuideBounds {
  return {
    x0: Math.max(1, Math.round(guide.left * width)),
    x1: Math.min(width - 2, Math.round(guide.right * width)),
    y0: Math.max(1, Math.round(guide.top * height)),
    y1: Math.min(height - 2, Math.round(guide.bottom * height)),
  }
}

function analyzeGuide(
  gray: Float32Array,
  width: number,
  bounds: GuideBounds,
  previousGray: Float32Array | null
): { document: DocumentPresence; sharpness: number } {
  const { x0, x1, y0, y1 } = bounds
  const boxWidth = x1 - x0
  const boxHeight = y1 - y0
  if (boxWidth < GRID * 2 || boxHeight < GRID * 2) {
    return {
      document: {
        present: false,
        coverage: 0,
        detail: 0,
        motion: 255,
        steady: false,
        mrzLines: 0,
      },
      sharpness: 0,
    }
  }

  const cells = new Uint16Array(GRID * GRID)
  let detailed = 0
  let laplacianSum = 0
  let laplacianSq = 0
  let difference = 0
  for (let y = y0; y < y1; y++) {
    const rowOffset = y * width
    const cellRow = Math.min(GRID - 1, Math.floor(((y - y0) * GRID) / boxHeight)) * GRID
    for (let x = x0; x < x1; x++) {
      const index = rowOffset + x
      const left = gray[index - 1]
      const right = gray[index + 1]
      const up = gray[index - width]
      const down = gray[index + width]

      const laplacian = 4 * gray[index] - left - right - up - down
      laplacianSum += laplacian
      laplacianSq += laplacian * laplacian

      if (Math.abs(right - left) + Math.abs(down - up) >= EDGE_THRESHOLD) {
        detailed++
        cells[cellRow + Math.min(GRID - 1, Math.floor(((x - x0) * GRID) / boxWidth))]++
      }
      if (previousGray) difference += Math.abs(gray[index] - previousGray[index])
    }
  }

  const samples = boxWidth * boxHeight
  const detail = detailed / samples
  const cellFloor = Math.max(3, (samples / (GRID * GRID)) * 0.012)
  let occupied = 0
  for (let i = 0; i < cells.length; i++) if (cells[i] >= cellFloor) occupied++
  const coverage = occupied / cells.length
  const motion = previousGray ? difference / samples : 255

  return {
    document: {
      present: detail >= 0.02 && coverage >= 0.45,
      coverage,
      detail,
      motion,
      steady: motion <= 5,
      mrzLines: countMrzBands(gray, width, bounds),
    },
    // Focus is judged on the guide alone.  Averaging in a plain background
    // dragged the variance down and made the scanner call a sharp card blurry.
    sharpness: Math.sqrt(Math.max(0, laplacianSq / samples - (laplacianSum / samples) ** 2)),
  }
}

/**
 * MRZ bandlarini sanaydi — OCR'siz, sof piksel statistikasi.
 *
 * MRZ qatori boshqa har qanday yozuvdan bitta belgisi bilan ajralib
 * turadi: OCR-B monospace matn qatorning DEYARLI BUTUN ENI bo'ylab
 * uzluksiz davom etadi, ya'ni o'sha qator bo'ylab qorong'i-yorug'
 * almashinishlar soni juda katta. Oddiy yozuv (ism, yorliq) qisqa va
 * siyrak — bu chegaraga yetmaydi.
 *
 * Hujjat pastki qismi (45% dan pasti) qaraladi: MRZ ID kartada ham,
 * passportda ham aynan pastda. 2+ band = MRZ ko'rindi (TD3 — 2 qator,
 * TD1 — 3 qator).
 */
/**
 * MRZ shtrixlari 320 px'lik tahlil kadrida juda mayda bo'lib, xiralashadi —
 * shu sabab bu yerda asosiy EDGE_THRESHOLD emas, yumshoqroq chegara.
 */
const MRZ_EDGE = 9

/** Qator nechta bo'lakka bo'lib tekshiriladi (en bo'ylab bir tekislik). */
const MRZ_SEGMENTS = 8

function countMrzBands(gray: Float32Array, width: number, bounds: GuideBounds): number {
  const { x0, x1, y1 } = bounds
  const boxWidth = x1 - x0
  const boxHeight = y1 - bounds.y0
  if (boxWidth < 60 || boxHeight < 24) return 0

  const startY = bounds.y0 + Math.floor(boxHeight * 0.4)
  const minTransitions = Math.max(20, Math.floor(boxWidth * 0.1))
  const segmentWidth = boxWidth / MRZ_SEGMENTS

  let bands = 0
  let run = 0
  const segmentHits = new Uint16Array(MRZ_SEGMENTS)
  for (let y = startY; y < y1; y++) {
    const rowOffset = y * width
    let transitions = 0
    segmentHits.fill(0)
    for (let x = x0 + 1; x < x1; x++) {
      if (Math.abs(gray[rowOffset + x] - gray[rowOffset + x - 1]) >= MRZ_EDGE) {
        transitions++
        segmentHits[Math.min(MRZ_SEGMENTS - 1, Math.floor((x - x0) / segmentWidth))]++
      }
    }
    /* MRZ qatorini boshqa yozuvdan ajratib turadigan narsa zichlikning
       o'zi emas — shtrixlar QATORNING BUTUN ENI bo'ylab tekis tarqalgani.
       Shuning uchun umumiy son yumshoq, bir tekislik esa qat'iy: 8
       bo'lakdan kamida 6 tasida shtrix bo'lishi shart — qisqa yozuv yoki
       imzo bu shartdan o'ta olmaydi. */
    let spread = 0
    for (let i = 0; i < MRZ_SEGMENTS; i++) if (segmentHits[i] >= 2) spread++
    if (transitions >= minTransitions && spread >= 6) {
      run++
    } else {
      // Kamida 2 qator balandlikdagi chiziq band hisoblanadi —
      // bitta shovqinli qator emas
      if (run >= 2) bands++
      run = 0
    }
  }
  if (run >= 2) bands++
  return Math.min(bands, 3)
}

const PROBE_WIDTH = 320
let probeCanvas: HTMLCanvasElement | null = null
let probeGrayA: Float32Array | null = null
let probeGrayB: Float32Array | null = null
let probeUsesB = false

/**
 * One small canvas read per live tick answers three questions at once: is the
 * frame sharp enough, is a document actually in the guide, and has it stopped
 * moving.  Measuring these separately used to allocate two canvases and read
 * pixels twice every tick, which was the largest main-thread cost of the live
 * scanner on phones.
 */
export function probeVideoFrame(
  video: HTMLVideoElement,
  guide: GuideRegion,
  previous?: FrameProbe | null
): FrameProbe {
  const rect = visibleRect(video)
  const scale = Math.min(1, PROBE_WIDTH / rect.width)
  const width = Math.max(1, Math.round(rect.width * scale))
  const height = Math.max(1, Math.round(rect.height * scale))
  if (!probeCanvas || probeCanvas.width !== width || probeCanvas.height !== height) {
    probeCanvas = createCanvas(width, height)
    probeGrayA = null
    probeGrayB = null
  }
  const ctx = probeCanvas.getContext("2d", { willReadFrequently: true })!
  ctx.drawImage(video, rect.x, rect.y, rect.width, rect.height, 0, 0, width, height)
  const pixels = ctx.getImageData(0, 0, width, height).data

  const count = width * height
  if (!probeGrayA || probeGrayA.length !== count) {
    probeGrayA = new Float32Array(count)
    probeGrayB = new Float32Array(count)
  }
  // Two buffers alternate so measuring motion never reads a buffer that this
  // call is in the middle of overwriting.
  probeUsesB = !probeUsesB
  const gray = (probeUsesB ? probeGrayB : probeGrayA)!
  const previousGray =
    previous && previous.width === width && previous.height === height && previous.gray !== gray
      ? previous.gray
      : null

  const bounds = guideBounds(width, height, guide)
  // Gradients read one pixel beyond the guide, so the converted band is one
  // pixel wider than the analysed rectangle on every side.
  const stats = fillGrayRegion(pixels, gray, width, bounds.x0 - 1, bounds.y0 - 1, bounds.x1 + 2, bounds.y1 + 2)
  const analysis = analyzeGuide(gray, width, bounds, previousGray)
  const statsCount = Math.max(1, (bounds.x1 + 3 - bounds.x0) * (bounds.y1 + 3 - bounds.y0))
  return {
    quality: qualityFromStats(stats, statsCount, analysis.sharpness),
    document: analysis.document,
    gray,
    width,
    height,
  }
}

/**
 * Prefer an actually sharp, evenly lit frame over the most recent one.  This
 * is deliberately deterministic: it improves capture quality without trying
 * to invent document characters from a blurred image.
 */
export function selectBestQualityFrame<T>(frames: readonly QualityFrame<T>[]): QualityFrame<T> | undefined {
  const rank = (quality: ImageQuality) =>
    quality.score * 100 + Math.min(quality.sharpness, 42) * 0.72 + Math.min(quality.contrast, 55) * 0.12 - quality.glare * 8

  return frames.reduce<QualityFrame<T> | undefined>((best, frame) => {
    if (!best) return frame
    const bestRank = rank(best.quality)
    const frameRank = rank(frame.quality)
    return frameRank > bestRank || (frameRank === bestRank && frame.capturedAt > best.capturedAt) ? frame : best
  }, undefined)
}

/**
 * Decodes the QR found on the left-upper area of Uzbekistan ID-card backs.
 * Native BarcodeDetector is near-instant where available; ZXing is loaded only
 * as a local fallback.  The caller must corroborate the payload with MRZ — a
 * QR string is never used as an authority by itself.
 */
export async function decodeIdCardQr(source: HTMLCanvasElement): Promise<string | undefined> {
  const regions = [
    cropCanvas(source, source.width * 0.01, source.height * 0.08, source.width * 0.42, source.height * 0.58),
    source,
  ]
  const NativeBarcodeDetector = (globalThis as any).BarcodeDetector as
    | (new (options: { formats: string[] }) => { detect(image: CanvasImageSource): Promise<Array<{ rawValue?: string }>> })
    | undefined

  if (NativeBarcodeDetector) {
    try {
      const detector = new NativeBarcodeDetector({ formats: ["qr_code"] })
      for (const region of regions) {
        const result = await detector.detect(region)
        const value = result[0]?.rawValue?.trim()
        if (value) return value.slice(0, 4096)
      }
    } catch {
      // The browser can expose the API but reject a format; use local fallback.
    }
  }

  try {
    const { BrowserQRCodeReader } = await import("@zxing/browser")
    const reader = new BrowserQRCodeReader()
    for (const region of regions) {
      try {
        const value = reader.decodeFromCanvas(region).getText().trim()
        if (value) return value.slice(0, 4096)
      } catch {
        // No QR in this crop; the next crop may still contain it.
      }
    }
  } catch {
    // QR corroboration is optional. MRZ remains the primary verified source.
  }
  return undefined
}

async function getOpenCv() {
  if (!openCvPromise) {
    openCvPromise = import("@techstark/opencv-js").then(async (module: any) => {
      const candidate = module.default ?? module
      if (candidate instanceof Promise) return candidate
      if (candidate?.Mat) return candidate
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error("OpenCV yuklanmadi")), 12000)
        candidate.onRuntimeInitialized = () => {
          window.clearTimeout(timeout)
          resolve()
        }
      })
      return candidate
    })
  }
  return openCvPromise
}

function orderPoints(points: Point[]): [Point, Point, Point, Point] | null {
  if (points.length !== 4) return null
  const bySum = [...points].sort((a, b) => a.x + a.y - (b.x + b.y))
  const topLeft = bySum[0]
  const bottomRight = bySum[3]
  const remaining = points.filter((point) => point !== topLeft && point !== bottomRight)
  if (remaining.length !== 2) return null
  const [first, second] = remaining
  const topRight = first.x - first.y > second.x - second.y ? first : second
  const bottomLeft = topRight === first ? second : first
  return [topLeft, topRight, bottomRight, bottomLeft]
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * Finds the largest document-like quadrilateral and rectifies its perspective.
 * If edge detection is inconclusive, OCR receives the original frame instead
 * of a guessed crop.  This keeps the improvement safe for difficult scenes.
 */
export async function rectifyDocument(
  source: HTMLCanvasElement,
  type: DocumentType
): Promise<RectifiedDocument> {
  // Most well-framed recovery scans are rectified successfully.  Keep the
  // clone/quality fallback lazy so that success does not allocate and measure
  // a second full-resolution canvas first.
  let fallback: HTMLCanvasElement | null = null
  let fallbackQuality: ImageQuality | null = null
  const fallbackResult = (): RectifiedDocument => {
    if (!fallback) {
      fallback = cloneCanvas(source)
      fallbackQuality = assessImageQuality(fallback)
    }
    return { canvas: fallback, rectified: false, quality: fallbackQuality! }
  }
  try {
    const cv = await getOpenCv()
    const src = cv.imread(source)
    const maxEdge = 1000
    const scale = Math.min(1, maxEdge / Math.max(src.cols, src.rows))
    const resized = new cv.Mat()
    const gray = new cv.Mat()
    const blurred = new cv.Mat()
    const edges = new cv.Mat()
    const dilated = new cv.Mat()
    const contours = new cv.MatVector()
    const hierarchy = new cv.Mat()
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3))
    let best: { points: [Point, Point, Point, Point]; score: number } | null = null
    try {
      cv.resize(src, resized, new cv.Size(Math.round(src.cols * scale), Math.round(src.rows * scale)))
      cv.cvtColor(resized, gray, cv.COLOR_RGBA2GRAY)
      cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0)
      cv.Canny(blurred, edges, 45, 140)
      cv.dilate(edges, dilated, kernel)
      cv.findContours(dilated, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE)
      const expectedAspect = type === "PASSPORT" ? 125 / 88 : 85.6 / 54
      const imageArea = resized.cols * resized.rows
      for (let index = 0; index < contours.size(); index++) {
        const contour = contours.get(index)
        const approx = new cv.Mat()
        try {
          const perimeter = cv.arcLength(contour, true)
          cv.approxPolyDP(contour, approx, 0.02 * perimeter, true)
          if (approx.rows !== 4 || !cv.isContourConvex(approx)) continue
          const area = Math.abs(cv.contourArea(approx))
          if (area < imageArea * 0.16) continue
          const data = approx.data32S as Int32Array
          const points = Array.from({ length: 4 }, (_, i) => ({ x: data[i * 2], y: data[i * 2 + 1] }))
          const ordered = orderPoints(points)
          if (!ordered) continue
          const width = (distance(ordered[0], ordered[1]) + distance(ordered[2], ordered[3])) / 2
          const height = (distance(ordered[0], ordered[3]) + distance(ordered[1], ordered[2])) / 2
          const aspect = width / Math.max(height, 1)
          if (aspect < 0.8 || aspect > 2.5) continue
          const aspectFit = Math.max(0, 1 - Math.abs(Math.log(aspect / expectedAspect)))
          const score = area / imageArea * 0.72 + aspectFit * 0.28
          if (!best || score > best.score) best = { points: ordered, score }
        } finally {
          contour.delete()
          approx.delete()
        }
      }
      if (!best || best.score < 0.33) return fallbackResult()

      const points = best.points.map((point) => ({ x: point.x / scale, y: point.y / scale }))
      const sourcePoints = orderPoints(points)
      if (!sourcePoints) return fallbackResult()
      const width = Math.min(
        2400,
        Math.max(
          640,
          Math.round((distance(sourcePoints[0], sourcePoints[1]) + distance(sourcePoints[2], sourcePoints[3])) / 2)
        )
      )
      const height = Math.min(
        1800,
        Math.max(
          400,
          Math.round((distance(sourcePoints[0], sourcePoints[3]) + distance(sourcePoints[1], sourcePoints[2])) / 2)
        )
      )
      const sourceMat = cv.matFromArray(
        4,
        1,
        cv.CV_32FC2,
        sourcePoints.flatMap((point) => [point.x, point.y])
      )
      const targetMat = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, width - 1, 0, width - 1, height - 1, 0, height - 1])
      const transform = cv.getPerspectiveTransform(sourceMat, targetMat)
      const warped = new cv.Mat()
      try {
        cv.warpPerspective(src, warped, transform, new cv.Size(width, height), cv.INTER_CUBIC, cv.BORDER_REPLICATE)
        const output = createCanvas(width, height)
        cv.imshow(output, warped)
        return { canvas: output, rectified: true, quality: assessImageQuality(output) }
      } finally {
        sourceMat.delete()
        targetMat.delete()
        transform.delete()
        warped.delete()
      }
    } finally {
      src.delete()
      resized.delete()
      gray.delete()
      blurred.delete()
      edges.delete()
      dilated.delete()
      contours.delete()
      hierarchy.delete()
      kernel.delete()
    }
  } catch {
    // The scanner remains functional on browsers where WebAssembly CV cannot load.
    return fallbackResult()
  }
}
