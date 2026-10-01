#!/usr/bin/env node
// Kodga yozilgan o'zbekcha matnlarni tr("...") ga o'raydi.
//
//   node scripts/i18n/wrap.mjs                 — faqat hisobot (hech narsa yozilmaydi)
//   node scripts/i18n/wrap.mjs --write         — fayllarni o'zgartiradi
//   node scripts/i18n/wrap.mjs --report f.json — batafsil hisobotni faylga
//   node scripts/i18n/wrap.mjs src/features/rooms   — faqat shu yo'l
//
// O'zbekcha matnning O'ZI kalit bo'ladi: tr("Saqlash") o'zbek tilida aynan
// "Saqlash" qaytaradi, shuning uchun o'ralgan kod o'zbekcha interfeysda
// avvalgidek ishlaydi. Qoidalar:
//   - JSX matni va ko'rinadigan atributlar (title, placeholder ...) o'raladi;
//   - `${x} ta xona` → tr("{{x}} ta xona", { x });
//   - className, kalitlar, yo'llar, solishtirishlar (=== "…") TEGILMAYDI;
//   - bitta faylda ham ko'rsatiladigan, ham solishtiriladigan matn o'ralmaydi
//     va hisobotda "identity" bo'lib chiqadi — qo'lda ko'rib chiqiladi.
// Qayta ishga tushirish xavfsiz: o'ralgan joylar ikkinchi marta o'ralmaydi.
import fs from "node:fs"
import path from "node:path"
import ts from "typescript"

import { classify, decodeJsxEntities, hasWord, lit, normalizeJsxText } from "./classify.mjs"

const ROOT = process.cwd()
const FN = "tr"
const MODULE = "@/i18n"

const argv = process.argv.slice(2)
const WRITE = argv.includes("--write")
const reportIdx = argv.indexOf("--report")
const REPORT = reportIdx >= 0 ? argv[reportIdx + 1] : null
const ONLY = argv
  .filter((a, i) => !a.startsWith("--") && i !== reportIdx + 1)
  .map((p) => path.resolve(ROOT, p).replace(/\\/g, "/"))

// --- Qoidalar -------------------------------------------------------------

/** Qiymati matn emas, texnik bo'lgan JSX atributlari. */
const ATTR_SKIP = new Set(
  `className class id key type name value defaultValue htmlFor href to src srcSet
   role variant size target rel method action autoComplete inputMode pattern
   accept lang dir align side d viewBox fill stroke xmlns style tabIndex mode
   as form encType loading decoding referrerPolicy crossOrigin dataKey nameKey
   stackId layout orientation position queryKey field path element icon tone
   kind status format locale direction justify weight fit shape theme step min
   max capture enterKeyHint color strokeLinecap strokeLinejoin strokeWidth
   strokeDasharray fillRule clipRule transform points x y x1 x2 y1 y2 cx cy r
   rx ry width height offset stopColor gradientUnits textAnchor
   dominantBaseline fontFamily fontSize fontWeight preload media sizes charSet
   httpEquiv property itemProp autoCapitalize autoCorrect spellCheck wrap
   scope headers colSpan rowSpan sandbox allow download hrefLang integrity
   nonce slot ref domain scale interval verticalAlign iconType legendType
   testId facingMode objectFit`.split(/\s+/)
)
const ARIA_TEXT = new Set([
  "aria-label", "aria-description", "aria-placeholder", "aria-valuetext",
  "aria-roledescription",
])
const isAttrSkipped = (name) =>
  ATTR_SKIP.has(name) ||
  name.startsWith("data-") ||
  (name.startsWith("aria-") && !ARIA_TEXT.has(name))

/** Shu atributlarda turgan matn — solishtirish/kalit sifatida ishlatiladi. */
const IDENTITY_ATTRS = new Set(["value", "defaultValue", "key", "name", "dataKey", "nameKey", "id"])

