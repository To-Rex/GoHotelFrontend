#!/usr/bin/env node
// Koddagi tr("…") kalitlarini yig'adi va lug'atlar (ru, en) bilan solishtiradi.
//
//   node scripts/i18n/check.mjs                — holat; lug'atda XATO bo'lsa xato kodi
//   node scripts/i18n/check.mjs --strict       — tarjimasi yo'q kalit ham xato hisoblanadi
//   node scripts/i18n/check.mjs --todo <papka> — tarjimasi yo'q kalitlarni
//                                                 bo'limlar bo'yicha JSON qilib yozadi
//   node scripts/i18n/check.mjs --prune        — kodda qolmagan kalitlarni lug'atdan olib tashlaydi
//
// Tekshiriladi:
//   - har kalitning ruscha va inglizcha tarjimasi bor;
//   - {{o'zgaruvchi}}lar tarjimada ham aynan o'sha;
//   - kalit chetidagi bo'shliq tarjimada ham saqlangan ("Jami: " → "Итого: ").
// Kalitlar manbai: tr("…") ning birinchi argumenti va `// i18n:keys` izohi
// qo'yilgan ifoda ichidagi matnlar (bazaga o'zbekcha yoziladigan qiymatlar —
// ular ekranda tr(qiymat) bilan tarjima qilinadi).
import fs from "node:fs"
import path from "node:path"
import ts from "typescript"

import { hasWord } from "./classify.mjs"

const ROOT = process.cwd()
const SRC = path.join(ROOT, "src")
const LOCALES = path.join(SRC, "i18n", "locales")
const LANGS = ["ru", "en"]
const FN = "tr"

const argv = process.argv.slice(2)
const todoIdx = argv.indexOf("--todo")
const TODO = todoIdx >= 0 ? argv[todoIdx + 1] : null
const PRUNE = argv.includes("--prune")
// Tarjimasi yo'q kalit ekranda o'zbekcha chiqadi (yiqilmaydi), shuning uchun
// odatda ogohlantirish xolos; --strict bilan to'liq tarjima talab qilinadi
const STRICT = argv.includes("--strict")

// --- Kalitlarni yig'ish ------------------------------------------------------

function walkFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (full !== LOCALES) walkFiles(full, out)
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      out.push(full)
    }
  }
  return out
}

/** Fayl qaysi bo'limga tegishli (lug'at fayli nomi). */
function areaOf(file) {
  const rel = path.relative(SRC, file).replace(/\\/g, "/")
  const m = rel.match(/^features\/([^/]+)\//)
  if (m) return m[1]
  if (rel.startsWith("superadmin/")) return "superadmin"
  return "common"
}

const isStringLit = (n) => ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)

/** kalit → shu kalit uchraydigan bo'limlar */
const keys = new Map()
const note = (key, area) => {
  if (!keys.has(key)) keys.set(key, new Set())
  keys.get(key).add(area)
}

for (const file of walkFiles(SRC)) {
  const text = fs.readFileSync(file, "utf8")
  if (!text.includes(FN + "(") && !text.includes("i18n:keys")) continue
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const area = areaOf(file)
  const marked = (node) =>
    [
      ...(ts.getLeadingCommentRanges(text, node.getFullStart()) || []),
      ...(ts.getTrailingCommentRanges(text, node.getFullStart()) || []),
    ].some((r) => text.slice(r.pos, r.end).includes("i18n:keys"))
  ;(function visit(node, inKeys) {
    const here = inKeys || marked(node)
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === FN) {
      const first = node.arguments[0]
      if (first && isStringLit(first)) note(first.text, area)
    } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "trc") {
      // trc("kontekst", "matn") — lug'atda "kontekst::matn"
      const [ctx, key] = node.arguments
      if (ctx && key && isStringLit(ctx) && isStringLit(key)) note(`${ctx.text}::${key.text}`, area)
    } else if (here && isStringLit(node) && hasWord(node.text)) {
      // obyekt kaliti emas, qiymat bo'lsa
      if (!("name" in node.parent && node.parent.name === node)) note(node.text, area)
    }
    ts.forEachChild(node, (c) => visit(c, here))
  })(sf, false)
}

// --- Lug'atlar ----------------------------------------------------------------

