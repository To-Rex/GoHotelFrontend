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
import type { ScannedDoc } from "./documentScannerTypes"

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

/** Barcha maydonlarning yorliq variantlari (eng uzunidan boshlab) —
 *  "OTASINING ISMI" har doim "ISMI"dan oldin tekshirilishi shart, aks holda
 *  otasining ismi ism deb olinadi. */
type FieldKey = keyof typeof LABELS

const ALL_LABELS: Array<{ field: FieldKey; label: string; norm: string }> =
  Object.entries(LABELS)
    .flatMap(([field, variants]) =>
      variants.map((label) => ({
        field: field as FieldKey,
        label,
        norm: norm(label),
      }))
    )
    .sort((a, b) => b.norm.length - a.norm.length)

/**
 * Levenshtein masofasi (maxDist dan oshsa erta to'xtaydi).
 * OCR yorliqni buzib o'qiganda ("SURNANE", "FAMlLlYASI", "G1VEN NAMES")
 * yorliqni baribir tanish uchun kerak.
 */
function editDistance(a: string, b: string, maxDist: number): number {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1
  const prev = new Array(b.length + 1)
  const cur = new Array(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i
    let rowMin = cur[0]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      if (cur[j] < rowMin) rowMin = cur[j]
    }
    if (rowMin > maxDist) return maxDist + 1
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j]
  }
  return prev[b.length]
}

/** Yorliq uzunligiga qarab ruxsat etilgan xato soni (qisqa so'zlarda 0) */
const allowedTypos = (len: number): number =>
  len >= 10 ? 2 : len >= 5 ? 1 : 0

/**
 * Matn bo'lagi qaysi maydonning yorlig'i — aniq yoki TAXMINIY moslik bilan.
 * Eng uzun yorliqlar birinchi tekshiriladi (ALL_LABELS shunday tartiblangan),
 * shuning uchun "OTASINING ISMI" har doim "ISMI"dan ustun keladi.
 */
function matchLabelChunk(chunkNorm: string): FieldKey | null {
  if (!chunkNorm) return null
  for (const l of ALL_LABELS) {
    if (l.norm === chunkNorm) return l.field
  }
  for (const l of ALL_LABELS) {
    const tol = allowedTypos(l.norm.length)
    if (!tol) continue
    if (Math.abs(l.norm.length - chunkNorm.length) > tol) continue
    if (editDistance(l.norm, chunkNorm, tol) <= tol) return l.field
  }
  return null
}

/** Matn bo'lagi qaysidir yorliqning O'ZI (yoki uning bir qismi)mi */
const isLabelText = (s: string): boolean => {
  const n = norm(s)
  if (!n) return false
  if (ALL_LABELS.some((l) => n === l.norm || n.includes(l.norm))) return true
  // Buzib o'qilgan yorliq ham qiymat sifatida qabul qilinmasligi kerak
  const words = n.split(" ").filter(Boolean)
  for (let span = Math.min(4, words.length); span >= 1; span--) {
    for (let i = 0; i + span <= words.length; i++) {
      if (matchLabelChunk(words.slice(i, i + span).join(" "))) return true
    }
  }
  return false
}

/**
 * Qatordagi maydon yorliqlarini aniqlaydi — ENG UZUN moslik ustun bo'ladi
 * va topilgan bo'lak "band" qilinadi.
 *
 * Bu juda muhim: "OTASINING ISMI / PATRONYMIC" ichida "ISMI" (ism yorlig'i)
 * ham bor. Band qilinmasa, bu qator ham otasining ismi, ham ism yorlig'i
 * deb hisoblanadi va ism maydoniga otasining ismi yozilib qoladi.
 */
