#!/usr/bin/env node
// tr() ga o'rash O'ZBEKCHA natijani o'zgartirmaganini tekshiradi.
//
//   node scripts/i18n/verify.mjs [git-ref]     (standart: HEAD)
//
// Har o'zgargan fayl uchun eski (git) va yangi (disk) variant AST'ga
// aylantiriladi; yangi variantdagi tr("…") chaqiruvlari "ochiladi":
//     tr("Saqlash")                    → "Saqlash"
//     tr("{{n}} ta xona", { n })       → `${n} ta xona`
//     <p>{tr("Jami {{n}} ta", { n })}</p> → <p>Jami {n} ta</p>
//     tr(qiymat)                       → qiymat
// So'ng ikki daraxt solishtiriladi. Teng chiqsa — o'zbek tilida kod aynan
// avvalgidek ishlaydi (tr o'zbekchada kalitni o'zini qaytaradi).
// Farq chiqqan fayllar ro'yxati ko'rsatiladi — ular qo'lda ko'riladi
// (masalan, til tanlagich qo'shilgan Navbar).
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import ts from "typescript"

import { decodeJsxEntities, normalizeJsxText } from "./classify.mjs"

const REF = process.argv[2] || "HEAD"
const FN = "tr"
const MODULE = "@/i18n"

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28 })
const isStringLit = (n) => ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)