function readLocale(lang) {
  const dir = path.join(LOCALES, lang)
  const merged = new Map() // kalit → { value, file }
  const conflicts = []
  if (!fs.existsSync(dir)) return { merged, conflicts, files: [] }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()
  for (const f of files) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))
    for (const [k, v] of Object.entries(data)) {
      const prev = merged.get(k)
      if (prev && JSON.stringify(prev.value) !== JSON.stringify(v)) {
        conflicts.push({ key: k, a: `${prev.file}: ${JSON.stringify(prev.value)}`, b: `${f}: ${JSON.stringify(v)}` })
      }
      merged.set(k, { value: v, file: f })
    }
  }
  return { merged, conflicts, files }
}

const slots = (s) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort().join(",")
/** "kontekst::matn" — chetdagi bo'shliq matnning o'zidan olinadi */
const bare = (k) => k.replace(/^[\w-]+::/, "")
const edges = (s) => [s.match(/^\s*/)[0], s.match(/\s*$/)[0]]

let failed = false
console.log(`Koddagi kalitlar: ${keys.size}`)
if (TODO) {
  // Tarjimonlar tekshirgichi uchun: koddagi barcha kalitlar ro'yxati
  fs.mkdirSync(TODO, { recursive: true })
  fs.writeFileSync(path.join(TODO, "code-keys.json"), JSON.stringify([...keys.keys()], null, 1) + "\n")
}

for (const lang of LANGS) {
  const { merged, conflicts, files } = readLocale(lang)
  const missing = [...keys.keys()].filter((k) => !merged.has(k))
  const stale = [...merged.keys()].filter((k) => !keys.has(k))
  const broken = []
  for (const [k, { value, file }] of merged) {
    if (!keys.has(k)) continue
    const forms = typeof value === "string" ? [value] : Object.values(value)
    if (typeof value !== "string" && typeof value.other !== "string") {
      broken.push(`${file}: ${JSON.stringify(k)} — ko'plik shaklida "other" yo'q`)
    }
    for (const form of forms) {
      if (form === "") continue // ataylab bo'sh tarjima
      if (slots(form) !== slots(k)) {
        broken.push(`${file}: ${JSON.stringify(k)} — o'zgaruvchilar mos emas: ${JSON.stringify(form)}`)
      } else if (JSON.stringify(edges(form)) !== JSON.stringify(edges(bare(k)))) {
        broken.push(`${file}: ${JSON.stringify(k)} — chetdagi bo'shliq mos emas: ${JSON.stringify(form)}`)
      }
    }
  }
  console.log(
    `[${lang}] tarjima: ${merged.size - stale.length}/${keys.size}, yo'q: ${missing.length}, ` +
      `ortiqcha: ${stale.length}, xato: ${broken.length}, ziddiyat: ${conflicts.length}`
  )
  for (const b of broken.slice(0, 40)) console.log("   ✗ " + b)
  for (const c of conflicts.slice(0, 40)) console.log(`   ≠ ${JSON.stringify(c.key)}\n       ${c.a}\n       ${c.b}`)
  if (missing.length && !TODO) for (const k of missing.slice(0, 15)) console.log("   ? " + JSON.stringify(k))
  if (broken.length || conflicts.length || (STRICT && missing.length)) failed = true

  if (TODO && missing.length) {
    const byArea = new Map()
    for (const k of missing) {
      const areas = keys.get(k)
      const area = areas.size === 1 ? [...areas][0] : "common"
      if (!byArea.has(area)) byArea.set(area, {})
      byArea.get(area)[k] = ""
    }
    const dir = path.join(TODO, lang)
    fs.mkdirSync(dir, { recursive: true })
    for (const [area, obj] of byArea) {
      fs.writeFileSync(path.join(dir, `${area}.json`), JSON.stringify(obj, null, 2) + "\n")
    }
    console.log(`   → ${dir}: ${[...byArea].map(([a, o]) => `${a}(${Object.keys(o).length})`).join(", ")}`)
  }

  if (PRUNE && stale.length) {
    const staleSet = new Set(stale)
    for (const f of files) {
      const p = path.join(LOCALES, lang, f)
      const data = JSON.parse(fs.readFileSync(p, "utf8"))
      const kept = Object.fromEntries(Object.entries(data).filter(([k]) => !staleSet.has(k)))
      if (Object.keys(kept).length !== Object.keys(data).length) {
        fs.writeFileSync(p, JSON.stringify(kept, null, 2) + "\n")
      }
    }
    console.log(`   ortiqcha ${stale.length} ta kalit olib tashlandi`)
  }
}

process.exit(failed ? 1 : 0)
