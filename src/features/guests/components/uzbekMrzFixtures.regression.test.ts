import { describe, expect, it } from "vitest"
import { parseMrzText } from "./mrzParser"

// Synthetic ICAO-compliant examples.  They contain no real person's data.
const UZBEK_ID_TD1 = [
  "I<UZBAA1234567831503900010015<",
  "9003152F3501014UZB<<<<<<<<<<<0",
  "KARIMOV<<ALI<<<<<<<<<<<<<<<<<<",
].join("\n")

const UZBEK_PASSPORT_TD3 = [
  "P<UZBKARIMOV<<ALI<<<<<<<<<<<<<<<<<<<<<<<<<<<",
  "AA12345678UZB9003152M35010143150390001001560",
].join("\n")

describe("Uzbekistan MRZ fixtures", () => {
  it("extracts a validated PINFL from a UZB TD1 ID-card back", () => {
    const result = parseMrzText(UZBEK_ID_TD1, "ID_CARD")

    expect(result).toMatchObject({
      verified: true,
      source: "mrz",
      doc: {
        documentType: "ID_CARD",
        mrzFormat: "TD1",
        issuingCountry: "UZB",
        nationality: "UZB",
        birthDate: "1990-03-15",
        personalNumber: "31503900010015",
        pinflVerified: true,
        scannedSides: ["back"],
      },
    })
  })

  it("extracts PINFL from a UZB biometric passport TD3, including uninterrupted OCR output", () => {
    const result = parseMrzText(UZBEK_PASSPORT_TD3.replace("\n", ""), "PASSPORT")

    expect(result).toMatchObject({
      verified: true,
      doc: {
        documentType: "PASSPORT",
        mrzFormat: "TD3",
        documentNumber: "AA1234567",
        birthDate: "1990-03-15",
        personalNumber: "31503900010015",
        pinflVerified: true,
        scannedSides: ["passport"],
      },
    })
  })

  it("requires review when an MRZ check digit is damaged, while retaining the Uzbek PINFL candidate", () => {
    const damaged = `${UZBEK_PASSPORT_TD3.slice(0, -1)}1`
    const result = parseMrzText(damaged, "PASSPORT")

    expect(result?.verified).toBe(false)
    expect(result?.requiresReview).toBe(true)
    expect(result?.doc.pinflVerified).toBe(true)
  })
})
