import { describe, expect, it } from "vitest"

import type { ActionField, AiAction, AiMessage } from "../api/assistant"
import { parseSse } from "../api/stream"
import { changedValues, fieldDisplay, inputValue, resultSummary } from "./actions"
import { formatAxisLabel, formatCell, formatCompact, formatNumber, valueLabel } from "./format"
import { parseInline, parseMarkdown, safeHref } from "./markdown"
import { appendBlock, appendDelta, lastReplies, replaceAction, upsertStep } from "./segments"

describe("markdown — xavfsiz tahlil", () => {
  it("qalin, kursiv, kod va havola", () => {
    expect(parseInline("**Jami:** 5 ta `r1` *muhim* [Bron](/booking)")).toEqual([
      { t: "b", c: [{ t: "text", v: "Jami:" }] },
      { t: "text", v: " 5 ta " },
      { t: "code", v: "r1" },
      { t: "text", v: " " },
      { t: "i", c: [{ t: "text", v: "muhim" }] },
      { t: "text", v: " " },
      { t: "link", href: "/booking", c: [{ t: "text", v: "Bron" }] },
    ])
  })

  it("xavfli havola matn bo'lib qoladi", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull()
    expect(safeHref("//evil.example")).toBeNull()
    expect(safeHref("https://gohotels.uz")).toBe("https://gohotels.uz")
    expect(parseInline("[bos](javascript:alert(1))")).toEqual([{ t: "text", v: "bos" }, { t: "text", v: ")" }])
    // HTML teglari — oddiy matn (innerHTML ishlatilmaydi)
    expect(parseInline("<img src=x onerror=alert(1)>")).toEqual([{ t: "text", v: "<img src=x onerror=alert(1)>" }])
  })

  it("snake_case va ko'paytirish kursiv emas", () => {
    expect(parseInline("check_in_date va 2 * 3 * 4")).toEqual([{ t: "text", v: "check_in_date va 2 * 3 * 4" }])
  })

  it("bloklar: sarlavha, ro'yxat, jadval, kod", () => {
    const md = "## Natija\n- bir\n- ikki\n\n1. birinchi\n2. ikkinchi\n\n| Xona | Summa |\n|---|---:|\n| 101 | 5 000 |\n\n```\nkod\n```\nOddiy\nqator"
    const blocks = parseMarkdown(md)
    expect(blocks.map((b) => b.t)).toEqual(["h", "ul", "ol", "table", "pre", "p"])
    const table = blocks[3]
    expect(table.t === "table" && table.rows[0][1]).toEqual([{ t: "text", v: "5 000" }])
    const p = blocks[5]
    expect(p.t === "p" && p.c).toEqual([{ t: "text", v: "Oddiy" }, { t: "br" }, { t: "text", v: "qator" }])
  })
})

describe("SSE tahlil", () => {
  it("bo'laklarga bo'lingan oqim, izoh va CRLF", () => {
    const first = parseSse(': ok\n\nevent: delta\ndata: {"text":"Sa"}\n\nevent: delta\ndata: {"te')
    expect(first.events).toEqual([{ event: "delta", data: { text: "Sa" } }])
    const second = parseSse(first.rest + 'xt":"lom"}\r\n\r\n: ping\n\n')
    expect(second.events).toEqual([{ event: "delta", data: { text: "lom" } }])
    expect(second.rest).toBe("")
  })

  it("buzilgan hodisa tashlab ketiladi", () => {
    expect(parseSse("event: block\ndata: {buzuq\n\nevent: done\ndata: {}\n\n").events).toEqual([
      { event: "done", data: {} },
    ])
  })
})

const msg = (over: Partial<AiMessage>): AiMessage => ({
  id: "m", conversation_id: "c", role: "assistant", text: "", blocks: [], steps: [], provider: null, model: null,
  input_tokens: 0, output_tokens: 0, cost_usd: null, error: null, created_at: "2026-11-22T10:00:00Z", ...over,
})

const action = (over: Partial<AiAction>): AiAction => ({
  id: "a1", kind: "reservation.create", title: "Yangi bron yaratish", summary: null, method: "POST", path: "/reservations/",
  status: "proposed", risk: "medium", page: "/booking", note: null, undo_supported: true, can_undo: false,
  continue_after: false, error: null, result: null, fields: [], created_at: null, executed_at: null, undone_at: null, ...over,
})