function scanLineLabels(line: string): {
  fields: FieldKey[]
  /** Yorliqqa tegishli bo'lmagan so'zlar (asl ko'rinishida) */
  rest: string[]
} {
  const raw = line.split(/\s+/).filter(Boolean)
  // Har so'zning normal shakli (tinish belgilarisiz) — solishtirish uchun
  const normed = raw.map((w) => norm(w.replace(/[/|:.\-–—]/g, " ")).trim())
  const used = new Array(raw.length).fill(false)
  const fields: FieldKey[] = []
  // Uzun oynalardan boshlab: "OTASINING ISMI" topilsa, undagi "ISMI" band
  // bo'ladi va ism yorlig'i sifatida qayta sanalmaydi
  for (let span = Math.min(5, raw.length); span >= 1; span--) {
    for (let i = 0; i + span <= raw.length; i++) {
      if (used.slice(i, i + span).some(Boolean)) continue
      const chunk = normed.slice(i, i + span).filter(Boolean).join(" ")
      const field = matchLabelChunk(chunk)
      if (!field) continue
      for (let k = i; k < i + span; k++) used[k] = true
      if (!fields.includes(field)) fields.push(field)
    }
  }
  const rest = raw
    .map((w, i) => (used[i] ? "" : w.replace(/^[\s:/|.\-–—]+|[\s:/|.\-–—]+$/g, "")))
    .filter(Boolean)
  return { fields, rest }
}

const labelsInLine = (line: string): FieldKey[] => scanLineLabels(line).fields

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

/**
 * Matn bo'lagidan JSHSHIR (14 raqam) nomzodlarini topadi.
 *
 * OCR raqamlarni deyarli har doim GURUHLAB o'qiydi ("3150 3900 0100 15"),
 * ba'zan harf bilan adashtiradi ("3I5O..."). Shuning uchun bo'shliq va
 * tinish belgilari tashlanadi, harflar raqamga o'giriladi, so'ng 14
 * uzunlikdagi barcha oynalar ichki tuzilma bo'yicha tekshiriladi.
 */
/**
 * Qatorni raqam qidirishga tayyorlaydi: SOF HARFLI so'zlar (yorliqlar —
 * "JSHSHIR", "PASPORT RAQAMI") ajratgichga aylantiriladi, raqamli bo'laklar
 * esa qo'shni so'zlar bilan birikadi ("AA 765 4321" → "AA7654321").
 *
 * Busiz yorliq harflari raqamga o'girilib, soxta JSHSHIR yasab qo'yardi.
 */
/** Qisqa yorliq belgilari — hujjat raqami prefiksi bilan adashmasin */
const SHORT_LABEL_TOKENS = ["NO", "NR", "ID", "PN", "SR", "N"]

function alnumTokens(line: string): string {
  return line
    .split(/\s+/)
    .map((w) => {
      const alnum = w.replace(/[^0-9A-Za-z]/g, "").toUpperCase()
      if (!alnum) return " "
      const digits = (alnum.match(/\d/g) || []).length
      // "No", "ID" kabi qisqartmalar qo'shni raqamga yopishib ketmasin
      if (digits === 0 && SHORT_LABEL_TOKENS.includes(alnum)) return " "
      // Sof harfli uzun so'z — yorliq, ajratgich bo'ladi. 1-2 harfli bo'lak
      // (hujjat raqami prefiksi "AA") saqlanadi
      if (digits === 0 && alnum.length > 2) return " "
      // Asosan harfli aralash so'z ham yorliq bo'lishi mumkin
      if (digits > 0 && digits / alnum.length < 0.34 && alnum.length > 4) return " "
      return alnum
    })
    .join("")
}

function findPinflIn(text: string): string[] {
  const found: string[] = []
  for (const rawLine of text.split(/\r?\n/)) {
    // Yorliq so'zlari tashlangan, raqamli bo'laklar birikkan matn
    for (const group of alnumTokens(rawLine).split(" ")) {
      const compact = toDigits(group)
      if (compact.length < 14) continue
      for (let i = 0; i + 14 <= compact.length; i++) {
        const cand = compact.slice(i, i + 14)
        if (validatePinfl(cand) && !found.includes(cand)) found.push(cand)
      }
    }
  }
  return found
}

/**
 * Hujjat raqami: 2 harf + 7 raqam (AA1234567).
 * OCR uni "AA 1234567", "AA123 4567" yoki "A A 1 2 3 4 5 6 7" ko'rinishida
 * berishi mumkin — bo'shliqlar tashlanib, harf/raqam qismlari alohida
 * to'g'rilanadi.
 */
