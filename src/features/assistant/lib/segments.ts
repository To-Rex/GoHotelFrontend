import type { AiAction, AiMessage, Block, StepInfo } from "../api/assistant"

/* Oqim bilan kelayotgan javobni yig'ish: matn bo'laklari va bloklar
   TARTIBI bilan (server ham xuddi shunday saqlaydi — agent.py). Matn
   kelganda oxirgi segment matn bo'lsa unga qo'shiladi, aks holda yangi
   matn segmenti ochiladi; blok — yangi segment. */

export function appendDelta(blocks: Block[], text: string): Block[] {
  if (!text) return blocks
  const last = blocks[blocks.length - 1]
  if (last && last.type === "text") {
    return [...blocks.slice(0, -1), { type: "text", text: last.text + text }]
  }
  return [...blocks, { type: "text", text }]
}

export function appendBlock(blocks: Block[], block: Block): Block[] {
  return [...blocks, block]
}

/** Qadam: "running" keyin o'sha id bilan "done"/"error" keladi. */
export function upsertStep(steps: StepInfo[], step: StepInfo): StepInfo[] {
  const i = steps.findIndex((s) => s.id === step.id)
  if (i < 0) return [...steps, step]
  const next = steps.slice()
  next[i] = { ...steps[i], ...step }
  return next
}

/** Karta holati o'zgardi (tasdiq, qaytarish) — barcha xabarlarda yangilanadi. */
export function replaceAction(messages: AiMessage[], action: AiAction): AiMessage[] {
  let changed = false
  const out = messages.map((m) => {
    if (!m.blocks.some((b) => b.type === "action" && b.action.id === action.id)) return m
    changed = true
    return {
      ...m,
      blocks: m.blocks.map((b) => (b.type === "action" && b.action.id === action.id ? { ...b, action } : b)),
    }
  })
  return changed ? out : messages
}

/** Suhbatdagi OXIRGI javobning tez javob variantlari (faqat o'sha ko'rinadi). */
export function lastReplies(messages: AiMessage[]): string[] {
  const last = messages[messages.length - 1]
  if (!last || last.role !== "assistant") return []
  const b = [...last.blocks].reverse().find((x) => x.type === "replies")
  return b && b.type === "replies" ? b.options : []
}

/** Javob matni bo'sh va blok yo'q — "javob yo'q" holati. */
export const isEmptyAnswer = (m: AiMessage): boolean =>
  !m.text.trim() && !m.blocks.some((b) => b.type !== "text" && b.type !== "replies")
