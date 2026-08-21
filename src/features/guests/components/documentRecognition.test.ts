import { describe, expect, it } from "vitest"
import { isLikelyUzbekPinfl, mergeScannedDocs } from "./documentScannerTypes"
import { extractMrzCandidates, mrzBirthDateToIso, parseMrzText } from "./mrzParser"
import { FieldAccumulator } from "./visualDocParser"

const TD1 = [
  "I<GBRD23145890<1233<<<<<<<<<<<",
  "7408122F1204159GBR<<<<<<<<<<<2",
  "ERIKSSON<<ANNA<MARIA<<<<<<<<<<",
].join("\n")

const TD2 = [
  "I<GBRERIKSSON<<ANNA<MARIA<<<<<<<<<<<",
  "D231458907GBR7408122F1204159<<<<<<<6",
].join("\n")

const TD3 = [
  "P<GBRERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<",
  "L898902C36GBR7408122F1204159ZE184226B<<<<<10",
].join("\n")

const UZBEK_TD1_WITH_PINFL = [
  "I<UZBAA1234567831503900010015<",
  "9003152F3501014UZB<<<<<<<<<<<0",
  "KARIMOV<<ALI<<<<<<<<<<<<<<<<<<",
].join("\n")

describe("MRZ recognition safety", () => {
  it.each([
    ["TD1", TD1, "TD1"],
    ["TD2", TD2, "TD2"],
    ["TD3", TD3, "TD3"],
  ])("recognizes a fully verified %s document", (_label, input, format) => {
    const result = parseMrzText(input, "ID_CARD")

    expect(result?.verified).toBe(true)
    expect(result?.doc.mrzFormat).toBe(format)
    expect(result?.doc.documentNumber).toBeTruthy()
    expect(result?.doc.birthDate).toBe("1974-08-12")
  })

  it("does not turn generic TD1 optional data into a JSHSHIR", () => {
    const result = parseMrzText(TD1, "ID_CARD")

    expect(result?.doc.personalNumber).toBeUndefined()
    expect(result?.doc.pinflVerified).toBeUndefined()
  })

  it("accepts a structurally valid UZB PINFL from a TD1 optional field", () => {
    const result = parseMrzText(UZBEK_TD1_WITH_PINFL, "ID_CARD")

    expect(result?.verified).toBe(true)
    expect(result?.doc.personalNumber).toBe("31503900010015")
    expect(result?.doc.pinflVerified).toBe(true)
  })

  it("never accepts malformed MRZ row lengths by padding or truncating", () => {
    expect(extractMrzCandidates(`${TD3.slice(0, -1)}\n`)).toEqual([])
    expect(parseMrzText(`${TD3.slice(0, -1)}\n`)).toBeNull()
  })

  it("keeps a bad check digit out of the auto-accept path", () => {
    const result = parseMrzText(`${TD3.slice(0, -1)}1`, "PASSPORT")

    expect(result?.verified).toBe(false)
    expect(result?.requiresReview).toBe(true)
    expect(result?.doc.requiresReview).toBe(true)
  })

  it("rejects impossible and future MRZ birth dates", () => {
    expect(mrzBirthDateToIso("990231")).toBeUndefined()
    expect(mrzBirthDateToIso("990101")).toBe("1999-01-01")
  })
})

describe("visual recognition confidence", () => {
  it("requires two independent sources rather than a single high-confidence pass", () => {
    const accumulator = new FieldAccumulator("ID_CARD")
    accumulator.addField("documentNumber", "AA1234567", 4, "frame-1")

    expect(accumulator.sourceCount("documentNumber")).toBe(1)
    expect(accumulator.agreedCount).toBe(0)

    accumulator.addField("documentNumber", "AA1234567", 1, "frame-2")
    expect(accumulator.sourceCount("documentNumber")).toBe(2)
    expect(accumulator.agreedCount).toBe(1)
  })
})

describe("Uzbek ID safety", () => {
  it("validates the PINFL shape and embedded date", () => {
    expect(isLikelyUzbekPinfl("31503900010015")).toBe(true)
    expect(isLikelyUzbekPinfl("53102900010015")).toBe(false)
    expect(isLikelyUzbekPinfl("12345678901234")).toBe(false)
  })

  it("merges a front visual scan with a verified back MRZ scan", () => {
    const merged = mergeScannedDocs(
      {
        documentType: "ID_CARD",
        firstName: "Anna",
        lastName: "Eriksson",
        source: "visual",
        requiresReview: true,
        scannedSides: ["front"],
      },
      {
        documentType: "ID_CARD",
        birthDate: "1974-08-12",
        documentNumber: "AA1234567",
        source: "mrz",
        verified: true,
        scannedSides: ["back"],
      }
    )

    expect(merged).toMatchObject({
      firstName: "Anna",
      documentNumber: "AA1234567",
      source: "merged",
      scannedSides: ["front", "back"],
    })
    expect(merged?.requiresReview).toBe(true)
  })

  it("marks conflicting data from the two ID-card sides for review", () => {
    const merged = mergeScannedDocs(
      { documentNumber: "AA1234567", source: "visual", scannedSides: ["front"] },
      { documentNumber: "AB1234567", source: "mrz", verified: true, scannedSides: ["back"] }
    )

    expect(merged?.verified).toBe(false)
    expect(merged?.requiresReview).toBe(true)
    expect(merged?.warnings).toContain("documentNumber ikki tomonda mos kelmadi")
  })
})