function findDocNumberIn(text: string): string[] {
  const found: string[] = []
  for (const rawLine of text.split(/\r?\n/)) {
    for (const compact of alnumTokens(rawLine).split(" ")) {
    if (compact.length < 9) continue
    for (let i = 0; i + 9 <= compact.length; i++) {
      const chunk = compact.slice(i, i + 9)
      const rawPrefix = chunk.slice(0, 2)
      const rawDigits = chunk.slice(2)
      const prefix = toLetters(rawPrefix)
      const digits = toDigits(rawDigits)
      if (prefix.length !== 2 || digits.length !== 7) continue
      // Prefiksda kamida BITTA asl harf bo'lishi shart — aks holda uzun
      // raqamlar ketma-ketligidan ("...010010047") soxta raqam yasaladi
      if (!/[A-Z]/.test(rawPrefix)) continue
      // Raqam qismining ko'pchiligi ASL raqam bo'lsin — yorliq harflari
      // ("PASSPORT No" → "NO") qo'shni raqamlar bilan birikib ketmasin
      const realDigits = (rawDigits.match(/\d/g) || []).length
      if (realDigits < 6) continue
      const value = prefix + digits
      if (!found.includes(value)) found.push(value)
    }
    }
  }
  return found
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
  // Har bir so'z stop-so'z ro'yxatida bo'lmasin (sarlavhalar, jins, millat)
  if (n.split(" ").every((w) => STOP_WORDS.includes(w))) return false
  // YORLIQNING O'ZI yoki uning bir qismi bo'lmasin. Bu eng muhim tekshiruv:
  // "ISMI GIVEN NAMES" kabi yorliq matni ism sifatida yozilib qolmasin
  if (isLabelText(v)) return false
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
  field: FieldKey,
  accept: (v: string) => boolean
): { value: string; lineIndex: number } | undefined {
  for (let i = 0; i < lines.length; i++) {
    // Yorliq ANIQ yoki taxminiy moslik bilan aniqlanadi; "OTASINING ISMI"
    // ichidagi "ISMI" band qilingani uchun ism yorlig'i deb olinmaydi
    const scan = scanLineLabels(lines[i])
    if (!scan.fields.includes(field)) continue
    // 1) shu qatorda yorliq so'zlaridan keyin qolgan matn ("Ismi / Given
    // names: BEKZOD" → "BEKZOD")
    const rest = scan.rest.join(" ").trim()
    if (rest && accept(rest)) return { value: rest, lineIndex: i }
    // 2) keyingi qatorlar. DIQQAT: keyingi qator ham YORLIQ bo'lsa — hujjat
    // ikki ustunli tartibda o'qilgan degani; matn ko'rinishida qaysi qiymat
    // qaysi yorliqqa tegishli ekanini aniqlab bo'lmaydi, shuning uchun
    // to'xtaymiz (noto'g'ri qiymatdan ko'ra bo'sh maydon afzal —
    // koordinatali parser bu holatni to'g'ri hal qiladi)
    for (let j = i + 1; j <= Math.min(i + 2, lines.length - 1); j++) {
      const cand = lines[j].trim()
      if (!cand) continue
      if (isLabelText(cand)) return undefined
      if (accept(cand)) return { value: cand, lineIndex: j }
    }
  }
  return undefined
}

/** Qatorda BIR NECHTA har xil maydon yorlig'i bormi (ikki ustunli sarlavha) */
const hasMultipleLabels = (line: string): boolean => labelsInLine(line).length > 1

/* --------------------------------------------------------------- parser */

/** Raqamli matndan JSHSHIR/hujjat raqamini ajratish (qayta o'qish uchun) */
export const extractPinfl = (text: string): string | undefined =>
  findPinflIn(text)[0]

export const extractDocNumber = (text: string): string | undefined =>
  findDocNumberIn(text)[0]

