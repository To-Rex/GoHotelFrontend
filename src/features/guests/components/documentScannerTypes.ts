/**
 * Common document-recognition types.
 *
 * Keep the recognition metadata with the result instead of treating every OCR
 * string as equally trustworthy.  Booking screens can still consume the
 * familiar guest fields while the scanner uses the metadata to decide whether
 * it may finish automatically or must ask the operator to check the values.
 */

export type DocumentType = "PASSPORT" | "ID_CARD"

export type DocumentSide = "passport" | "front" | "back"

export type ScanSource = "mrz" | "visual" | "merged"

export type ScannedField =
  | "firstName"
  | "lastName"
  | "birthDate"
  | "documentNumber"
  | "personalNumber"
  | "nationality"

/** Bitta tekshiruv natijasi (serverdan keladi). */
export interface DocumentCheck {
  key: string
  label: string
  /** ok — tasdiqlandi; warn — e'tibor talab qiladi; fail — hujjat tasdiqlanmaydi */
  status: "ok" | "warn" | "fail"
  detail?: string
}

export interface ScannedDoc {
  firstName?: string
  lastName?: string
  birthDate?: string // yyyy-MM-dd
  documentNumber?: string
  /** Only set for a PINFL/JSHSHIR that passed Uzbekistan-specific checks. */
  personalNumber?: string
  documentType?: DocumentType
  nationality?: string // ICAO 3-letter code where available
  issuingCountry?: string
  /** TD1 / TD2 / TD3, when the result came from an MRZ. */
  mrzFormat?: "TD1" | "TD2" | "TD3"
  source?: ScanSource
  /** True only when a complete MRZ validated without OCR autocorrection. */
  verified?: boolean
  /** The UI must make the operator review this result before using it. */
  requiresReview?: boolean
  /** A JSHSHIR/PINFL was recognized in an Uzbek-specific context. */
  pinflVerified?: boolean
  /** Uzbekistan ID-back QR included a value that corroborates MRZ fields. */
  qrConfirmed?: boolean
  scannedSides?: DocumentSide[]
  warnings?: string[]
  fieldConfidence?: Partial<Record<ScannedField, number>>
  /** Natija qayerda hisoblangan: serverdagi PP-OCR yoki qurilmadagi OCR. */
  engine?: "server" | "device"
  /**
   * Serverda bajarilgan nomli tekshiruvlar. Yagona "ishonavering" bayrog'i
   * o'rniga xodim aynan nima tasdiqlanganini va nima shubhali ekanini ko'radi.
   */
  checks?: DocumentCheck[]
  /** Faqat serverdan: MRZ'dagi muddat va jins (formani to'ldirmaydi). */
  expiryDate?: string
  sex?: "M" | "F"
}

export interface RecognitionResult {
  doc: ScannedDoc
  score: number
  verified: boolean
  requiresReview: boolean
  source: ScanSource
}

const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate()

/**
 * PINFL has no public check digit that the browser can verify.  This validates
 * its documented shape and embedded date so arbitrary international optional
 * MRZ data is never mistaken for a JSHSHIR.
 */
export function isLikelyUzbekPinfl(value?: string | null): value is string {
  if (!value || !/^\d{14}$/.test(value)) return false
  const centurySex = Number(value[0])
  if (centurySex < 1 || centurySex > 6) return false
  const day = Number(value.slice(1, 3))
  const month = Number(value.slice(3, 5))
  const yearShort = Number(value.slice(5, 7))
  const year = centurySex <= 2 ? 1800 + yearShort : centurySex <= 4 ? 1900 + yearShort : 2000 + yearShort
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)
}

export function pinflBirthDate(value?: string | null): string | undefined {
  if (!isLikelyUzbekPinfl(value)) return undefined
  const centurySex = Number(value[0])
  const year = (centurySex <= 2 ? 1800 : centurySex <= 4 ? 1900 : 2000) + Number(value.slice(5, 7))
  return `${year}-${value.slice(3, 5)}-${value.slice(1, 3)}`
}

export function mergeScannedDocs(
  first: ScannedDoc | undefined,
  second: ScannedDoc | undefined
): ScannedDoc | undefined {
  if (!first) return second
  if (!second) return first

  const warnings = new Set([...(first.warnings ?? []), ...(second.warnings ?? [])])
  const compare = (field: keyof Pick<ScannedDoc, "documentNumber" | "birthDate" | "personalNumber">) => {
    if (first[field] && second[field] && first[field] !== second[field]) {
      warnings.add(`${field} ikki tomonda mos kelmadi`)
    }
  }
  compare("documentNumber")
  compare("birthDate")
  compare("personalNumber")

  // MRZ values have check digits and therefore take precedence over visual OCR.
  const primary = second.source === "mrz" ? second : first.source === "mrz" ? first : second
  const secondary = primary === first ? second : first
  const fieldConfidence = { ...secondary.fieldConfidence, ...primary.fieldConfidence }
  const verified = Boolean(first.verified || second.verified) && warnings.size === 0

  return {
    ...secondary,
    ...primary,
    source: "merged",
    verified,
    requiresReview: !verified || warnings.size > 0 || Boolean(first.requiresReview || second.requiresReview),
    scannedSides: Array.from(new Set([...(first.scannedSides ?? []), ...(second.scannedSides ?? [])])),
    warnings: Array.from(warnings),
    fieldConfidence,
  }
}
