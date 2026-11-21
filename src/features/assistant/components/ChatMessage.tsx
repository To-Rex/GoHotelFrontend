import { useState } from "react"
import { AlertCircle, Bot, Check, CheckCircle2, ChevronDown, Copy, Loader2, XCircle } from "lucide-react"

import { tr } from "@/i18n"
import { formatHotelMoment } from "@/lib/hotelTime"
import { cn } from "@/lib/utils"

import type { AiAction, AiMessage, Block, StepInfo } from "../api/assistant"
import { formatCompact } from "../lib/format"
import { ActionCard } from "./ActionCard"
import { ChartBlockView } from "./ChartBlockView"
import { Markdown } from "./Markdown"
import { FileBlockView, NavBlockView, PlanBlockView, RepliesView, StatsBlockView } from "./SmallBlocks"
import { TableBlockView } from "./TableBlockView"

export interface MessageHandlers {
  onActionUpdate: (a: AiAction) => void
  onContinue: (actionId: string) => void
  onReply: (text: string) => void
}

function Steps({ steps, live }: { steps: StepInfo[]; live: boolean }) {
  const [open, setOpen] = useState(false)
  if (!steps.length) return null
  const running = steps.filter((s) => s.status === "running")
  const visible = live ? steps.slice(-3) : open ? steps : []
  return (
    <div className="space-y-1">
      {!live && (
        <button
          type="button"
          onClick={() => setOpen((x) => !x)}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
          {tr("{{count}} qadam bajarildi", { count: steps.length })}
        </button>
      )}
      {visible.map((s) => (
        <p key={s.id} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {s.status === "running" ? (
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
          ) : s.status === "error" ? (
            <XCircle className="h-3 w-3 text-red-500" />
          ) : (
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
          )}
          <span>{tr(s.label)}</span>
          {s.detail && <span className="truncate font-mono text-[10px] opacity-70">{s.detail}</span>}
        </p>
      ))}
      {live && !running.length && steps.length > 0 && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin text-primary" />
          {tr("Javob tayyorlanmoqda")}
        </p>
      )}
    </div>
  )
}

function BlockView({ block, handlers }: { block: Block; handlers: MessageHandlers }) {
  switch (block.type) {
    case "text":
      return <Markdown text={block.text} />
    case "table":
      return <TableBlockView block={block} />
    case "chart":
      return <ChartBlockView block={block} />
    case "stats":
      return <StatsBlockView block={block} />
    case "file":
      return <FileBlockView block={block} />
    case "nav":
      return <NavBlockView block={block} />
    case "action":
      return (
        <ActionCard
          key={`${block.action.id}:${block.action.status}`}
          action={block.action}
          mode={block.mode}
          onUpdate={handlers.onActionUpdate}
          onContinue={handlers.onContinue}
        />
      )
    case "plan":
      return <PlanBlockView block={block} />
    default:
      return null
  }
}

export function ChatMessage({
  message,
  live,
  isLast,
  handlers,
}: {
  message: AiMessage
  live?: boolean
  isLast?: boolean
  handlers: MessageHandlers
}) {
  const [copied, setCopied] = useState(false)

  if (message.role === "user") {
    const event = message.blocks.find((b) => b.type === "event")
    if (event) {
      return (
        <div className="flex justify-center">
          <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
            {message.text}
          </span>
        </div>
      )
    }
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground shadow-sm sm:max-w-[75%]">
          <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{message.text}</p>
          <p className="mt-0.5 text-right text-[10px] opacity-70">{formatHotelMoment(message.created_at).slice(11)}</p>
        </div>
      </div>
    )
  }

  // Faqat OXIRGI variantlar bloki, takrorlarsiz
  const lastReplies = [...message.blocks].reverse().find((b) => b.type === "replies")
  const replyOptions = lastReplies && lastReplies.type === "replies" ? [...new Set(lastReplies.options)] : []
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard ruxsati yo'q — jim
    }
  }
  const tokens = (message.input_tokens || 0) + (message.output_tokens || 0)
  const empty = !message.blocks.some((b) => b.type !== "replies") && !message.error

  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-sm">
        <Bot className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-2.5">
        <Steps steps={message.steps} live={!!live} />
        {empty && live && !message.steps.length && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="inline-flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.2s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.1s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
            </span>
            {tr("O'ylayapman")}
          </p>
        )}
        {message.blocks.map((b, i) =>
          b.type === "replies" || b.type === "event" ? null : <BlockView key={("id" in b && b.id) || i} block={b} handlers={handlers} />,
        )}
        {message.error && (
          <p className="flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>{message.error}</span>
          </p>
        )}
        {isLast && !live && replyOptions.length > 0 && <RepliesView options={replyOptions} onPick={handlers.onReply} />}
        {!live && (
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span>{formatHotelMoment(message.created_at).slice(11)}</span>
            {tokens > 0 && <span>{tr("{{tokens}} token", { tokens: formatCompact(tokens) })}</span>}
            {message.text && (
              <button type="button" onClick={copy} className="inline-flex items-center gap-1 hover:text-foreground">
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? tr("Nusxa olindi") : tr("Nusxa")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
