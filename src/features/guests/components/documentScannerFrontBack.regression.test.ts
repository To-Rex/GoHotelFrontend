import { describe, expect, it } from "vitest"
import { mergeScannedDocs } from "./documentScannerTypes"

describe("ID-card front/back recognition flow", () => {
  it("combines a clean front scan and a verified MRZ back scan into one accepted ID card", () => {
    const merged = mergeScannedDocs(
      {
        documentType: "ID_CARD",
        firstName: "Akrom",
        lastName: "Ikramov",
        birthDate: "1988-09-11",
        documentNumber: "AA45645682",
        source: "visual",
        requiresReview: false,
        scannedSides: ["front"],
      },
      {
        documentType: "ID_CARD",
        firstName: "Akrom",
        lastName: "Ikramov",
        birthDate: "1988-09-11",
        documentNumber: "AA45645682",
        personalNumber: "31503900010015",
        pinflVerified: true,
        source: "mrz",
        verified: true,
        requiresReview: false,
        scannedSides: ["back"],
      }
    )

    expect(merged).toMatchObject({
      documentType: "ID_CARD",
      source: "merged",
      verified: true,
      requiresReview: false,
      documentNumber: "AA45645682",
      personalNumber: "31503900010015",
      pinflVerified: true,
    })
    expect(merged?.scannedSides).toEqual(["front", "back"])
  })

  it("keeps the checked MRZ value but blocks automatic acceptance when the two sides disagree", () => {
    const merged = mergeScannedDocs(
      {
        documentType: "ID_CARD",
        documentNumber: "AA45645682",
        source: "visual",
        scannedSides: ["front"],
      },
      {
        documentType: "ID_CARD",
        documentNumber: "AA45645692",
        source: "mrz",
        verified: true,
        scannedSides: ["back"],
      }
    )

    expect(merged).toMatchObject({
      documentNumber: "AA45645692",
      source: "merged",
      verified: false,
      requiresReview: true,
    })
    expect(merged?.warnings).toContain("documentNumber ikki tomonda mos kelmadi")
  })

  it("does not duplicate a side when a result is retried before merge", () => {
    const merged = mergeScannedDocs(
      { source: "visual", scannedSides: ["front", "front"] },
      { source: "mrz", verified: true, scannedSides: ["back", "back"] }
    )

    expect(merged?.scannedSides).toEqual(["front", "back"])
  })
})
