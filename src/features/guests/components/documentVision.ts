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

/** Mirrors the 4:3 object-cover viewport the scanner displays to the user. */
export function videoFrameCanvas(video: HTMLVideoElement, maximumWidth = 1920) {
  const sourceW = video.videoWidth
  const sourceH = video.videoHeight
  const targetAspect = 4 / 3
  const sourceAspect = sourceW / sourceH
  let visibleW = sourceW
  let visibleH = sourceH
  if (sourceAspect > targetAspect) visibleW = sourceH * targetAspect
  else if (sourceAspect < targetAspect) visibleH = sourceW / targetAspect
  const sx = (sourceW - visibleW) / 2
  const sy = (sourceH - visibleH) / 2
  const scale = Math.min(1, maximumWidth / visibleW)
  const canvas = createCanvas(visibleW * scale, visibleH * scale)
  canvas.getContext("2d")!.drawImage(video, sx, sy, visibleW, visibleH, 0, 0, canvas.width, canvas.height)
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
  return degrees.map((angle) => ({ angle, canvas: rotateCanvas(source, angle) }))
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
  const width = probe.width
  const height = probe.height
  const gray = new Float32Array(width * height)
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
  const count = gray.length || 1
  const brightness = sum / count
  const contrast = Math.sqrt(Math.max(0, sumSq / count - brightness * brightness))

  // Variance of the Laplacian is a reliable, inexpensive focus measure.
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
  const sharpness = Math.sqrt(
    Math.max(0, laplacianSq / Math.max(1, laplacianCount) - (laplacianSum / Math.max(1, laplacianCount)) ** 2)
  )
  const glare = clipped / count

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
  const fallback = cloneCanvas(source)
  const fallbackQuality = assessImageQuality(fallback)
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
      if (!best || best.score < 0.33) return { canvas: fallback, rectified: false, quality: fallbackQuality }

      const points = best.points.map((point) => ({ x: point.x / scale, y: point.y / scale }))
      const sourcePoints = orderPoints(points)
      if (!sourcePoints) return { canvas: fallback, rectified: false, quality: fallbackQuality }
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
    return { canvas: fallback, rectified: false, quality: fallbackQuality }
  }
}
