import { afterEach, describe, expect, it, vi } from "vitest"
import { assessImageQuality } from "./documentVision"

type Pixel = readonly [red: number, green: number, blue: number]

class TestCanvas {
  width = 1
  height = 1
  pixels = new Uint8ClampedArray(4)

  getContext() {
    return {
      drawImage: (source: TestCanvas) => {
        this.pixels = source.pixels
      },
      getImageData: () => ({ data: this.pixels }),
    }
  }
}

function canvasWithPixels(width: number, height: number, pixelAt: (x: number, y: number) => Pixel) {
  const canvas = new TestCanvas()
  canvas.width = width
  canvas.height = height
  canvas.pixels = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [red, green, blue] = pixelAt(x, y)
      const offset = (y * width + x) * 4
      canvas.pixels[offset] = red
      canvas.pixels[offset + 1] = green
      canvas.pixels[offset + 2] = blue
      canvas.pixels[offset + 3] = 255
    }
  }
  return canvas as unknown as HTMLCanvasElement
}

function installCanvasDocument() {
  vi.stubGlobal("document", {
    createElement: () => new TestCanvas(),
  })
}

afterEach(() => vi.unstubAllGlobals())

describe("camera frame quality gate", () => {
  it("selects a detailed, well-lit frame over a uniform blurry frame", () => {
    installCanvasDocument()
    const blurry = assessImageQuality(canvasWithPixels(80, 60, () => [140, 140, 140]))
    const detailed = assessImageQuality(
      canvasWithPixels(80, 60, (x, y) => ((x + y) % 2 === 0 ? [30, 30, 30] : [225, 225, 225]))
    )

    expect(blurry.usable).toBe(false)
    expect(blurry.hint).toContain("Fokus past")
    expect(detailed.usable).toBe(true)
    expect(detailed.score).toBeGreaterThan(blurry.score)
    expect(detailed.sharpness).toBeGreaterThan(blurry.sharpness)
  })

  it("gives an actionable glare/exposure hint for a sharp but over-bright frame", () => {
    installCanvasDocument()
    const overBright = assessImageQuality(
      canvasWithPixels(80, 60, (x) => (x % 2 === 0 ? [250, 250, 250] : [255, 255, 255]))
    )

    expect(overBright.brightness).toBeGreaterThan(230)
    expect(overBright.hint).toContain("Yaltirash")
    expect(overBright.score).toBeLessThan(0.48)
  })
})