function canon(fileName, text) {
  const kind = fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind)

  const isTrCall = (n) =>
    ts.isCallExpression(n) && ts.isIdentifier(n.expression) &&
    ((n.expression.text === FN && n.arguments.length >= 1) ||
      (n.expression.text === "trc" && n.arguments.length >= 2))
  /** trc(kontekst, kalit, params) → tr(kalit, params) argumentlari */
  const trArgs = (call) => (call.expression.text === "trc" ? call.arguments.slice(1) : call.arguments)

  /** String(x) → x: shablon satrga o'zi aylantiradi. */
  const unString = (n) =>
    ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "String" && n.arguments.length === 1
      ? n.arguments[0]
      : n

  /** tr chaqiruvi → bo'laklar: {text} yoki {expr}. null — dinamik tr(x). */
  const trSegments = (call) => {
    const [key, params] = trArgs(call)
    if (!isStringLit(key)) return null
    const values = new Map()
    if (params && ts.isObjectLiteralExpression(params)) {
      for (const p of params.properties) {
        if (ts.isPropertyAssignment(p)) values.set(p.name.getText(sf), p.initializer)
        else if (ts.isShorthandPropertyAssignment(p)) values.set(p.name.text, p.name)
      }
    }
    const segs = []
    let last = 0
    for (const m of key.text.matchAll(/\{\{(\w+)\}\}/g)) {
      if (!values.has(m[1])) continue // parametrsiz o'rin — oddiy matn
      if (m.index > last) segs.push({ text: key.text.slice(last, m.index) })
      segs.push({ expr: ser(unString(values.get(m[1]))) })
      last = m.index + m[0].length
    }
    if (last < key.text.length) segs.push({ text: key.text.slice(last) })
    return segs
  }

  const serSegments = (segs) => {
    const merged = []
    for (const s of segs) {
      const prev = merged[merged.length - 1]
      if (s.text !== undefined && prev && prev.text !== undefined) prev.text += s.text
      else if (s.text !== "") merged.push({ ...s })
    }
    if (merged.length === 0) return 'S("")'
    if (merged.length === 1 && merged[0].text !== undefined) return `S(${JSON.stringify(merged[0].text)})`
    return `T(${merged.map((s) => (s.text !== undefined ? JSON.stringify(s.text) : s.expr)).join("+")})`
  }

  const serChildren = (children) => {
    const segs = []
    for (const ch of children) {
      if (ts.isJsxText(ch)) {
        const raw = normalizeJsxText(text.slice(ch.pos, ch.end))
        const v = decodeJsxEntities(raw) ?? raw
        if (v) segs.push({ text: v })
      } else if (ts.isJsxExpression(ch)) {
        const e = ch.expression
        if (!e) segs.push({ expr: "∅" })
        else if (isStringLit(e)) segs.push({ text: e.text })
        else if (isTrCall(e) && trSegments(e)) segs.push(...trSegments(e))
        else segs.push({ expr: ser(e) })
      } else {
        segs.push({ expr: ser(ch) })
      }
    }
    const merged = []
    for (const s of segs) {
      const prev = merged[merged.length - 1]
      if (s.text !== undefined && prev && prev.text !== undefined) prev.text += s.text
      else merged.push({ ...s })
    }
    return merged.map((s) => (s.text !== undefined ? JSON.stringify(s.text) : s.expr)).join(";")
  }

  function ser(node) {
    // Qavs daraxt tuzilishida allaqachon aks etgan — o'zi ma'no qo'shmaydi
    if (ts.isParenthesizedExpression(node)) return ser(node.expression)
    if (isTrCall(node)) {
      const segs = trSegments(node)
      // tr(x): o'zbekchada x ning o'zi
      return segs ? serSegments(segs) : ser(trArgs(node)[0])
    }
    if (isStringLit(node)) return `S(${JSON.stringify(node.text)})`
    if (ts.isTemplateExpression(node)) {
      const segs = [{ text: node.head.text }]
      for (const span of node.templateSpans) {
        segs.push({ expr: ser(unString(span.expression)) })
        segs.push({ text: span.literal.text })
      }
      return serSegments(segs)
    }
    if (ts.isImportDeclaration(node)) {
      if (node.moduleSpecifier.text === MODULE) return ""
    }
    if (ts.isJsxElement(node)) {
      return `El(${ser(node.openingElement)}|${serChildren(node.children)})`
    }
    if (ts.isJsxFragment(node)) return `Fr(${serChildren(node.children)})`
    if (ts.isJsxAttribute(node)) {
      const init = node.initializer
      let v = "true"
      if (init) {
        if (ts.isStringLiteral(init)) v = `S(${JSON.stringify(decodeJsxEntities(init.text) ?? init.text)})`
        else if (ts.isJsxExpression(init) && init.expression) v = ser(init.expression)
        else v = ser(init)
      }
      return `At(${node.name.getText(sf)}=${v})`
    }
    const kids = []
    ts.forEachChild(node, (c) => {
      const s = ser(c)
      if (s) kids.push(s)
    })
    let extra = ""
    if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) extra = `op${node.operator}:`
    if (ts.isVariableDeclarationList(node)) extra = `f${node.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const)}:`
    // Barg tugun: bo'shliq va qator oxiri (CRLF/LF) farqi hisobga olinmaydi
    if (kids.length === 0) return `${node.kind}:${node.getText(sf).replace(/\s+/g, " ")}`
    return `${node.kind}(${extra}${kids.join(",")})`
  }
  return ser(sf)
}

const changed = git("diff", "--name-only", REF, "--", "src")
  .split("\n")
  .map((f) => f.trim())
  .filter((f) => /\.tsx?$/.test(f) && !f.startsWith("src/i18n/"))

let same = 0
const different = []
for (const file of changed) {
  if (!fs.existsSync(file)) continue
  let before
  try {
    before = git("show", `${REF}:${file}`)
  } catch {
    continue // yangi fayl
  }
  const after = fs.readFileSync(file, "utf8")
  const a = canon(file, before)
  const b = canon(file, after)
  if (a === b) {
    same += 1
    continue
  }
  let i = 0
  while (i < a.length && a[i] === b[i]) i++
  different.push({ file, was: a.slice(Math.max(0, i - 70), i + 110), now: b.slice(Math.max(0, i - 70), i + 110) })
}

console.log(`O'zgargan fayllar: ${changed.length}; o'zbekchada aynan bir xil: ${same}; farq qiladi: ${different.length}`)
for (const d of different) {
  console.log(`\n✗ ${d.file}\n   eski:  …${d.was}…\n   yangi: …${d.now}…`)
}
process.exit(different.length ? 1 : 0)
