import { parse } from "mrz"
import type { DocumentType, RecognitionResult, ScannedDoc } from "./documentScannerTypes"
import { isLikelyUzbekPinfl } from "./documentScannerTypes"

type MrzFormat = "TD1" | "TD2" | "TD3"

const SPECS: ReadonlyArray<{ format: MrzFormat; rows: number; width: number }> = [
  { format: "TD1", rows: 3, width: 30 },
  { format: "TD2", rows: 2, width: 36 },
  { format: "TD3", rows: 2, width: 44 },
]

const clean = (value?: string | null) => {
  if (!value) return undefined
  const normalized = value.replace(/</g, " ").replace(/\s+/g, " ").trim()
  return normalized || undefined
}

const titleCase = (value?: string | null) =>
  clean(value)
    ?.toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ")

/** Parse YYMMDD without allowing dates such as 31 February or future births. */
export function mrzBirthDateToIso(value?: string | null): string | undefined {
  if (!value || !/^\d{6}$/.test(value)) return undefined
  const yy = Number(value.slice(0, 2))
  const month = Number(value.slice(2, 4))
  const day = Number(value.slice(4, 6))
  if (month < 1 || month > 12 || day < 1) return undefined

  const today = new Date()
  let year = 2000 + yy
  const candidate = new Date(year, month - 1, day)
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return undefined
  }
  if (candidate > today) year -= 100
  const checked = new Date(year, month - 1, day)
  if (
    checked.getFullYear() !== year ||
    checked.getMonth() !== month - 1 ||
    checked.getDate() !== day
  ) {
    return undefined
  }
  return `${year}-${value.slice(2, 4)}-${value.slice(4, 6)}`
}

/**
 * Keep only exact ICAO-length rows.  The old implementation padded/truncated
 * OCR output, which can manufacture a plausibly parsed but wrong document.
 */
export function extractMrzCandidates(text: string): string[][] {
  const rawLines = text
    .split(/\r?\n/)
    .map((line) => line.toUpperCase().replace(/[^A-Z0-9<]/g, ""))
    .filter((line) => line.length >= 20)

  // OCR sometimes returns the MRZ as one uninterrupted exact block.  Build a
  // separate list: mutating an array while iterating it can accidentally use
  // a synthetic row as input for a later format.
  const expandedLines = [...rawLines]
  for (const spec of SPECS) {
    const joinedLength = spec.rows * spec.width
    for (const line of rawLines) {
      if (line.length === joinedLength) {
        expandedLines.push(
          ...Array.from({ length: spec.rows }, (_, index) =>
            line.slice(index * spec.width, (index + 1) * spec.width)
          )
        )
      }
    }
  }

  const candidates: string[][] = []
  const seen = new Set<string>()
  for (const spec of SPECS) {
    for (let index = 0; index <= expandedLines.length - spec.rows; index++) {
      const rows = expandedLines.slice(index, index + spec.rows)
      if (!rows.every((row) => row.length === spec.width)) continue
      const key = rows.join("\n")
      if (!seen.has(key)) {
        seen.add(key)
        candidates.push(rows)
      }
    }
  }
  return candidates
}

function isUzbekMrz(fields: Record<string, unknown>): boolean {
  const issuer = typeof fields.issuingState === "string" ? fields.issuingState : ""
  const nationality = typeof fields.nationality === "string" ? fields.nationality : ""
  return issuer === "UZB" || nationality === "UZB"
}

/**
 * TD3 names this field `personalNumber`, while many TD1/TD2 identity cards
 * carry country-specific optional data instead.  Treat it as PINFL only for a
 * UZB document and only when the complete optional field has the 14-digit
 * PINFL shape.  Never infer a JSHSHIR from a foreign optional MRZ field.
 */
function extractUzbekPinfl(fields: Record<string, unknown>): string | undefined {
  if (!isUzbekMrz(fields)) return undefined
  for (const field of ["personalNumber", "optional1", "optional2", "optional"]) {
    const value = fields[field]
    if (typeof value !== "string") continue
    const compact = value.replace(/[<\s]/g, "")
    if (isLikelyUzbekPinfl(compact)) return compact
  }
  return undefined
}

