import { afterEach, describe, expect, it, vi } from "vitest"
import { probeVideoFrame, type FrameProbe, type GuideRegion } from "./documentVision"

type Pixel = readonly [red: number, green: number, blue: number]

// The probe downsamples to 320px wide.  Feeding it an already 4:3, 320px frame
// keeps the stub a pure 1:1 pixel copy, so the assertions below measure the
// detector rather than an interpolation artefact.
const WIDTH = 320
const HEIGHT = 240

/** ID-card guide produced by the scanner for a 4:3 viewport. */
const GUIDE: GuideRegion = { left: 0.06, right: 0.94, top: 0.13, bottom: 0.87 }

class TestCanvas {
  width = 1
  height = 1
  pixels = new Uint8ClampedArray(4)

  getContext() {
    return {
      drawImage: (source: { pixels: Uint8ClampedArray<ArrayBuffer> }) => {
        this.pixels = source.pixels
      },
      getImageData: () => ({ data: this.pixels }),
    }
  }
}

function installCanvasDocument() {
  vi.stubGlobal("document", { createElement: () => new TestCanvas() })
}

function frameWith(pixelAt: (x: number, y: number) => Pixel): HTMLVideoElement {
  const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4)
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const [red, green, blue] = pixelAt(x, y)
      const offset = (y * WIDTH + x) * 4
      pixels[offset] = red
      pixels[offset + 1] = green
      pixels[offset + 2] = blue
      pixels[offset + 3] = 255
    }
  }
  return { videoWidth: WIDTH, videoHeight: HEIGHT, pixels } as unknown as HTMLVideoElement
}

const insideGuide = (x: number, y: number) =>
  x >= GUIDE.left * WIDTH && x < GUIDE.right * WIDTH && y >= GUIDE.top * HEIGHT && y < GUIDE.bottom * HEIGHT

const PORTRAIT_EDGE = GUIDE.left * WIDTH + (GUIDE.right - GUIDE.left) * WIDTH * 0.3

/**
 * A card is a portrait beside printed lines.  The strokes are two pixels wide
 * because a one-pixel checkerboard is invisible to a central-difference
 * gradient — a fixture artefact, not something a real document produces.
 */
function cardPixel(x: number, y: number, lineOffset = 0): Pixel {
  if (!insideGuide(x, y)) return [150, 150, 150]
  if (x < PORTRAIT_EDGE) {
    return Math.floor(x / 3) % 2 === Math.floor(y / 3) % 2 ? [60, 60, 60] : [200, 200, 200]
  }
  const onTextLine = (y + lineOffset) % 8 < 4
  const onStroke = x % 4 < 2
  return onTextLine && onStroke ? [30, 30, 30] : [235, 235, 235]
}

const printedCard = frameWith((x, y) => cardPixel(x, y))

const emptyDesk = frameWith(() => [150, 150, 150])

/** One dark object spans only part of the guide and must not trigger capture. */
const singleObject = frameWith((x, y) =>
  x > WIDTH * 0.42 && x < WIDTH * 0.58 && y > HEIGHT * 0.42 && y < HEIGHT * 0.58 ? [20, 20, 20] : [150, 150, 150]
)

afterEach(() => vi.unstubAllGlobals())

describe("live document detection", () => {
  it("reports a document when printed structure fills the capture guide", () => {
    installCanvasDocument()
    const probe = probeVideoFrame(printedCard, GUIDE)

    expect(probe.document.present).toBe(true)
    expect(probe.document.coverage).toBeGreaterThan(0.9)
    expect(probe.quality.usable).toBe(true)
  })

  it("does not report a document for an empty background", () => {
    installCanvasDocument()
    const probe = probeVideoFrame(emptyDesk, GUIDE)

    expect(probe.document.present).toBe(false)
    expect(probe.document.detail).toBeLessThan(0.01)
  })

  it("does not mistake a single object for a document that fills the guide", () => {
    installCanvasDocument()
    const probe = probeVideoFrame(singleObject, GUIDE)

    expect(probe.document.coverage).toBeLessThan(0.5)
    expect(probe.document.present).toBe(false)
  })
})

describe("auto-shutter steadiness", () => {
  it("treats an unchanged view as steady so a capture is not smeared", () => {
    installCanvasDocument()
    const first = probeVideoFrame(printedCard, GUIDE)
    const second = probeVideoFrame(printedCard, GUIDE, first)

    expect(second.document.motion).toBe(0)
    expect(second.document.steady).toBe(true)
  })

  it("refuses to call a moving view steady", () => {
    installCanvasDocument()
    const first: FrameProbe = probeVideoFrame(printedCard, GUIDE)
    const shifted = frameWith((x, y) => cardPixel(x, y, 2))
    const second = probeVideoFrame(shifted, GUIDE, first)

    expect(second.document.motion).toBeGreaterThan(5)
    expect(second.document.steady).toBe(false)
  })

  it("never measures motion against the buffer it is currently filling", () => {
    installCanvasDocument()
    const first = probeVideoFrame(printedCard, GUIDE)
    const second = probeVideoFrame(emptyDesk, GUIDE, first)

    // A shared buffer would make the comparison read already-overwritten
    // pixels and silently report a still frame.
    expect(second.gray).not.toBe(first.gray)
    expect(second.document.motion).toBeGreaterThan(5)
  })
})
