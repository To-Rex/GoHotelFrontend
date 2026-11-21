/* Yordamchi javobidagi yengil Markdown — XAVFSIZ tahlil (HTML yo'q).

   Model matni hech qachon innerHTML bo'lib qo'yilmaydi: tahlilchi uni
   tugunlar daraxtiga aylantiradi, React esa oddiy elementlar chizadi.
   Havolalar: ilova ichidagi yo'l ("/booking") yoki http(s) — boshqasi
   (javascript:, data: ...) oddiy matn bo'lib qoladi.

   Qo'llanadi: **qalin**, *kursiv*, `kod`, [havola](/yo'l), sarlavhalar
   (#, ##, ###), ro'yxatlar (-, *, •, 1.), iqtibos (>), ``` kod bloki,
   --- chiziq va kichik jadval (| a | b |). */

export type Inline =
  | { t: "text"; v: string }
  | { t: "b"; c: Inline[] }
  | { t: "i"; c: Inline[] }
  | { t: "code"; v: string }
  | { t: "link"; href: string; c: Inline[] }
  | { t: "br" }

export type MdBlock =
  | { t: "p"; c: Inline[] }
  | { t: "h"; level: 1 | 2 | 3; c: Inline[] }
  | { t: "ul"; items: Inline[][] }
  | { t: "ol"; start: number; items: Inline[][] }
  | { t: "quote"; c: Inline[] }
  | { t: "pre"; v: string }
  | { t: "hr" }
  | { t: "table"; head: Inline[][]; rows: Inline[][][] }

const TOKEN =
  /(\*\*|__)(?=\S)([\s\S]+?)(?<=\S)\1|`([^`\n]+)`|\[([^\]\n]+)\]\(([^)\s]+)\)|(?<![\w*])\*(?=[^\s*])([^*\n]+?)(?<=\S)\*(?![\w*])|(?<![\w])_(?=\S)([^_\n]+?)(?<=\S)_(?![\w])/

export const safeHref = (href: string): string | null => {
  const h = href.trim()
  if (h.startsWith("/") && !h.startsWith("//")) return h
  if (/^https?:\/\//i.test(h)) return h
  return null
}

export function parseInline(text: string, depth = 0): Inline[] {
  const out: Inline[] = []
  const pushText = (s: string) => {
    if (!s) return
    const lines = s.split("\n")
    lines.forEach((line, i) => {
      if (i > 0) out.push({ t: "br" })
      if (line) out.push({ t: "text", v: line })
    })
  }
  let rest = text
  while (rest) {
    const m = depth < 4 ? TOKEN.exec(rest) : null
    if (!m) {
      pushText(rest)
      break
    }
    pushText(rest.slice(0, m.index))
    if (m[1]) out.push({ t: "b", c: parseInline(m[2], depth + 1) })
    else if (m[3] !== undefined) out.push({ t: "code", v: m[3] })
    else if (m[4] !== undefined) {
      const href = safeHref(m[5])
      if (href) out.push({ t: "link", href, c: parseInline(m[4], depth + 1) })
      else pushText(m[4])
    } else if (m[6] !== undefined) out.push({ t: "i", c: parseInline(m[6], depth + 1) })
    else if (m[7] !== undefined) out.push({ t: "i", c: parseInline(m[7], depth + 1) })
    rest = rest.slice(m.index + m[0].length)
  }
  return out
}

const BULLET = /^\s*[-*•]\s+(.*)$/
const ORDERED = /^\s*(\d{1,3})[.)]\s+(.*)$/
const HEADING = /^(#{1,3})\s+(.*)$/
const HR = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/

const splitRow = (line: string): string[] =>
  line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim())

export function parseMarkdown(src: string): MdBlock[] {
  const lines = (src || "").replace(/\r\n/g, "\n").split("\n")
  const blocks: MdBlock[] = []
  let i = 0
  let para: string[] = []
  const flush = () => {
    if (para.length) {
      blocks.push({ t: "p", c: parseInline(para.join("\n")) })
      para = []
    }
  }
  while (i < lines.length) {
    const line = lines[i]
    if (/^\s*```/.test(line)) {
      flush()
      const body: string[] = []
      i++
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++])
      i++
      blocks.push({ t: "pre", v: body.join("\n") })
      continue
    }
    if (!line.trim()) {
      flush()
      i++
      continue
    }
    const h = HEADING.exec(line)
    if (h) {
      flush()
      blocks.push({ t: "h", level: h[1].length as 1 | 2 | 3, c: parseInline(h[2].trim()) })
      i++
      continue
    }
    if (HR.test(line)) {
      flush()
      blocks.push({ t: "hr" })
      i++
      continue
    }
    if (line.includes("|") && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
      flush()
      const head = splitRow(line).map((c) => parseInline(c))
      i += 2
      const rows: Inline[][][] = []
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        rows.push(splitRow(lines[i]).map((c) => parseInline(c)))
        i++
      }
      blocks.push({ t: "table", head, rows })
      continue
    }
    if (BULLET.test(line)) {
      flush()
      const items: Inline[][] = []
      while (i < lines.length && BULLET.test(lines[i])) {
        items.push(parseInline(BULLET.exec(lines[i])![1]))
        i++
      }
      blocks.push({ t: "ul", items })
      continue
    }
    const o = ORDERED.exec(line)
    if (o) {
      flush()
      const items: Inline[][] = []
      const start = Number(o[1])
      while (i < lines.length && ORDERED.test(lines[i])) {
        items.push(parseInline(ORDERED.exec(lines[i])![2]))
        i++
      }
      blocks.push({ t: "ol", start, items })
      continue
    }
    if (/^\s*>\s?/.test(line)) {
      flush()
      const body: string[] = []
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ""))
      blocks.push({ t: "quote", c: parseInline(body.join("\n")) })
      continue
    }
    para.push(line)
    i++
  }
  flush()
  return blocks
}
