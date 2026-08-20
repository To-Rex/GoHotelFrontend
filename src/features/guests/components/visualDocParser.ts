/**
 * Hujjatning OLD TOMONIDAGI yozuvlardan ma'lumot ajratish (vizual rejim).
 *
 * MRZ rejimidan farqi: bu yerda nazorat raqamlari yo'q, shuning uchun
 * har bir maydon o'z ishonch bahosi bilan chiqadi va faqat ishonchli
 * topilganlari qaytariladi. O'zbekiston ID kartasi va pasporti (hamda
 * ko'p xalqaro hujjatlar) old tomonida maydonlar ikki tilli yorliqlar
 * bilan yoziladi: "FAMILIYASI / SURNAME", "ISMI / GIVEN NAMES" va h.k.
 */
import type { ScannedDoc } from "./DocumentScanner"

/** Yorliqlar — o'zbekcha (lotin/kirill) va inglizcha variantlari */
const LABELS = {
  lastName: [
    "FAMILIYASI",
    "FAMILIYA",
    "SURNAME",
    "FAMILY NAME",
    "ФАМИЛИЯСИ",
    "ФАМИЛИЯ",
  ],
  firstName: [
    "ISMI",
    "ISM",
    "GIVEN NAME",
    "GIVEN NAMES",
    "FIRST NAME",
    "ИСМИ",
    "ИМЯ",
  ],
  birthDate: [
    "TUGILGAN SANASI",
    "TUG'ILGAN SANASI",
    "TUGILGAN",
    "DATE OF BIRTH",
    "BIRTH",
    "ТУГИЛГАН",
    "ДАТА РОЖДЕНИЯ",
  ],
  personalNumber: ["JSHSHIR", "JSHIR", "PINFL", "PINPP", "ЖШШИР", "ПИНФЛ"],
  documentNumber: [
    "SERIYA",
    "RAQAMI",
    "DOCUMENT NO",
    "DOCUMENT NUMBER",
    "PASSPORT NO",
    "CARD NO",
    "НОМЕР",
  ],
  expiry: ["AMAL QILISH", "DATE OF EXPIRY", "EXPIRY", "ГОДЕН ДО"],
  issue: ["BERILGAN SANA", "DATE OF ISSUE", "ISSUE", "ВЫДАН"],
}

/** OCR tez-tez adashadigan belgilar — faqat RAQAM kutilgan joyda tuzatiladi */
const digitFixes: Record<string, string> = {
  O: "0",
  Q: "0",
  D: "0",
  I: "1",
  L: "1",
  Z: "2",
  S: "5",
  B: "8",
  G: "6",
}

const toDigits = (s: string): string =>
  s
    .toUpperCase()
    .split("")
    .map((ch) => (/\d/.test(ch) ? ch : digitFixes[ch] ?? ch))
    .join("")

/** Diakritik va bo'sh joylarni tozalab, yorliq solishtirishga tayyorlaydi */
const normalizeLabel = (s: string): string =>
  s
    .toUpperCase()
    .replace(/[''`´]/g, "")
    .replace(/[^A-ZА-Я0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const hasLabel = (line: string, variants: string[]): boolean => {
  const norm = normalizeLabel(line)
  return variants.some((v) => norm.includes(normalizeLabel(v)))
}

/** Ism/familiya bo'lishi mumkin bo'lgan qator (yorliq emas, raqam emas) */
const looksLikeName = (line: string): boolean => {
  const v = line.trim()
  if (v.length < 2 || v.length > 40) return false
  if (/\d/.test(v)) return false
  // Kamida 2 ta harf va faqat harf/bo'sh joy/tire/apostrof
  if (!/^[A-Za-zА-Яа-яЎЩҚҒҲЁ''`\- ]+$/.test(v)) return false
  // Yorliqning o'zi bo'lmasin
  const all = [
    ...LABELS.lastName,
    ...LABELS.firstName,
    ...LABELS.birthDate,
    ...LABELS.personalNumber,
    ...LABELS.documentNumber,
    ...LABELS.expiry,
    ...LABELS.issue,
    "RESPUBLIKASI",
    "REPUBLIC",
    "UZBEKISTAN",
    "OZBEKISTON",
    "PASSPORT",
    "IDENTITY",
    "CARD",
    "MILLATI",
    "NATIONALITY",
    "JINSI",
    "SEX",
    "GENDER",
    "PLACE OF BIRTH",
    "TUGILGAN JOYI",
    "AUTHORITY",
    "ORGAN",
  ]
  const norm = normalizeLabel(v)
  if (all.some((l) => norm === normalizeLabel(l))) return false
  return true
}

const titleCase = (s: string): string =>
  s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ")