/** Obyekt maydonlari: qiymati texnik. */
const PROP_SKIP = new Set(
  `className class style key id value queryKey mutationKey dataKey nameKey href
   to path src variant size method url mode`.split(/\s+/)
)
const IDENTITY_PROPS = new Set(["value", "key", "id"])

/** Bitta kichik harfli so'z ham matn hisoblanadigan maydon/atributlar. */
const DISPLAY_NAMES = new Set(
  `label title placeholder description hint message unit suffix prefix tooltip
   caption subtitle text header heading short alt aria-label helperText
   emptyText`.split(/\s+/)
)

/** Argumentlari butunlay texnik bo'lgan funksiyalar. */
const CALL_SKIP_DEEP = new Set([
  "cn", "clsx", "cva", "twMerge", "classNames", "require", "RegExp", "URL",
  "URLSearchParams", "matchMedia", FN,
])
/** To'g'ridan-to'g'ri argumenti texnik bo'lgan metodlar. */
const METHOD_SKIP_DIRECT = new Set(
  `includes startsWith endsWith indexOf lastIndexOf split replace replaceAll
   match matchAll test search has get getAll delete getItem setItem removeItem
   querySelector querySelectorAll getElementById getElementsByClassName
   createElement createElementNS addEventListener removeEventListener
   dispatchEvent getAttribute setAttribute removeAttribute hasAttribute closest
   matches postMessage enum literal toLocaleString toLocaleDateString
   toLocaleTimeString localeCompare navigate getContext getPropertyValue
   setProperty padStart padEnd`.split(/\s+/)
)
const IDENTITY_METHODS = new Set(["includes", "indexOf", "has", "startsWith", "endsWith"])

/** Butunlay mantiq fayllari: ichidagi matnlar hujjatdagi yozuvlar bilan
 *  SOLISHTIRILADI (OCR yorliqlari) — tarjima qilinsa tanish buziladi. */
const FILE_SKIP = [/visualDocParser\.ts$/, /mrzParser\.ts$/]

/** Matnga o'xshaydi, lekin texnik qiymat. */
const IGNORE_EXACT = new Set([
  "xab_live_...",
  "noindex, nofollow",
  "index, follow, max-image-preview:large, max-snippet:-1",
  "No refresh token",
  "UZB  123456789  123",
])

/** `// i18n:skip` yoki `// i18n:keys` — shu izohdan keyingi ifoda o'ralmaydi.
 *  skip: texnik qiymat. keys: qiymat o'zbekcha saqlanadi (bazaga yoziladi,
 *  solishtiriladi), ekranga chiqarishda tr(qiymat) bilan tarjima qilinadi —
 *  extract.mjs ichidagi matnlarni kalit sifatida ro'yxatga oladi. */
const DIRECTIVE = /i18n:(skip|keys)/
const COMPARE_OPS = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
  ts.SyntaxKind.LessThanToken,
  ts.SyntaxKind.GreaterThanToken,
  ts.SyntaxKind.LessThanEqualsToken,
  ts.SyntaxKind.GreaterThanEqualsToken,
  ts.SyntaxKind.InKeyword,
])

// --- Dastur ---------------------------------------------------------------

const cfg = ts.readConfigFile(path.join(ROOT, "tsconfig.app.json"), ts.sys.readFile)
const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, ROOT)
const program = ts.createProgram(parsed.fileNames, parsed.options)
const checker = program.getTypeChecker()

const isTarget = (file) => {
  const f = file.replace(/\\/g, "/")
  if (!f.includes("/src/") || f.endsWith(".d.ts")) return false
  if (/\.test\.tsx?$/.test(f) || f.includes("/src/i18n/")) return false
  if (FILE_SKIP.some((re) => re.test(f))) return false
  return ONLY.length === 0 || ONLY.some((p) => f === p || f.startsWith(p + "/"))
}

const isStringLit = (n) => ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)

function calleeName(call) {
  const e = call.expression
  if (ts.isIdentifier(e)) return e.text
  if (ts.isPropertyAccessExpression(e)) return e.name.text
  return ""
}