/** JSHSHIR'dan tug'ilgan sana (skaner qayta o'qigach ishlatadi) */
export const pinflBirthDate = (pinfl: string): string | undefined =>
  birthDateFromPinfl(pinfl)

/** Ichki yordamchilar — birlik testlari uchun ochilgan (UI ishlatmaydi) */
export const __testHelpers = {
  norm,
  isLabelText,
  labelsInLine,
  looksLikeName,
  parseDate,
  validatePinfl,
  findPinflIn,
  findDocNumberIn,
}

/** Tasvirdagi to'rtburchak soha (qayta o'qish uchun) */
export interface RegionBox {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface VisualParseResult {
  doc: ScannedDoc
  score: number
  /** Har maydon alohida baho bilan — kadrlar bo'yicha ovoz berish uchun */
  fieldScores: Partial<Record<keyof ScannedDoc, number>>
  /**
   * Raqamli maydonlar sohalari (yorliq ostidagi hudud). Skaner shu
   * sohalarni FAQAT RAQAM whitelist bilan qayta o'qib, past sifatli
   * suratlarda ham JSHSHIR va hujjat raqamini aniq oladi.
   */
  numericRegions?: {
    personalNumber?: RegionBox
    documentNumber?: RegionBox
  }
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
  // Yorliq ostidagi qiymat (bo'shliq bilan guruhlangan bo'lsa ham)
  const labelled = valueAfterLabel(
    lines,
    "personalNumber",
    (v) => findPinflIn(v).length > 0
  )
  if (labelled) {
    pinfl = findPinflIn(labelled.value)[0]
  }
  if (!pinfl) {
    // Yorliqsiz: butun matnda qidiramiz
    pinfl = findPinflIn(flat)[0]
  }
  if (pinfl) set("personalNumber", pinfl, 4)

  /* --- Hujjat raqami: AA1234567 (2 harf + 7 raqam) --- */
  const docLabelled = valueAfterLabel(
    lines,
    "documentNumber",
    (v) => findDocNumberIn(v).length > 0
  )
  let docNo: string | undefined
  if (docLabelled) docNo = findDocNumberIn(docLabelled.value)[0]
  if (!docNo) docNo = findDocNumberIn(flat)[0]
  if (docNo) set("documentNumber", docNo, 4)

  /* --- Sanalar: yorliq bo'yicha, bo'lmasa mantiq bo'yicha --- */
  const birthLabelled = valueAfterLabel(lines, "birthDate", (v) => !!parseDate(v))
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

