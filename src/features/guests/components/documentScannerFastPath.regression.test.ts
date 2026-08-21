import { describe, expect, it } from "vitest"
import { type ImageQuality, selectBestQualityFrame } from "./documentVision"
import { FieldAccumulator } from "./visualDocParser"

function quality(overrides: Partial<ImageQuality> = {}): ImageQuality {
  return {
    score: 0.66,
    sharpness: 20,
    brightness: 145,
    contrast: 30,
    glare: 0.05,
    usable: true,
    hint: "OK",
    ...overrides,
  }
}

describe("fast live-frame selection", () => {
  it("uses the best admissible frame instead of the most recently captured one", () => {
    const selected = selectBestQualityFrame([
      { value: "soft", quality: quality({ score: 0.5, sharpness: 10, contrast: 20 }), capturedAt: 100 },
      { value: "sharp", quality: quality({ score: 0.7, sharpness: 31, contrast: 38 }), capturedAt: 200 },
      { value: "newer-but-weaker", quality: quality({ score: 0.58, sharpness: 15, contrast: 24 }), capturedAt: 300 },
    ])

    expect(selected?.value).toBe("sharp")
  })

  it("uses the newer frame only when quality ranking is exactly tied", () => {
    const frameQuality = quality()
    const selected = selectBestQualityFrame([
      { value: "first", quality: frameQuality, capturedAt: 100 },
      { value: "second", quality: { ...frameQuality }, capturedAt: 200 },
    ])

    expect(selected?.value).toBe("second")
  })
})

describe("fast visual OCR consensus", () => {
  it("does not treat two OCR passages from a single camera frame as independent evidence", () => {
    const fields = new FieldAccumulator("ID_CARD")
    for (const [field, value] of [
      ["firstName", "Akrom"],
      ["lastName", "Ikramov"],
      ["birthDate", "1988-09-11"],
      ["documentNumber", "AA4564568"],
    ] as const) {
      fields.addField(field, value, 10, "fast-frame-1")
      fields.addField(field, value, 10, "fast-frame-1")
    }

    expect(fields.isComplete()).toBe(true)
    expect(fields.isConfirmedComplete()).toBe(false)
  })

  it("does not auto-confirm a visual document when the second camera frame disagrees on its ID number", () => {
    const fields = new FieldAccumulator("ID_CARD")
    const firstFrame = {
      firstName: "Akrom",
      lastName: "Ikramov",
      birthDate: "1988-09-11",
      documentNumber: "AA4564568",
    }
    const secondFrame = { ...firstFrame, documentNumber: "AA4564569" }

    for (const [field, value] of Object.entries(firstFrame)) fields.addField(field as never, value, 5, "fast-frame-1")
    for (const [field, value] of Object.entries(secondFrame)) fields.addField(field as never, value, 5, "fast-frame-2")

    expect(fields.isConfirmed("documentNumber")).toBe(false)
    expect(fields.isConfirmedComplete()).toBe(false)
  })
})