function isStrictStringOrNumber(type) {
  if (type.isUnion()) return type.types.every(isStrictStringOrNumber)
  if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return false
  return !!(type.flags & (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike))
}

function unparen(e) {
  while (ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e)) e = e.expression
  return e
}

function processFile(sf) {
  const text = sf.text
  const rel = path.relative(ROOT, sf.fileName).replace(/\\/g, "/")
  const report = {
    file: rel, wrapped: 0, merged: 0, keys: [], identity: [], ambiguous: [],
    skipped: [], entities: [], decls: [], payload: [],
  }
  let arrayHits = 0
  /** >0 — `value` ichidamiz: satr literali texnik, shablon esa ko'rinadigan matn */
  let valueCtx = 0
  const visitValue = (node, edits) => {
    valueCtx += 1
    try {
      visit(node, edits)
    } finally {
      valueCtx -= 1
    }
  }
  const hasDirective = (node) =>
    [
      ...(ts.getLeadingCommentRanges(text, node.getFullStart()) || []),
      ...(ts.getTrailingCommentRanges(text, node.getFullStart()) || []),
    ].some((r) => DIRECTIVE.test(text.slice(r.pos, r.end)))
  const lineOf = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1

  // --- 1-o'tish: solishtiriladigan/kalit bo'ladigan matnlar ---------------
  const identity = new Set()
  const noteIdentity = (s) => {
    if (hasWord(s)) identity.add(s)
  }
  ;(function scan(node) {
    if (isStringLit(node)) {
      const p = node.parent
      if (ts.isBinaryExpression(p) && COMPARE_OPS.has(p.operatorToken.kind)) noteIdentity(node.text)
      else if (ts.isCaseClause(p)) noteIdentity(node.text)
      else if (ts.isElementAccessExpression(p) && p.argumentExpression === node) noteIdentity(node.text)
      else if (ts.isPropertyAssignment(p) && p.name === node) noteIdentity(node.text)
      else if (ts.isPropertyAssignment(p) && p.initializer === node && IDENTITY_PROPS.has(p.name.getText(sf))) noteIdentity(node.text)
      else if (ts.isJsxAttribute(p) && IDENTITY_ATTRS.has(p.name.getText(sf))) noteIdentity(node.text)
      else if (ts.isCallExpression(p) && p.arguments.includes(node) && IDENTITY_METHODS.has(calleeName(p))) noteIdentity(node.text)
      else if (ts.isArrayLiteralExpression(p)) {
        const g = p.parent
        if (
          (ts.isPropertyAccessExpression(g) && g.expression === p && IDENTITY_METHODS.has(g.name.text)) ||
          (ts.isNewExpression(g) && ["Set", "Map"].includes(g.expression.getText(sf)))
        ) {
          noteIdentity(node.text)
        }
      }
    }
    ts.forEachChild(node, scan)
  })(sf)

  // --- 2-o'tish: o'rash ----------------------------------------------------
  const applyEdits = (start, end, edits) => {
    edits.sort((a, b) => a.start - b.start)
    let out = ""
    let pos = start
    for (const e of edits) {
      if (e.start < pos) throw new Error(`${rel}: ustma-ust tahrir (${e.start})`)
      out += text.slice(pos, e.start) + e.text
      pos = e.end
    }
    return out + text.slice(pos, end)
  }
  const render = (node) => {
    const edits = []
    visit(node, edits)
    return applyEdits(node.getStart(sf), node.end, edits)
  }

  /** Matn ko'rinadigan joydami (JSX bolasi yoki label/title kabi maydon). */
  const isDisplayContext = (node) => {
    let cur = node
    for (;;) {
      const p = cur.parent
      if (!p) return false
      if (ts.isConditionalExpression(p) || ts.isParenthesizedExpression(p) || ts.isTemplateSpan(p) || ts.isTemplateExpression(p)) {
        cur = p
        continue
      }
      if (ts.isBinaryExpression(p)) {
        const k = p.operatorToken.kind
        if (
          k === ts.SyntaxKind.AmpersandAmpersandToken || k === ts.SyntaxKind.BarBarToken ||
          k === ts.SyntaxKind.QuestionQuestionToken || k === ts.SyntaxKind.PlusToken
        ) {
          cur = p
          continue
        }
        return false
      }
      if (ts.isJsxExpression(p)) {
        const g = p.parent
        if (ts.isJsxElement(g) || ts.isJsxFragment(g)) return true
        if (ts.isJsxAttribute(g)) return DISPLAY_NAMES.has(g.name.getText(sf))
        return false
      }
      if (ts.isPropertyAssignment(p)) return DISPLAY_NAMES.has(p.name.getText(sf))
      if (ts.isJsxAttribute(p)) return DISPLAY_NAMES.has(p.name.getText(sf))
      return false
    }
  }

  /** Matn o'ralsinmi? natural → ha; ambiguous → faqat ko'rinadigan joyda. */
  const decide = (node, staticText, exact, forceNatural = false) => {
    if (IGNORE_EXACT.has(exact)) return false
    const kind = classify(staticText)
    if (kind === "technical") return false
    if (kind === "ambiguous" && !forceNatural && !isDisplayContext(node)) {
      report.ambiguous.push({ line: lineOf(node), text: exact })
      return false
    }
    if (identity.has(exact)) {
      report.identity.push({ line: lineOf(node), text: exact })
      return false
    }
    return true
  }

  /** O'tkazib yuborilgan joydagi o'qiladigan matnlarni hisobotga yozish. */
  const noteSkipped = (node, reason) => {
    ;(function walk(n) {
      if (isStringLit(n) && classify(n.text) === "natural") {
        report.skipped.push({ line: lineOf(n), text: n.text, reason })
      } else if (ts.isTemplateExpression(n)) {
        const parts = [n.head.text, ...n.templateSpans.map((s) => s.literal.text)]
        const joined = parts.join("")
        const looks = /\s/.test(joined) ? classify(parts.join(" ")) === "natural" : displayFragment(joined)
        if (looks) report.skipped.push({ line: lineOf(n), text: n.getText(sf).slice(0, 120), reason })
      }
      ts.forEachChild(n, walk)
    })(node)
  }

  /** Bo'shliqsiz bo'lak ko'rinadigan matnmi: "-xona", "-qavat", "-mehmon"
   *  (yo'l, fayl nomi, kalit emas). Faqat ko'rinadigan joyda qo'llanadi. */
  const displayFragment = (joined) =>
    /\p{L}{2,}/u.test(joined) &&
    !/[/\\@=?&#_{}<>|]/.test(joined) &&
    !/\.[a-z0-9]{2,5}$/i.test(joined) &&
    !/^[a-z]+[A-Z]/.test(joined.replace(/^[^\p{L}]+/u, ""))

  /** Literalning joylashuvi tarjimaga yo'l qo'ymaydimi. */
  const literalBlocked = (node) => {
    const p = node.parent
    if (ts.isExpressionStatement(p)) return true // "use strict"
    if (ts.isBinaryExpression(p) && COMPARE_OPS.has(p.operatorToken.kind)) return true
    if (ts.isCaseClause(p)) return true
    if (ts.isElementAccessExpression(p) && p.argumentExpression === node) return true
    if (ts.isComputedPropertyName(p) || ts.isTaggedTemplateExpression(p)) return true
    if ("name" in p && p.name === node) return true // obyekt kaliti
    if (ts.isAsExpression(p) && p.type.getText(sf) === "const") return true
    if (
      ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      p.left.getText(sf).endsWith("displayName")
    ) {
      return true
    }
    if (ts.isCallExpression(p) && p.arguments.includes(node)) {
      const m = calleeName(p)
      if (METHOD_SKIP_DIRECT.has(m)) return true
      if ((m === "append" || m === "set") && p.arguments[0] === node) return true
      if (ts.isPropertyAccessExpression(p.expression) && p.expression.expression.getText(sf).endsWith("classList")) return true
    }
    if (ts.isArrayLiteralExpression(p)) {
      const g = p.parent
      if (ts.isPropertyAccessExpression(g) && g.expression === p && IDENTITY_METHODS.has(g.name.text)) return true
      if (ts.isNewExpression(g) && ["Set", "Map"].includes(g.expression.getText(sf))) return true
    }
    return false
  }

  const addKey = (key) => {
    report.wrapped += 1
    report.keys.push(key)
  }

  /** Serverga ketadigan obyekt ichidami (mutate/post/setValue ...) — o'raladi,
   *  lekin hisobotda "payload" bo'lib chiqadi: bazaga tarjima yozilmasin. */
  const notePayload = (node, key) => {
    let cur = node
    for (let depth = 0; cur.parent && depth < 6; depth++, cur = cur.parent) {
      const p = cur.parent
      if (ts.isArrowFunction(p) || ts.isFunctionExpression(p) || ts.isFunctionDeclaration(p)) return
      if (ts.isCallExpression(p) && p.arguments.includes(cur)) {
        const m = calleeName(p)
        if (/^(mutate|mutateAsync|post|put|patch|setValue|reset|append)$/.test(m) || /^(create|update|save|send|add)[A-Z]/.test(m)) {
          report.payload.push({ line: lineOf(node), text: key, call: m })
        }
        return
      }
    }
  }

  const handleLiteral = (node, edits) => {
    if (valueCtx > 0) return
    if (hasDirective(node)) return
    if (literalBlocked(node)) return
    if (!decide(node, node.text, node.text)) return
    if (ts.isArrayLiteralExpression(node.parent)) arrayHits += 1
    notePayload(node, node.text)
    addKey(node.text)
    edits.push({ start: node.getStart(sf), end: node.end, text: `${FN}(${lit(node.text)})` })
  }

  /** `${a} ta xona` → tr("{{a}} ta xona", { a }). false — tegilmadi. */
  const handleTemplate = (node, edits) => {
    if (hasDirective(node) || literalBlocked(node)) return false
    const parts = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)]
    if (parts.some((p) => p === undefined)) return false
    if (!hasWord(parts.join(" "))) return false
    // Bo'shliqsiz shablon ("/rooms/${id}/x", "photo-${n}.jpg") bitta so'z kabi
    // baholanadi — yo'l va fayl nomlari matn deb olinmasin
    const joined = parts.join("")
    const staticText = /\s/.test(joined) ? parts.join(" ") : parts.join("x")
    // `${xona}-xona`: bo'shliqsiz, lekin ekranga chiqadigan bo'lak
    const inValue = valueCtx > 0
    const visibleFragment = !/\s/.test(joined) && (inValue || isDisplayContext(node)) && displayFragment(joined)
    const names = makeNamer()
    let key = parts[0]
    node.templateSpans.forEach((span, i) => {
      const expr = span.expression
      const strict = isStrictStringOrNumber(checker.getTypeAtLocation(expr))
      // Shablon har qanday qiymatni satrga aylantiradi (null → "null");
      // tr esa null/boolean'ni bo'sh qoldiradi — farq String() bilan yopiladi
      const name = names.add(expr, strict ? render(expr) : `String(${render(expr)})`)
      key += `{{${name}}}` + parts[i + 1]
    })
    // "${n} ta" — haqiqiy bo'shliq bilan ajratilgan bitta so'z ham matn
    const spaced = /\s/.test(parts.join("")) && classify(staticText) === "ambiguous"
    if (visibleFragment) {
      if (IGNORE_EXACT.has(key)) return false
      if (identity.has(key)) {
        report.identity.push({ line: lineOf(node), text: key })
        return false
      }
    } else if (!decide(node, staticText, key, spaced || inValue)) return false
    addKey(key)
    report.merged += 1
    edits.push({
      start: node.getStart(sf),
      end: node.end,
      text: `${FN}(${lit(key)}, ${names.objectText()})`,
    })
    return true
  }

  /** Interpolatsiya nomlari: ifodadan o'qiladigan nom, takrorlansa raqam. */
  function makeNamer() {
    const byExpr = new Map() // ifoda matni → nom
    const taken = new Map() // nom → qiymat matni
    const suggest = (expr) => {
      const e = unparen(expr)
      if (ts.isIdentifier(e)) return e.text
      if (ts.isPropertyAccessExpression(e)) return e.name.text === "length" ? "count" : e.name.text
      if (ts.isCallExpression(e)) {
        // total.toLocaleString() → "total"; fmt(price) → "price"; fmt(a + b) → "fmt"
        if (ts.isPropertyAccessExpression(e.expression)) {
          const recv = suggest(e.expression.expression)
          if (recv !== "v") return recv
        }
        const a = e.arguments[0] && unparen(e.arguments[0])
        if (a && ts.isIdentifier(a)) return a.text
        if (a && ts.isPropertyAccessExpression(a)) return a.name.text
        return calleeName(e) || "v"
      }
      return "v"
    }
    return {
      add(expr, valueText) {
        const src = expr.getText(sf)
        if (byExpr.has(src)) return byExpr.get(src)
        const base = suggest(expr).replace(/[^\w]/g, "") || "v"
        let name = base
        for (let i = 2; taken.has(name); i++) name = base + i
        byExpr.set(src, name)
        taken.set(name, valueText)
        return name
      },
      objectText() {
        const fields = [...taken].map(([n, v]) => (n === v ? n : `${n}: ${v}`))
        return `{ ${fields.join(", ")} }`
      },
      get size() {
        return taken.size
      },
    }
  }

  const isInlineExpr = (expr) =>
    isStringLit(expr) || isStrictStringOrNumber(checker.getTypeAtLocation(expr))

  /** Ketma-ket kelgan JSX matni va satr/son ifodalari — bitta gap. */
  const emitRun = (run, edits) => {
    const raws = run.map((ch) => (ts.isJsxText(ch) ? text.slice(ch.pos, ch.end) : null))
    const fallback = () => {
      for (const ch of run) if (!ts.isJsxText(ch)) visit(ch, edits)
    }
    if (!raws.some((r) => r !== null && hasWord(r))) return fallback()
    // &apos; kabi entity'lar ochiladi; notanishi yoki manbadagi g'alati
    // bo'shliq (uzilmas va h.k.) bo'lsa — qo'lda ko'riladi
    if (raws.some((r) => r !== null && (decodeJsxEntities(r) === null || /[^\S \t\r\n]/.test(r)))) {
      report.entities.push({ line: lineOf(run[0]), text: raws.filter(Boolean).join(" | ").trim() })
      return fallback()
    }

    const names = makeNamer()
    let combined = ""
    let staticText = ""
    run.forEach((ch, i) => {
      if (raws[i] !== null) {
        const v = decodeJsxEntities(normalizeJsxText(raws[i]))
        combined += v
        staticText += v
      } else if (isStringLit(ch.expression)) {
        combined += ch.expression.text
        staticText += ch.expression.text
      } else {
        combined += `{{${names.add(ch.expression, render(ch.expression))}}}`
        staticText += " "
      }
    })
    const lead = combined.match(/^[ \t]*/)[0]
    const trail = combined.slice(lead.length).match(/[ \t]*$/)[0]
    const key = combined.slice(lead.length, combined.length - trail.length)
    // JSX bolasi doim ko'rinadi — bitta kichik so'z ham matn
    let kind = classify(staticText)
    const textOnly = raws.filter((r) => r !== null).map(normalizeJsxText).join(" ")
    if (kind === "technical" && run.some((ch) => !ts.isJsxText(ch)) && displayFragment(textOnly.replace(/\s+/g, ""))) {
      kind = "natural" // ifoda yonidagi "-xona", "ta" — JSX'da doim ko'rinadi
    }
    if (kind === "technical" || !hasWord(staticText)) return fallback()
    if (identity.has(key)) {
      report.identity.push({ line: lineOf(run[0]), text: key })
      return fallback()
    }

    const first = run[0]
    const last = run[run.length - 1]
    let start = ts.isJsxText(first) ? first.pos : first.getStart(sf)
    let end = last.end
    if (ts.isJsxText(first)) {
      const ws = raws[0].match(/^\s*/)[0]
      if (/[\r\n]/.test(ws)) start += ws.length // format bo'shlig'i joyida qoladi
    }
    if (ts.isJsxText(last)) {
      const ws = raws[raws.length - 1].match(/\s*$/)[0]
      if (/[\r\n]/.test(ws)) end -= ws.length
    }
    if (end <= start) return fallback()

    addKey(key)
    if (names.size) report.merged += 1
    const args = names.size ? `, ${names.objectText()}` : ""
    edits.push({
      start,
      end,
      text:
        (lead ? `{${lit(lead)}}` : "") +
        `{${FN}(${lit(key)}${args})}` +
        (trail ? `{${lit(trail)}}` : ""),
    })
  }

  const handleChildren = (children, edits) => {
    let run = []
    const flush = () => {
      if (run.length) emitRun(run, edits)
      run = []
    }
    for (const ch of children) {
      if (ts.isJsxText(ch)) run.push(ch)
      else if (ts.isJsxExpression(ch) && ch.expression && !ch.dotDotDotToken && isInlineExpr(ch.expression)) run.push(ch)
      else {
        flush()
        visit(ch, edits)
      }
    }
    flush()
  }

  const containsJsx = (node) => {
    let found = false
    ;(function walk(n) {
      if (found) return
      if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) found = true
      else ts.forEachChild(n, walk)
    })(node)
    return found
  }

  const handleAttribute = (node, edits) => {
    const name = node.name.getText(sf)
    const init = node.initializer
    if (!init) return
    if (name === "value" && ts.isJsxExpression(init) && init.expression) {
      return visitValue(init.expression, edits)
    }
    if (isAttrSkipped(name)) {
      // action={<div>…</div>} kabi: nomi texnik, lekin ichida ko'rinadigan JSX bor
      if (ts.isJsxExpression(init) && containsJsx(init)) return visit(init, edits)
      return noteSkipped(init, `attr:${name}`)
    }
    if (ts.isStringLiteral(init)) {
      const value = decodeJsxEntities(init.text)
      if (value === null) {
        report.entities.push({ line: lineOf(init), text: init.text })
        return
      }
      if (!decide(init, value, value)) return
      addKey(value)
      edits.push({ start: init.getStart(sf), end: init.end, text: `{${FN}(${lit(value)})}` })
      return
    }
    visit(init, edits)
  }

  function visit(node, edits) {
    if (ts.isStatement(node) && hasDirective(node)) return
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isImportEqualsDeclaration(node)) return
    if (ts.isTypeNode(node) || ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) return
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
      if (ts.isJsxElement(node)) visit(node.openingElement, edits)
      handleChildren(node.children, edits)
      return
    }
    if (ts.isJsxAttribute(node)) return handleAttribute(node, edits)
    if (isStringLit(node)) return handleLiteral(node, edits)
    if (ts.isTemplateExpression(node) && handleTemplate(node, edits)) return
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const callee = node.expression
      const name = ts.isCallExpression(node) ? calleeName(node) : callee.getText(sf)
      const deep =
        CALL_SKIP_DEEP.has(name) ||
        callee.getText(sf).startsWith("console.") ||
        callee.getText(sf).startsWith("Intl.")
      if (name === FN || name === "trc") return // allaqachon o'ralgan
      if (deep) {
        visit(callee, edits)
        for (const a of node.arguments ?? []) noteSkipped(a, `call:${name}`)
        return
      }
    }
    if (ts.isPropertyAssignment(node) && node.name.getText(sf) === "value") {
      return visitValue(node.initializer, edits)
    }
    if (ts.isPropertyAssignment(node) && PROP_SKIP.has(node.name.getText(sf))) {
      return noteSkipped(node.initializer, `prop:${node.name.getText(sf)}`)
    }
    ts.forEachChild(node, (c) => visit(c, edits))
  }

  const edits = []
  // Yuqori darajadagi e'lonlar bo'yicha hisob: qaysi konstantada nechta matn
  // o'raldi (massiv ichidagilari alohida) — qiymat/yorliq ekanini ko'rib chiqish uchun
  for (const st of sf.statements) {
    const before = report.keys.length
    const beforeArr = arrayHits
    visit(st, edits)
    const count = report.keys.length - before
    if (count && !ts.isFunctionDeclaration(st)) {
      let name = ""
      if (ts.isVariableStatement(st)) {
        const d = st.declarationList.declarations[0]
        name = d.name.getText(sf)
        const init = d.initializer
        if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) continue
      }
      report.decls.push({ line: lineOf(st), name, count, arrayItems: arrayHits - beforeArr })
    }
  }
  if (edits.length === 0) return { report, output: null }

  // tr nomi faylda band emasligini tekshirish (o'zimizning importdan tashqari)
  let hasImport = false
  let clash = false
  ;(function scan(node) {
    if (ts.isImportDeclaration(node)) {
      const from = node.moduleSpecifier.text
      const named = node.importClause?.namedBindings
      if (named && ts.isNamedImports(named) && named.elements.some((e) => e.name.text === FN)) {
        if (from === MODULE) hasImport = true
        else clash = true
      }
      return
    }
    if (
      (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isFunctionDeclaration(node) || ts.isBindingElement(node)) &&
      node.name && ts.isIdentifier(node.name) && node.name.text === FN
    ) {
      clash = true
    }
    ts.forEachChild(node, scan)
  })(sf)
  if (clash) throw new Error(`${rel}: "${FN}" nomi allaqachon band — qo'lda hal qiling`)

  if (!hasImport) {
    const imports = sf.statements.filter(ts.isImportDeclaration)
    const semi = imports.length ? text.slice(imports[0].end - 1, imports[0].end) === ";" : false
    const quote = imports.length && imports[0].moduleSpecifier.getText(sf).startsWith("'") ? "'" : '"'
    const line = `import { ${FN} } from ${quote}${MODULE}${quote}${semi ? ";" : ""}`
    // Import boshqa tahrirlar bilan birga, asl matn bo'yicha qo'yiladi
    if (imports.length) {
      const at = imports[imports.length - 1].end
      edits.push({ start: at, end: at, text: "\n" + line })
    } else {
      edits.push({ start: 0, end: 0, text: line + "\n" })
    }
  }
  return { report, output: applyEdits(0, text.length, edits) }
}