  /* --- Familiya va ism ---
     Ikki ustunli sarlavha ("FAMILIYASI/SURNAME   ISMI/GIVEN NAMES") matn
     ko'rinishida qaysi qiymat qaysi ustunga tegishli ekanini yashiradi —
     bunday holatda ism/familiya UMUMAN olinmaydi (koordinatali parser
     bu holatni to'g'ri o'qiydi; noto'g'ri to'ldirishdan ko'ra bo'sh afzal). */
  const columnHeader = lines.some((l) => {
    if (!hasMultipleLabels(l)) return false
    const fields = labelsInLine(l)
    return fields.includes("lastName") || fields.includes("firstName")
  })
  if (!columnHeader) {
    const last = valueAfterLabel(lines, "lastName", looksLikeName)
    if (last) set("lastName", titleCase(last.value), 3)
    const first = valueAfterLabel(lines, "firstName", looksLikeName)
    // Ism maydonida ikki so'z bo'lsa (ism + otasining ismi) — faqat birinchisi
    if (first) set("firstName", titleCase(first.value.split(/\s+/)[0]), 3)
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

/* ================================================================
   LAYOUT PARSER — so'zlarning KOORDINATALARI bo'yicha o'qish.

   O'zbek ID kartasi va pasportida maydonlar IKKI USTUNDA joylashadi:

     FAMILIYASI / SURNAME        ISMI / GIVEN NAMES
     TOSHMATOV                   JASUR

   Matnni qator-qator o'qiganda ustunlar aralashib ketadi va yorliqning
   o'zi qiymat sifatida olinib qolishi mumkin. Shuning uchun har so'zning
   ekrandagi o'rni (bbox) ishlatiladi: qiymat — yorliqning AYNAN OSTIDA
   (yoki o'ng yonida) turgan, yorliq bo'lmagan matn.
   ================================================================ */

export interface WordBox {
  text: string
  x0: number
  y0: number
  x1: number
  y1: number
  conf: number
}

interface LineBox {
  words: WordBox[]
  text: string
  y0: number
  y1: number
  x0: number
  x1: number
}

/** So'zlarni vizual qatorlarga guruhlaydi (y bo'yicha, keyin x bo'yicha) */
function groupIntoLines(words: WordBox[]): LineBox[] {
  const usable = words.filter((w) => w.text.trim() && w.conf >= 30)
  if (!usable.length) return []
  const heights = usable.map((w) => w.y1 - w.y0).sort((a, b) => a - b)
  const medianH = heights[Math.floor(heights.length / 2)] || 10
  const tol = Math.max(4, medianH * 0.6)

  const sorted = [...usable].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)
  const lines: LineBox[] = []
  for (const w of sorted) {
    const cy = (w.y0 + w.y1) / 2
    const line = lines.find((l) => Math.abs((l.y0 + l.y1) / 2 - cy) <= tol)
    if (line) {
      line.words.push(w)
      line.y0 = Math.min(line.y0, w.y0)
      line.y1 = Math.max(line.y1, w.y1)
      line.x0 = Math.min(line.x0, w.x0)
      line.x1 = Math.max(line.x1, w.x1)
    } else {
      lines.push({
        words: [w],
        text: "",
        y0: w.y0,
        y1: w.y1,
        x0: w.x0,
        x1: w.x1,
      })
    }
  }
  for (const l of lines) {
    l.words.sort((a, b) => a.x0 - b.x0)
    l.text = l.words.map((w) => w.text).join(" ")
  }
  return lines.sort((a, b) => a.y0 - b.y0)
}

/** Qatordan topilgan yorliq: qaysi maydon va qayerda joylashgan */
interface LabelHit {
  field: FieldKey
  lineIndex: number
  x0: number
  x1: number
  /** Yorliqdan keyin shu qatorda qolgan so'zlar */
  after: WordBox[]
}

/**
 * Qatorlardagi barcha yorliqlarni topadi. Bir qatorda ikki ustun yorlig'i
 * ham bo'lishi mumkin ("FAMILIYASI/SURNAME    ISMI/GIVEN NAMES") — ikkalasi
 * ham alohida topiladi. Eng UZUN yorliq ustun: "OTASINING ISMI" hech qachon
 * "ISMI" deb talqin qilinmaydi.
 */
function findLabels(lines: LineBox[]): LabelHit[] {
  const hits: LabelHit[] = []
  lines.forEach((line, lineIndex) => {
    const used = new Array(line.words.length).fill(false)
    // Uzun yorliqlardan boshlab: 5 so'zlik oynadan 1 so'zlikkacha
    for (let span = 5; span >= 1; span--) {
      for (let i = 0; i + span <= line.words.length; i++) {
        if (used.slice(i, i + span).some(Boolean)) continue
        const chunk = line.words.slice(i, i + span)
        const chunkNorm = norm(chunk.map((w) => w.text).join(" "))
        if (!chunkNorm) continue
        // Aniq yoki taxminiy moslik (OCR yorliqni buzib o'qigan bo'lishi mumkin)
        const field = matchLabelChunk(chunkNorm)
        if (!field) continue
        for (let k = i; k < i + span; k++) used[k] = true
        hits.push({
          field,
          lineIndex,
          x0: chunk[0].x0,
          x1: chunk[chunk.length - 1].x1,
          after: line.words.slice(i + span),
        })
      }
    }
  })
  return hits
}

/** Ikki oraliq gorizontal kesishadimi (ustunni aniqlash uchun) */
const overlapsX = (
  a0: number,
  a1: number,
  b0: number,
  b1: number,
  slack: number
): boolean => a0 - slack <= b1 && b0 - slack <= a1

/**
 * Yorliq uchun qiymat qidiradi:
 *   1) shu qatorda yorliqdan keyin (yorliq bo'lmagan so'zlar);
 *   2) pastdagi 3 qatorda — yorliq ustuni bilan gorizontal kesishadigan,
 *      yorliq bo'lmagan so'zlar (ikki ustunli tartib shu bilan hal bo'ladi).
 */
function valueForLabel(
  lines: LineBox[],
  hit: LabelHit,
  accept: (v: string) => boolean
): string | undefined {
  // 1) Yorliq bilan bir qatorda, o'ng tomonida
  if (hit.after.length) {
    // Yorliqdan keyin BOSHQA yorliq boshlansa — u yerda to'xtaymiz
    const tail: WordBox[] = []
    for (const w of hit.after) {
      if (isLabelText(w.text)) break
      tail.push(w)
    }
    const candidate = tail
      .map((w) => w.text)
      .join(" ")
      .replace(/^[\s:/|.\-–—]+/, "")
      .trim()
    if (candidate && accept(candidate)) return candidate
  }

  // 2) Pastdagi qatorlarda, shu ustun ostida
  const width = Math.max(hit.x1 - hit.x0, 40)
  const slack = width * 0.35
  for (let li = hit.lineIndex + 1; li <= hit.lineIndex + 3 && li < lines.length; li++) {
    const line = lines[li]
    const inColumn = line.words.filter((w) =>
      overlapsX(hit.x0, hit.x1, w.x0, w.x1, slack)
    )
    if (!inColumn.length) continue
    // Ustun ostida yana yorliq turgan bo'lsa — bu boshqa maydon, to'xtaymiz
    const chunkText = inColumn.map((w) => w.text).join(" ").trim()
    if (isLabelText(chunkText)) return undefined
    if (accept(chunkText)) return chunkText
    // Bitta so'z ham mos kelishi mumkin (masalan sana raqamlari ajralib ketsa)
    for (const w of inColumn) {
      if (accept(w.text)) return w.text
    }
  }
  return undefined
}

/**
 * ASOSIY vizual o'qish — so'z koordinatalari bilan.
 * Matn asosidagi parser (parseVisualDocument) zaxira sifatida qoladi.
 */
export function parseVisualLayout(
  words: WordBox[],
  docType: "PASSPORT" | "ID_CARD"
): VisualParseResult | null {
  const lines = groupIntoLines(words)
  if (lines.length < 2) return null
  const hits = findLabels(lines)
  const flatText = lines.map((l) => l.text).join("\n")
  const upper = flatText.toUpperCase()

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

  const hitFor = (field: FieldKey) => hits.filter((h) => h.field === field)

  // --- Familiya / ism: yorliq ostidagi (yoki yonidagi) matn ---
  for (const h of hitFor("lastName")) {
    const v = valueForLabel(lines, h, looksLikeName)
    if (v) {
      set("lastName", titleCase(v), 4)
      break
    }
  }
  for (const h of hitFor("firstName")) {
    const v = valueForLabel(lines, h, looksLikeName)
    if (v) {
      // Faqat birinchi so'z — "JASUR AKMALOVICH" bo'lsa otasining ismi tushmaydi
      set("firstName", titleCase(v.split(/\s+/)[0]), 4)
      break
    }
  }

  // --- Tug'ilgan sana ---
  for (const h of hitFor("birthDate")) {
    const v = valueForLabel(lines, h, (s) => !!parseDate(s))
    if (v) {
      const parsed = parseDate(v)
      if (parsed) {
        set("birthDate", parsed, 4)
        break
      }
    }
  }

  // --- JSHSHIR (PINFL) ---
  let pinfl: string | undefined
  for (const h of hitFor("personalNumber")) {
    const v = valueForLabel(lines, h, (s) => findPinflIn(s).length > 0)
    if (v) {
      pinfl = findPinflIn(v)[0]
      break
    }
  }
  if (!pinfl) pinfl = findPinflIn(flatText)[0]
  if (pinfl) {
    set("personalNumber", pinfl, 4)
    const fromPinfl = birthDateFromPinfl(pinfl)
    if (fromPinfl) {
      if (!doc.birthDate) set("birthDate", fromPinfl, 4)
      else if (doc.birthDate === fromPinfl) {
        fieldScores.birthDate = (fieldScores.birthDate ?? 0) + 3
        score += 3
      } else set("birthDate", fromPinfl, 4)
    }
  }

  // --- Hujjat raqami ---
  let docNo: string | undefined
  for (const h of hitFor("documentNumber")) {
    const v = valueForLabel(lines, h, (s) => findDocNumberIn(s).length > 0)
    if (v) {
      docNo = findDocNumberIn(v)[0]
      break
    }
  }
  if (!docNo) docNo = findDocNumberIn(flatText)[0]
  if (docNo) set("documentNumber", docNo, 4)

  // --- Fuqarolik ---
  const natMatch = upper.match(
    /\b(UZB|RUS|KAZ|KGZ|TJK|TKM|AZE|UKR|TUR|USA|GBR|DEU|CHN|IND|KOR|AFG|PAK)\b/
  )
  if (natMatch) doc.nationality = natMatch[1]
  else if (/O.?ZBEK|UZBEK|УЗБЕК/.test(upper)) doc.nationality = "UZB"

  /* --- Raqamli maydonlar sohalari: yorliq ostidagi hudud.
     Skaner ularni faqat-raqam rejimida qayta o'qiydi (past sifatda ham
     JSHSHIR/hujjat raqami aniq chiqishi uchun). --- */
  const regionUnder = (field: FieldKey): RegionBox | undefined => {
    const h = hits.find((x) => x.field === field)
    if (!h) return undefined
    const width = Math.max(h.x1 - h.x0, 60)
    const lineH = Math.max(lines[h.lineIndex].y1 - lines[h.lineIndex].y0, 12)
    const top = lines[h.lineIndex].y0
    return {
      // Yorliq ustuni + ozroq zaxira (qiymat kengroq yozilgan bo'lishi mumkin)
      x0: Math.max(0, h.x0 - width * 0.12),
      x1: h.x1 + width * 0.55,
      // Yorliq qatoridan boshlab pastga 2.6 qator (yorliq + qiymat)
      y0: Math.max(0, top - lineH * 0.25),
      y1: top + lineH * 2.8,
    }
  }
  const numericRegions = {
    personalNumber: regionUnder("personalNumber"),
    documentNumber: regionUnder("documentNumber"),
  }

  const strongId = !!doc.personalNumber || !!doc.documentNumber
  const fullName = !!doc.firstName && !!doc.lastName
  // Raqamli sohalar topilgan bo'lsa, natija bo'sh bo'lsa ham qaytaramiz —
  // skaner ularni qayta o'qib maydonlarni to'ldirishi mumkin
  const hasRegions = !!numericRegions.personalNumber || !!numericRegions.documentNumber
  if (!strongId && !(fullName && doc.birthDate) && !hasRegions) return null
  if (score < 4 && !hasRegions) return null
  return { doc, score, fieldScores, numericRegions }
}

/* ================================================================
   MAYDON AKKUMULYATORI

   Muhim tamoyil: har maydon MUSTAQIL to'planadi va hech qachon
   "almashtirilmaydi". Bitta o'tish ism-familiyani yaxshi o'qiydi
   (matn rejimi), boshqasi raqamlarni (raqam rejimi) — ilgari keyingi
   natija oldingisini bosib yuborar va "ism chiqsa raqam yo'q, raqam
   chiqsa ism yo'q" holati kelib chiqardi.

   Har qiymat ovoz to'playdi: qancha ko'p manba (o'tish yoki kadr) bir
   xil qiymatni bersa, u shuncha ishonchli.
   ================================================================ */

const CORE_FIELDS: (keyof ScannedDoc)[] = [
  "firstName",
  "lastName",
  "birthDate",
  "documentNumber",
  "personalNumber",
]

export class FieldAccumulator {
  private votes = new Map<string, Map<string, { weight: number; sources: Set<string> }>>()
  private docType: "PASSPORT" | "ID_CARD"
  private sequence = 0