/** DD.MM.YYYY / DD-MM-YYYY / DD MM YYYY → yyyy-MM-dd (mantiqiy tekshiruv bilan) */
function parseDate(raw: string): string | undefined {
  const m = raw.match(/(\d{2})\s*[.\-/ ]\s*(\d{2})\s*[.\-/ ]\s*(\d{4})/)
  if (!m) return undefined
  const [, dd, mm, yyyy] = m
  const d = Number(dd)
  const mo = Number(mm)
  const y = Number(yyyy)
  const nowYear = new Date().getFullYear()
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return undefined
  if (y < 1900 || y > nowYear + 20) return undefined
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Hujjat old tomonining OCR matnidan maydonlarni ajratadi.
 * Har maydon topilgani uchun ball beriladi — chaqiruvchi (skaner)
 * shu ball bo'yicha natijani qabul qiladi yoki keyingi kadrni kutadi.
 */
export function parseVisualDocument(
  text: string,
  docType: "PASSPORT" | "ID_CARD"
): { doc: ScannedDoc; score: number } | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0)
  if (!lines.length) return null

  const flat = lines.join("\n")
  const upper = flat.toUpperCase()
  const doc: ScannedDoc = { documentType: docType }
  let score = 0

  // --- Hujjat raqami: AA1234567 (passport) yoki ID karta seriyasi ---
  const docNoMatch =
    upper.match(/\b([A-Z]{2}\s?\d{7})\b/) || upper.match(/\b(\d{9})\b/)
  if (docNoMatch) {
    const cleaned = docNoMatch[1].replace(/\s/g, "")
    // Harfli prefiks bo'lsa — harflar, qolgani raqam bo'lishi kerak
    if (/^[A-Z]{2}/.test(cleaned)) {
      doc.documentNumber = cleaned.slice(0, 2) + toDigits(cleaned.slice(2))
    } else {
      doc.documentNumber = toDigits(cleaned)
    }
    score += 3
  }

  // --- JSHSHIR / PINFL: 14 raqam ---
  const pinMatch = upper.match(/\b(\d{14})\b/)
  if (pinMatch) {
    doc.personalNumber = pinMatch[1]
    score += 3
  } else {
    // Yorliqdan keyingi qatorda bo'lishi mumkin (raqamlar OCR'da adashgan)
    const idx = lines.findIndex((l) => hasLabel(l, LABELS.personalNumber))
    if (idx !== -1) {
      for (const cand of [lines[idx], lines[idx + 1] || ""]) {
        const digits = toDigits(cand).replace(/\D/g, "")
        if (digits.length === 14) {
          doc.personalNumber = digits
          score += 2
          break
        }
      }
    }
  }

  // --- Tug'ilgan sana: yorliq yaqinidagi sana, bo'lmasa eng erta sana ---
  const birthIdx = lines.findIndex((l) => hasLabel(l, LABELS.birthDate))
  if (birthIdx !== -1) {
    for (const cand of [lines[birthIdx], lines[birthIdx + 1] || ""]) {
      const parsed = parseDate(cand)
      if (parsed) {
        doc.birthDate = parsed
        score += 3
        break
      }
    }
  }
  if (!doc.birthDate) {
    // Hujjatdagi sanalar: tug'ilgan (eng erta), berilgan, amal muddati.
    // Yorliq o'qilmasa — eng erta sanani tug'ilgan sana deb olamiz
    const all = (flat.match(/\d{2}\s*[.\-/ ]\s*\d{2}\s*[.\-/ ]\s*\d{4}/g) || [])
      .map(parseDate)
      .filter((d): d is string => !!d)
      .sort()
    if (all.length) {
      doc.birthDate = all[0]
      score += 1
    }
  }

  // --- Familiya va ism: yorliqdan keyingi qatorlar ---
  const takeAfterLabel = (variants: string[]): string | undefined => {
    const i = lines.findIndex((l) => hasLabel(l, variants))
    if (i === -1) return undefined
    // Yorliq va qiymat bir qatorda bo'lishi ham mumkin: "SURNAME TOSHMATOV"
    const sameLine = lines[i]
      .replace(new RegExp(variants.join("|"), "gi"), "")
      .replace(/[/|:]/g, " ")
      .trim()
    if (looksLikeName(sameLine)) return sameLine
    for (const next of [lines[i + 1], lines[i + 2]]) {
      if (next && looksLikeName(next)) return next
    }
    return undefined
  }

  const last = takeAfterLabel(LABELS.lastName)
  if (last) {
    doc.lastName = titleCase(last)
    score += 2
  }
  const first = takeAfterLabel(LABELS.firstName)
  if (first) {
    doc.firstName = titleCase(first)
    score += 2
  }

  // --- Fuqarolik: 3 harfli kod (UZB, RUS...) yoki matnda O'zbekiston ---
  const natMatch = upper.match(/\b(UZB|RUS|KAZ|KGZ|TJK|TKM|AZE|UKR|TUR|USA|GBR|DEU|CHN|IND|KOR)\b/)
  if (natMatch) {
    doc.nationality = natMatch[1]
  } else if (/O.?ZBEKISTON|UZBEKISTAN|УЗБЕКИСТАН/.test(upper)) {
    doc.nationality = "UZB"
  }

  // Kamida hujjat raqami YOKI (ism + familiya) bo'lmasa — natija emas
  const hasCore =
    !!doc.documentNumber || !!doc.personalNumber || (!!doc.firstName && !!doc.lastName)
  if (!hasCore || score < 3) return null
  return { doc, score }
}