// --- Ishga tushirish -------------------------------------------------------

const reports = []
let changed = 0
for (const sf of program.getSourceFiles()) {
  if (!isTarget(sf.fileName)) continue
  const { report, output } = processFile(sf)
  reports.push(report)
  if (output !== null && output !== sf.text) {
    changed += 1
    if (WRITE) fs.writeFileSync(sf.fileName, output)
  }
}

const sum = (f) => reports.reduce((n, r) => n + f(r), 0)
const keys = new Set(reports.flatMap((r) => r.keys))
console.log(`Fayllar: ${reports.length}, o'zgaradigan: ${changed}${WRITE ? " (yozildi)" : " (faqat hisobot)"}`)
console.log(`O'ralgan joylar: ${sum((r) => r.wrapped)}, noyob kalitlar: ${keys.size}, o'zgaruvchili: ${sum((r) => r.merged)}`)
console.log(`Qo'lda ko'rish — identity: ${sum((r) => r.identity.length)}, ambiguous: ${sum((r) => r.ambiguous.length)}, skipped: ${sum((r) => r.skipped.length)}, entities: ${sum((r) => r.entities.length)}, payload: ${sum((r) => r.payload.length)}`)
if (REPORT) {
  fs.writeFileSync(REPORT, JSON.stringify(reports.filter((r) => r.wrapped || r.identity.length || r.ambiguous.length || r.skipped.length || r.entities.length), null, 1))
  console.log(`Hisobot: ${REPORT}`)
}