  constructor(docType: "PASSPORT" | "ID_CARD") {
    this.docType = docType
  }

  /**
   * Bitta maydon qiymatini qo'shadi. `weight` OCR confidence, `sourceId` esa
   * mustaqil kadr/passage identifikatori. Ular ataylab alohida saqlanadi:
   * bitta OCR passage confidence=4 bo'lgani uni to'rtta mustaqil tasdiq qilib
   * qo'ymasligi kerak.
   */
  addField(field: keyof ScannedDoc, value: string | undefined, weight = 1, sourceId?: string) {
    if (!value) return
    const key = String(field)
    const bucket = this.votes.get(key) ?? new Map<string, { weight: number; sources: Set<string> }>()
    const source = sourceId ?? `source-${++this.sequence}`
    const current = bucket.get(value) ?? { weight: 0, sources: new Set<string>() }
    current.weight += weight
    current.sources.add(source)
    bucket.set(value, current)
    this.votes.set(key, bucket)
  }

  /** Parser natijasidagi barcha maydonlarni qo'shadi */
  add(result: VisualParseResult | null, sourceId?: string) {
    if (!result) return
    const source = sourceId ?? `source-${++this.sequence}`
    for (const field of [...CORE_FIELDS, "nationality" as keyof ScannedDoc]) {
      const value = result.doc[field]
      if (typeof value === "string" && value) {
        this.addField(field, value, result.fieldScores[field] ?? 1, source)
      }
    }
  }

