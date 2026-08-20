/**
 * Hujjatning OLD TOMONIDAGI yozuvlardan ma'lumot ajratish (vizual rejim).
 *
 * Asosiy nishon — O'ZBEKISTON ID kartasi (ID-1) va biometrik pasporti.
 * Ularda maydonlar ikki tilli yorliq bilan yoziladi, masalan:
 *
 *   FAMILIYASI / SURNAME            ISMI / GIVEN NAMES
 *   TOSHMATOV                       JASUR
 *   TUG'ILGAN SANASI / DATE OF BIRTH        JSHSHIR / PINFL
 *   15.03.1990                              31503900010015
 *   ID KARTA RAQAMI / DOCUMENT No   AA1234567
 *
 * MRZ'dan farqi: nazorat raqamlari yo'q. Shuning uchun har maydon o'z
 * ishonch bahosi bilan chiqadi, bir necha kadr natijalari ovoz berish
 * (voting) bilan birlashtiriladi — chaqiruvchi shu bahoga qarab qaror qiladi.
 */
import type { ScannedDoc } from "./DocumentScanner"

/* ------------------------------------------------------------- yorliqlar */

/** Har maydon uchun yorliq variantlari: o'zbek lotin/kirill va ingliz */
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
    "GIVEN NAMES",
    "GIVEN NAME",
    "FIRST NAME",
    "FORENAMES",
    "ИСМИ",
    "ИМЯ",
  ],
  patronymic: [
    "OTASINING ISMI",
    "OTASINING ISM",
    "PATRONYMIC",
    "ОТАСИНИНГ ИСМИ",
    "ОТЧЕСТВО",
  ],
  birthDate: [
    "TUGILGAN SANASI",
    "TUGILGAN SANA",
    "DATE OF BIRTH",
    "BIRTH DATE",
    "ТУГИЛГАН САНАСИ",
    "ДАТА РОЖДЕНИЯ",
  ],
  personalNumber: [
    "JSHSHIR",
    "JSHIR",
    "PINFL",
    "PINPP",
    "PERSONAL NUMBER",
    "PERSONAL No",
    "ЖШШИР",
    "ПИНФЛ",
  ],
  documentNumber: [
    "ID KARTA RAQAMI",
    "KARTA RAQAMI",
    "PASPORT RAQAMI",
    "SERIYA VA RAQAMI",
    "SERIYA",
    "DOCUMENT No",
    "DOCUMENT NO",
    "DOCUMENT NUMBER",
    "PASSPORT No",
    "PASSPORT NO",
    "CARD No",
    "CARD NO",
    "НОМЕР ДОКУМЕНТА",
  ],
  expiry: [
    "AMAL QILISH MUDDATI",
    "AMAL QILISH",
    "DATE OF EXPIRY",
    "EXPIRY",
    "ГОДЕН ДО",
    "СРОК ДЕЙСТВИЯ",
  ],
  issue: [
    "BERILGAN SANASI",
    "BERILGAN SANA",
    "DATE OF ISSUE",
    "ВЫДАН",
    "ДАТА ВЫДАЧИ",
  ],
  sex: ["JINSI", "SEX", "GENDER", "ЖИНСИ", "ПОЛ"],
  nationality: [
    "MILLATI",
    "NATIONALITY",
    "FUQAROLIGI",
    "CITIZENSHIP",
    "МИЛЛАТИ",
    "ГРАЖДАНСТВО",
  ],
  authority: [
    "KIM TOMONIDAN BERILGAN",
    "BERGAN ORGAN",
    "AUTHORITY",
    "ISSUING AUTHORITY",
    "ОРГАН ВЫДАЧИ",
  ],
  birthPlace: [
    "TUGILGAN JOYI",
    "PLACE OF BIRTH",
    "ТУГИЛГАН ЖОЙИ",
    "МЕСТО РОЖДЕНИЯ",
  ],
}

