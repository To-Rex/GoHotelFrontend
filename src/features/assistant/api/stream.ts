import { api, API_URL } from "@/lib/api"
import { getDeviceId } from "@/lib/deviceId"

import type { AiLimits, AiMessage, Block, Conversation, StepInfo } from "./assistant"

/* Xabar yuborish — server javobi OQIM bo'lib keladi (text/event-stream).

   axios brauzerda javobni bo'lib-bo'lib o'qiy olmaydi, shuning uchun
   `fetch` + ReadableStream. Token va qurilma sarlavhasi api.ts dagidek.
   401 bo'lsa — axios orqali bitta yengil so'rov (/ai/me): uning
   interceptor'i tokenni yangilaydi, keyin oqim bir marta qayta boshlanadi.

   Hodisalar (server: app/application/services/ai/agent.py):
     user  {message, conversation}   start {assistant:{id}}
     delta {text}  block {block}  step {...}  done {message, usage, limits}
     error {code, message} */

export interface DonePayload {
  message: AiMessage
  usage: { input: number; output: number; cached: number; cost_usd: number | null; seconds: number }
  limits: AiLimits
}

export interface StreamHandlers {
  onUser?: (message: AiMessage, conversation: Conversation) => void
  onStart?: (assistantId: string) => void
  onDelta?: (text: string) => void
  onBlock?: (block: Block) => void
  onStep?: (step: StepInfo) => void
  onDone?: (payload: DonePayload) => void
  onError?: (error: { code: string; message: string }) => void
}

export class StreamHttpError extends Error {
  status: number
  code: string | null

  constructor(status: number, message: string, code: string | null) {
    super(message)
    this.status = status
    this.code = code
  }
}

export interface SseEvent {
  event: string
  data: unknown
}

/** Bufferdagi to'liq hodisalarni ajratadi; chala qism `rest` da qoladi. */
export function parseSse(buffer: string): { events: SseEvent[]; rest: string } {
  const events: SseEvent[] = []
  const normalized = buffer.replace(/\r\n/g, "\n")
  const parts = normalized.split("\n\n")
  const rest = parts.pop() ?? ""
  for (const part of parts) {
    let name = "message"
    const data: string[] = []
    for (const line of part.split("\n")) {
      if (!line || line.startsWith(":")) continue
      if (line.startsWith("event:")) name = line.slice(6).trim()
      else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""))
    }
    if (!data.length) continue
    try {
      events.push({ event: name, data: JSON.parse(data.join("\n")) })
    } catch {
      // Buzilgan hodisa — tashlab ketiladi (keyingilari ishlayveradi)
    }
  }
  return { events, rest }
}

function dispatch(ev: SseEvent, h: StreamHandlers) {
  const d = ev.data as Record<string, unknown>
  switch (ev.event) {
    case "user":
      h.onUser?.(d.message as AiMessage, d.conversation as Conversation)
      break
    case "start":
      h.onStart?.(String((d.assistant as { id: string })?.id ?? ""))
      break
    case "delta":
      h.onDelta?.(String(d.text ?? ""))
      break
    case "block":
      h.onBlock?.(d.block as Block)
      break
    case "step":
      h.onStep?.(d as unknown as StepInfo)
      break
    case "done":
      h.onDone?.(d as unknown as DonePayload)
      break
    case "error":
      h.onError?.({ code: String(d.code ?? "error"), message: String(d.message ?? "") })
      break
  }
}

async function open(url: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "text/event-stream" }
  const token = localStorage.getItem("accessToken")
  if (token) headers.Authorization = `Bearer ${token}`
  const deviceId = getDeviceId()
  if (deviceId) headers["X-Device-Id"] = deviceId
  return fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal })
}

async function httpError(res: Response): Promise<StreamHttpError> {
  let message = `HTTP ${res.status}`
  let code: string | null = null
  try {
    const data = await res.json()
    if (typeof data?.detail === "string") message = data.detail
    code = data?.error_code ?? null
  } catch {
    // JSON emas — HTTP holati yetadi
  }
  return new StreamHttpError(res.status, message, code)
}

export interface SendBody {
  text?: string
  page?: string | null
  pages?: string[]
  continue_action?: string
}

export async function streamMessage(
  conversationId: string,
  body: SendBody,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const url = `${API_URL.replace(/\/$/, "")}/ai/conversations/${conversationId}/messages`
  let res = await open(url, body, signal)
  if (res.status === 401) {
    // Token eskirgan — axios interceptor yangilaydi, so'ng bir marta qayta
    await api.get("/ai/me").catch(() => undefined)
    res = await open(url, body, signal)
  }
  if (!res.ok || !res.body) throw await httpError(res)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const { events, rest } = parseSse(buffer)
    buffer = rest
    for (const ev of events) dispatch(ev, handlers)
  }
  buffer += decoder.decode()
  if (buffer.trim()) {
    const { events } = parseSse(buffer + "\n\n")
    for (const ev of events) dispatch(ev, handlers)
  }
}