  /** Shu maydon uchun eng ko'p ovoz olgan qiymat */
  best(field: keyof ScannedDoc): string | undefined {
    const bucket = this.votes.get(String(field))
    if (!bucket || !bucket.size) return undefined
    return [...bucket.entries()].sort(
      (a, b) => b[1].sources.size - a[1].sources.size || b[1].weight - a[1].weight
    )[0][0]
  }

  has(field: keyof ScannedDoc): boolean {
    return !!this.best(field)
  }

  /** Nechta mustaqil kadr/passage aynan shu qiymatni berdi. */
  sourceCount(field: keyof ScannedDoc, value = this.best(field)): number {
    if (!value) return 0
    return this.votes.get(String(field))?.get(value)?.sources.size ?? 0
  }

  isConfirmed(field: keyof ScannedDoc, minimumSources = 2): boolean {
    return this.sourceCount(field) >= minimumSources
  }

  /** To'plangan maydonlardan hujjat */
  get doc(): ScannedDoc {
    const doc: ScannedDoc = { documentType: this.docType }
    for (const field of [...CORE_FIELDS, "nationality" as keyof ScannedDoc]) {
      const value = this.best(field)
      if (value) (doc as any)[field] = value
    }
    return doc
  }

  /** To'lgan asosiy maydonlar soni */
  get filledCount(): number {
    return CORE_FIELDS.filter((f) => this.has(f)).length
  }

  /** Kamida ikki manba tasdiqlagan maydonlar soni */
  get agreedCount(): number {
    let n = 0
    for (const field of CORE_FIELDS) {
      if (this.isConfirmed(field)) n++
    }
    return n
  }

  /** Hujjat to'liq o'qilgan deb hisoblanadimi */
  isComplete(): boolean {
    const hasName = this.has("firstName") && this.has("lastName")
    const hasId = this.has("personalNumber") || this.has("documentNumber")
    return hasName && hasId && this.has("birthDate")
  }

  /** Auto-accept uchun maydonlar ikki mustaqil sifatli kadrda tasdiqlangan. */
  isConfirmedComplete(): boolean {
    const hasName = this.isConfirmed("firstName") && this.isConfirmed("lastName")
    const hasId = this.isConfirmed("personalNumber") || this.isConfirmed("documentNumber")
    return hasName && hasId && this.isConfirmed("birthDate")
  }

  /** Foydalanuvchiga ko'rsatish uchun: qaysi maydonlar yetishmayapti */
  get missing(): (keyof ScannedDoc)[] {
    return CORE_FIELDS.filter((f) => !this.has(f))
  }
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