/** Ism bo'lishi mumkin BO'LMAGAN so'zlar (hujjat sarlavhalari va yorliqlar) */
const STOP_WORDS = [
  "OZBEKISTON",
  "UZBEKISTAN",
  "RESPUBLIKASI",
  "REPUBLIC",
  "PASPORT",
  "PASSPORT",
  "IDENTITY",
  "CARD",
  "KARTA",
  "ID",
  "TYPE",
  "TURI",
  "CODE",
  "KOD",
  "MAMLAKAT",
  "COUNTRY",
  "SIGNATURE",
  "IMZO",
  "UZB",
  "ERKAK",
  "AYOL",
  "MALE",
  "FEMALE",
  "OZBEK",
  "RUS",
  "TOJIK",
  "QOZOQ",
  "QORAQALPOQ",
]

/* ---------------------------------------------------------- yordamchilar */

/** Solishtirish uchun normal shakl: diakritika, tinish belgilari olib tashlanadi */
const norm = (s: string): string =>
  s
    .toUpperCase()
    .replace(/['''`´ʻʼ]/g, "")
    .replace(/[ʼ']/g, "")
    .replace(/[^A-ZА-ЯЁ0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

/** Qatorda shu maydon yorlig'i bormi */
const hasLabel = (line: string, variants: string[]): boolean => {
  const n = norm(line)
  return variants.some((v) => n.includes(norm(v)))
}

/** OCR raqamlarda adashadigan harflar — FAQAT raqam kutilgan joyda */
const DIGIT_FIX: Record<string, string> = {
  O: "0",
  Q: "0",
  D: "0",
  U: "0",
  I: "1",
  L: "1",
  T: "1",
  Z: "2",
  E: "3",
  A: "4",
  S: "5",
  G: "6",
  B: "8",
  P: "9",
}

/** OCR harflarda adashadigan raqamlar — FAQAT harf kutilgan joyda */
const LETTER_FIX: Record<string, string> = {
  "0": "O",
  "1": "I",
  "4": "A",
  "5": "S",
  "6": "G",
  "8": "B",
}

const toDigits = (s: string): string =>
  s
    .toUpperCase()
    .split("")
    .map((ch) => (/\d/.test(ch) ? ch : DIGIT_FIX[ch] ?? ""))
    .join("")

const toLetters = (s: string): string =>
  s
    .toUpperCase()
    .split("")
    .map((ch) => (/[A-Z]/.test(ch) ? ch : LETTER_FIX[ch] ?? ""))
    .join("")

const titleCase = (s: string): string =>
  s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ")

/**
 * DD.MM.YYYY (yoki ajratgichsiz DDMMYYYY) → yyyy-MM-dd.
 * Mantiqiy tekshiruv: kun/oy chegarasi va oydagi kunlar soni.
 */
function parseDate(raw: string): string | undefined {
  const cleaned = raw.replace(/[OQD]/gi, "0").replace(/[IL]/gi, "1")
  const m =
    cleaned.match(/(\d{2})\s*[.\-/ ]\s*(\d{2})\s*[.\-/ ]\s*(\d{4})/) ||
    cleaned.match(/\b(\d{2})(\d{2})(\d{4})\b/)
  if (!m) return undefined
  const [, dd, mm, yyyy] = m
  const d = Number(dd)
  const mo = Number(mm)
  const y = Number(yyyy)
  const nowYear = new Date().getFullYear()
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return undefined
  if (y < 1900 || y > nowYear + 25) return undefined
  // Oydagi kunlar soni (kabisa yili hisobga olinadi)
  const days = new Date(y, mo, 0).getDate()
  if (d > days) return undefined
  return `${yyyy}-${mm}-${dd}`
}

/**
 * JSHSHIR (PINFL) — 14 raqam. Tuzilishi: 1-belgi jins+asr (1..6),
 * keyin DDMMYY tug'ilgan sana. Shu qoida bilan noto'g'ri o'qishni rad etamiz.
 */
function validatePinfl(digits: string): boolean {
  if (!/^\d{14}$/.test(digits)) return false
  const first = Number(digits[0])
  if (first < 1 || first > 6) return false
  const dd = Number(digits.slice(1, 3))
  const mm = Number(digits.slice(3, 5))
  return dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12
}

/** JSHSHIR ichidagi tug'ilgan sana (asr birinchi belgidan aniqlanadi) */
function birthDateFromPinfl(digits: string): string | undefined {
  if (!validatePinfl(digits)) return undefined
  const first = Number(digits[0])
  const dd = digits.slice(1, 3)
  const mm = digits.slice(3, 5)
  const yy = digits.slice(5, 7)
  // 1,2 — 1800-yillar; 3,4 — 1900; 5,6 — 2000
  const century = first <= 2 ? 1800 : first <= 4 ? 1900 : 2000
  const year = century + Number(yy)
  const iso = `${year}-${mm}-${dd}`
  return parseDate(`${dd}.${mm}.${year}`) ? iso : undefined
}

/** Qator ism/familiya bo'la oladimi */
function looksLikeName(line: string): boolean {
  const v = line.trim()
  if (v.length < 2 || v.length > 32) return false
  if (/\d/.test(v)) return false
  // O'zbek lotinidagi ' va ʻ belgilariga ruxsat (O'ROLOV, G'AFUROV)
  if (!/^[A-Za-zА-Яа-яЁёʻʼ''`\- ]+$/.test(v)) return false
  const n = norm(v)
  if (!n || n.length < 2) return false
  if (STOP_WORDS.includes(n)) return false
  // Yorliqning o'zi bo'lmasin
  for (const variants of Object.values(LABELS)) {
    if (variants.some((label) => norm(label) === n)) return false
  }
  // Kamida 2 ta harfli so'z bo'lishi kerak, uzun raqamli axlat emas
  return /[A-Za-zА-Яа-я]{2,}/.test(v)
}

/**
 * Yorliqdan keyingi qiymatni oladi.
 * Uch holat qo'llab-quvvatlanadi:
 *   1) "FAMILIYASI / SURNAME: TOSHMATOV"  — bitta qatorda
 *   2) "FAMILIYASI / SURNAME" / keyingi qatorda "TOSHMATOV"
 *   3) yorliq va qiymat orasida bo'sh/axlat qator bo'lsa — 2 qatorgacha qaraladi
 */
function valueAfterLabel(
  lines: string[],
  variants: string[],
  accept: (v: string) => boolean
): { value: string; lineIndex: number } | undefined {
  for (let i = 0; i < lines.length; i++) {
    if (!hasLabel(lines[i], variants)) continue
    // 1) shu qatorning o'zida yorliqdan keyin qolgan qism
    let rest = lines[i]
    for (const v of variants) {
      const re = new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")
      rest = rest.replace(re, " ")
    }
    rest = rest.replace(/[/|:.\-–—]/g, " ").replace(/\s+/g, " ").trim()
    if (rest && accept(rest)) return { value: rest, lineIndex: i }
    // 2-3) keyingi qatorlar
    for (let j = i + 1; j <= Math.min(i + 2, lines.length - 1); j++) {
      const cand = lines[j].trim()
      if (cand && accept(cand)) return { value: cand, lineIndex: j }
    }
  }
  return undefined
}

/* --------------------------------------------------------------- parser */

export interface VisualParseResult {
  doc: ScannedDoc
  score: number
  /** Har maydon alohida baho bilan — kadrlar bo'yicha ovoz berish uchun */
  fieldScores: Partial<Record<keyof ScannedDoc, number>>
}

export function parseVisualDocument(
  text: string,
  docType: "PASSPORT" | "ID_CARD"
): VisualParseResult | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0)
  if (!lines.length) return null

  const flat = lines.join("\n")
  const upper = flat.toUpperCase()
  const doc: ScannedDoc = { documentType: docType }
  const fieldScores: Partial<Record<keyof ScannedDoc, number>> = {}
  let score = 0

  const set = <K extends keyof ScannedDoc>(
    key: K,
    value: ScannedDoc[K],
    weight: number
  ) => {
    doc[key] = value
    fieldScores[key] = weight
    score += weight
  }

  /* --- JSHSHIR (PINFL): eng ishonchli maydon, o'z ichki tekshiruvi bor --- */
  let pinfl: string | undefined
  const labelled = valueAfterLabel(lines, LABELS.personalNumber, (v) => {
    const d = toDigits(v)
    return d.length === 14 && validatePinfl(d)
  })
  if (labelled) {
    pinfl = toDigits(labelled.value)
  } else {
    // Yorliqsiz: matndagi barcha 14 raqamli ketma-ketliklarni sinaymiz
    for (const m of upper.matchAll(/\b[\dOQDIULTZEASGBP]{14}\b/g)) {
      const d = toDigits(m[0])
      if (validatePinfl(d)) {
        pinfl = d
        break
      }
    }
  }
  if (pinfl) set("personalNumber", pinfl, 4)

  /* --- Hujjat raqami: AA1234567 (2 harf + 7 raqam) --- */
  const docLabelled = valueAfterLabel(lines, LABELS.documentNumber, (v) => {
    const c = v.replace(/[\s.\-]/g, "")
    return /^[A-Z0-9]{9}$/i.test(c)
  })
  let docNo: string | undefined
  const candidates: string[] = []
  if (docLabelled) candidates.push(docLabelled.value.replace(/[\s.\-]/g, ""))
  for (const m of upper.matchAll(/\b([A-Z]{2}\s?\d{7})\b/g)) candidates.push(m[1])
  for (const c of candidates) {
    const cleaned = c.replace(/\s/g, "").toUpperCase()
    if (cleaned.length !== 9) continue
    const prefix = toLetters(cleaned.slice(0, 2))
    const digits = toDigits(cleaned.slice(2))
    if (prefix.length === 2 && digits.length === 7) {
      docNo = prefix + digits
      break
    }
  }
  if (docNo) set("documentNumber", docNo, 4)

  /* --- Sanalar: yorliq bo'yicha, bo'lmasa mantiq bo'yicha --- */
  const birthLabelled = valueAfterLabel(
    lines,
    LABELS.birthDate,
    (v) => !!parseDate(v)
  )
  if (birthLabelled) {
    const parsed = parseDate(birthLabelled.value)
    if (parsed) set("birthDate", parsed, 4)
  }
  // JSHSHIR ichidagi sana — yorliqli sanani TASDIQLAYDI yoki o'rnini bosadi
  const pinflBirth = pinfl ? birthDateFromPinfl(pinfl) : undefined
  if (pinflBirth) {
    if (!doc.birthDate) {
      set("birthDate", pinflBirth, 4)
    } else if (doc.birthDate === pinflBirth) {
      // Ikki mustaqil manba bir xil — ishonch yuqori
      fieldScores.birthDate = (fieldScores.birthDate ?? 0) + 3
      score += 3
    } else {
      // Ziddiyat: JSHSHIR ishonchliroq (ichki tuzilishi tekshirilgan)
      set("birthDate", pinflBirth, 4)
    }
  }
  if (!doc.birthDate) {
    // Yorliqlar o'qilmadi: hujjatdagi sanalar — tug'ilgan (eng erta),
    // berilgan va amal muddati. Eng ertasi tug'ilgan sana bo'ladi.
    const all = Array.from(
      upper.matchAll(/\d{2}\s*[.\-/ ]\s*\d{2}\s*[.\-/ ]\s*\d{4}/g)
    )
      .map((m) => parseDate(m[0]))
      .filter((d): d is string => !!d)
      .sort()
    if (all.length) set("birthDate", all[0], 2)
  }

  /* --- Familiya, ism (va otasining ismi — ism bilan birga saqlanmaydi) --- */
  const last = valueAfterLabel(lines, LABELS.lastName, looksLikeName)
  if (last) set("lastName", titleCase(last.value), 3)
  const first = valueAfterLabel(lines, LABELS.firstName, looksLikeName)
  if (first) set("firstName", titleCase(first.value), 3)

  // Yorliqlar o'qilmagan bo'lsa: MRZ-siz hujjatlarda ism-familiya odatda
  // ketma-ket ikki qatorda, katta harflarda va sarlavhalardan keyin turadi
  if (!doc.lastName || !doc.firstName) {
    const nameLines = lines.filter(
      (l) => looksLikeName(l) && l === l.toUpperCase() && l.length >= 3
    )
    if (!doc.lastName && nameLines[0]) {
      set("lastName", titleCase(nameLines[0]), 1)
    }
    if (!doc.firstName && nameLines[1]) {
      set("firstName", titleCase(nameLines[1]), 1)
    }
  }

  /* --- Fuqarolik --- */
  const natMatch = upper.match(
    /\b(UZB|RUS|KAZ|KGZ|TJK|TKM|AZE|UKR|TUR|USA|GBR|DEU|CHN|IND|KOR|AFG|PAK)\b/
  )
  if (natMatch) {
    doc.nationality = natMatch[1]
  } else if (/O.?ZBEK|UZBEK|УЗБЕК/.test(upper)) {
    doc.nationality = "UZB"
  }

  /* --- Yakuniy qaror ---
     Kamida bitta kuchli identifikator (JSHSHIR yoki hujjat raqami) yoki
     to'liq ism+familiya+sana bo'lishi shart — aks holda natija emas. */
  const strongId = !!doc.personalNumber || !!doc.documentNumber
  const fullName = !!doc.firstName && !!doc.lastName
  if (!strongId && !(fullName && doc.birthDate)) return null
  if (score < 4) return null
  return { doc, score, fieldScores }
}

/**
 * Bir necha kadr natijalarini birlashtiradi: har maydon uchun eng ko'p
 * uchragan (va eng yuqori bahoga ega) qiymat tanlanadi.
 *
 * Bu vizual rejimning asosiy aniqlik manbai: bitta kadrda OCR adashishi
 * mumkin, lekin bir xil qiymat bir necha kadrda takrorlansa — u to'g'ri.
 */
export function mergeVisualResults(
  results: VisualParseResult[]
): { doc: ScannedDoc; score: number; agreement: number } | null {
  if (!results.length) return null

  const keys: (keyof ScannedDoc)[] = [
    "firstName",
    "lastName",
    "birthDate",
    "documentNumber",
    "personalNumber",
    "nationality",
  ]
  const doc: ScannedDoc = { documentType: results[0].doc.documentType }
  let total = 0
  let agreedFields = 0

  for (const key of keys) {
    // qiymat -> {ball, necha kadrda uchradi}
    const votes = new Map<string, { weight: number; count: number }>()
    for (const r of results) {
      const value = r.doc[key]
      if (typeof value !== "string" || !value) continue
      const prev = votes.get(value) ?? { weight: 0, count: 0 }
      votes.set(value, {
        weight: prev.weight + (r.fieldScores[key] ?? 1),
        count: prev.count + 1,
      })
    }
    if (!votes.size) continue
    // Avval takrorlanish soni, keyin ball bo'yicha
    const [bestValue, bestVote] = [...votes.entries()].sort(
      (a, b) => b[1].count - a[1].count || b[1].weight - a[1].weight
    )[0]
    ;(doc as any)[key] = bestValue
    total += bestVote.weight
    if (bestVote.count >= 2) agreedFields += 1
  }

  const strongId = !!doc.personalNumber || !!doc.documentNumber
  const fullName = !!doc.firstName && !!doc.lastName
  if (!strongId && !(fullName && doc.birthDate)) return null
  return { doc, score: total, agreement: agreedFields }
}