describe("oqim segmentlari", () => {
  it("matn bo'laklari birlashadi, blok yangi segment", () => {
    let b = appendDelta([], "Sa")
    b = appendDelta(b, "lom")
    b = appendBlock(b, { type: "nav", id: "n", path: "/booking", label: "Bron", note: null })
    b = appendDelta(b, "!")
    expect(b).toEqual([
      { type: "text", text: "Salom" },
      { type: "nav", id: "n", path: "/booking", label: "Bron", note: null },
      { type: "text", text: "!" },
    ])
  })

  it("qadam holati yangilanadi", () => {
    const s = upsertStep([{ id: "1", tool: "api_get", label: "L", detail: "/rooms/", status: "running" }], {
      id: "1", tool: "api_get", label: "L", detail: "/rooms/", status: "done",
    })
    expect(s).toHaveLength(1)
    expect(s[0].status).toBe("done")
  })

  it("karta holati barcha xabarlarda almashtiriladi", () => {
    const m = [msg({ blocks: [{ type: "action", id: "b", action: action({}) }] }), msg({ id: "x" })]
    const out = replaceAction(m, action({ status: "executed" }))
    const b = out[0].blocks[0]
    expect(b.type === "action" && b.action.status).toBe("executed")
    expect(out[1]).toBe(m[1])
    expect(replaceAction(m, action({ id: "boshqa" }))).toBe(m)
  })

  it("tez javoblar faqat oxirgi javobdan", () => {
    const replies = { type: "replies" as const, id: "r", options: ["Ha", "Yo'q"] }
    expect(lastReplies([msg({ blocks: [replies] })])).toEqual(["Ha", "Yo'q"])
    expect(lastReplies([msg({ blocks: [replies] }), msg({ role: "user" })])).toEqual([])
  })
})

describe("formatlash", () => {
  it("summa matn bo'lsa ham", () => {
    expect(formatNumber("1250000.00")).toBe("1 250 000")
    expect(formatNumber(-45000)).toBe("−45 000")
    expect(formatNumber(12.345)).toBe("12,35")
    expect(formatNumber(null)).toBe("—")
    expect(formatNumber("abc")).toBe("abc")
  })

  it("ixcham token", () => {
    expect(formatCompact(950)).toBe("950")
    expect(formatCompact(1250)).toBe("1,3K")
    expect(formatCompact(48_000)).toBe("48K")
    expect(formatCompact(1_250_000)).toBe("1,25M")
  })

  it("katak va o'q yorliqlari", () => {
    expect(formatCell("2026-11-21", "date")).toBe("21.11.2026")
    expect(formatCell("2026-11-21T09:30:00+00:00", "datetime")).toBe("21.11.2026 14:30")
    expect(formatCell("5000.40", "money")).toBe("5 000")
    expect(formatAxisLabel("2026-11-21")).toBe("21.11")
    expect(formatAxisLabel("2026-11")).toBe("11.2026")
    // Bazadagi kodlar — tushunarli nom; noma'lum kod va oddiy matn o'zgarmaydi
    expect(valueLabel("AVAILABLE")).toBe("Bo'sh")
    expect(formatCell("CHECKED_IN", "text")).toBe("Joylashgan")
    expect(formatAxisLabel("CASH")).toBe("Naqd")
    expect(valueLabel("SOME_CODE")).toBe("SOME_CODE")
    expect(valueLabel("Lyuks")).toBe("Lyuks")
  })
})

const field = (over: Partial<ActionField>): ActionField => ({
  name: "f", label: "F", kind: "text", required: false, value: null, display: null, options: null, in_body: true,
  hint: null, ...over,
})

describe("amal kartasi", () => {
  it("faqat o'zgargan maydonlar yuboriladi", () => {
    const fields = [field({ name: "adults" }), field({ name: "notes" }), field({ name: "room_id", kind: "id" })]
    const initial = { adults: 1, notes: "x", room_id: "r" }
    expect(changedValues(fields, initial, { ...initial })).toBeUndefined()
    expect(changedValues(fields, initial, { adults: "2", notes: "", room_id: "r" })).toEqual({ adults: "2", notes: null })
  })

  it("ko'rinish va forma qiymatlari", () => {
    expect(fieldDisplay(field({ kind: "id", display: "205 — Lyuks" }), "uuid")).toBe("205 — Lyuks")
    expect(fieldDisplay(field({ kind: "id" }), "12345678-aaaa")).toBe("#12345678")
    expect(fieldDisplay(field({ kind: "select", options: [{ value: "CASH", label: "Naqd" }] }), "CASH")).toBe("Naqd")
    expect(inputValue(field({ kind: "datetime" }), "2026-11-23T14:00:00")).toBe("2026-11-23T14:00")
    expect(inputValue(field({ kind: "date" }), null)).toBe("")
    expect(fieldDisplay(field({ kind: "date" }), "2026-11-23")).toBe("23.11.2026")
    expect(fieldDisplay(field({ kind: "datetime" }), "2026-11-23T14:00:00")).toBe("23.11.2026 14:00")
  })

  it("natija qisqasi", () => {
    expect(resultSummary({ id: "x", reservation_number: "R-77", total_amount: "1000000.00", status: "CONFIRMED" })).toEqual([
      { label: "Bron raqami", value: "R-77" },
      { label: "Jami", value: 1000000 },
    ])
    expect(resultSummary(null)).toEqual([])
  })
})