function scoreMrz(parsed: any, autocorrected: boolean) {
  const details = Array.isArray(parsed?.details) ? parsed.details : []
  const checkDetails = details.filter((detail: any) =>
    typeof detail?.field === "string" && detail.field.endsWith("CheckDigit")
  )
  const validChecks = checkDetails.filter((detail: any) => detail.valid === true).length
  const invalidChecks = checkDetails.filter((detail: any) => detail.valid !== true).length
  return (parsed?.valid ? 80 : 25) + validChecks * 5 - invalidChecks * 7 - (autocorrected ? 14 : 0)
}

/**
 * Parse TD1, TD2 and TD3 MRZ results.  A result may be useful but unverified;
 * callers must show it for manual review rather than auto-filling a booking.
 */
export function parseMrzText(text: string, expectedType?: DocumentType): RecognitionResult | null {
  let best: RecognitionResult | null = null
  for (const rows of extractMrzCandidates(text)) {
    try {
      const parsed = parse(rows, { autocorrect: true }) as any
      const fields = (parsed?.fields ?? {}) as Record<string, unknown>
      const format = parsed?.format as MrzFormat | undefined
      if (!format || !["TD1", "TD2", "TD3"].includes(format)) continue

      const documentNumber = clean(
        typeof parsed?.documentNumber === "string" ? parsed.documentNumber : (fields.documentNumber as string)
      )?.replace(/\s+/g, "")
      const birthDate = mrzBirthDateToIso(fields.birthDate as string)
      const firstName = titleCase(fields.firstName as string)
      const lastName = titleCase(fields.lastName as string)
      if (!documentNumber || !birthDate || !lastName) continue

      const autocorrected = (parsed?.details ?? []).some(
        (detail: any) => Array.isArray(detail?.autocorrect) && detail.autocorrect.length > 0
      )
      const verified = parsed?.valid === true && !autocorrected
      const issuer = clean(fields.issuingState as string)?.toUpperCase()
      const nationality = clean(fields.nationality as string)?.toUpperCase()
      const rawPersonal = clean(fields.personalNumber as string)?.replace(/\s+/g, "")
      const pinfl = extractUzbekPinfl(fields)
      const pinflVerified = Boolean(pinfl)
      const warnings: string[] = []
      if (autocorrected) warnings.push("MRZ OCR belgilarini tuzatdi — tekshirib tasdiqlang")
      if (!parsed?.valid) warnings.push("MRZ nazorat raqamlari to‘liq tasdiqlanmadi")
      if (!pinflVerified && rawPersonal) {
        warnings.push("MRZ ixtiyoriy raqami JSHSHIR sifatida qo‘llanmadi")
      }

      const doc: ScannedDoc = {
        firstName,
        lastName,
        birthDate,
        documentNumber,
        ...(pinflVerified ? { personalNumber: pinfl, pinflVerified: true } : {}),
        documentType: format === "TD3" ? "PASSPORT" : expectedType ?? "ID_CARD",
        nationality,
        issuingCountry: issuer,
        mrzFormat: format,
        source: "mrz",
        verified,
        requiresReview: !verified,
        scannedSides: [format === "TD3" ? "passport" : "back"],
        warnings,
        fieldConfidence: {
          firstName: verified ? 1 : 0.65,
          lastName: verified ? 1 : 0.72,
          birthDate: verified ? 1 : 0.78,
          documentNumber: verified ? 1 : 0.8,
          ...(pinflVerified ? { personalNumber: verified ? 1 : 0.7 } : {}),
          nationality: verified ? 1 : 0.7,
        },
      }
      const result: RecognitionResult = {
        doc,
        score: scoreMrz(parsed, autocorrected),
        verified,
        requiresReview: !verified,
        source: "mrz",
      }
      if (!best || result.score > best.score) best = result
    } catch {
      // An unsupported or malformed candidate is not a document result.
    }
  }
  return best
}
