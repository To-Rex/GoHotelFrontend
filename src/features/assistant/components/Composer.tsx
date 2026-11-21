import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { ArrowUp, Square } from "lucide-react"

import { tr } from "@/i18n"
import { cn } from "@/lib/utils"

/** Xabar maydoni: Enter — yuborish, Shift+Enter — yangi qator; javob
 *  kelayotganda "To'xtatish". Balandlik matnga qarab o'sadi. */
export function Composer({
  onSend,
  onStop,
  busy,
  disabled,
  placeholder,
  autoFocus,
}: {
  onSend: (text: string) => void
  onStop: () => void
  busy: boolean
  disabled?: boolean
  placeholder?: string
  autoFocus?: boolean
}) {
  const [text, setText] = useState("")
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`
  }, [text])

  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])

  const send = () => {
    const t = text.trim()
    if (!t || busy || disabled) return
    onSend(t)
    setText("")
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div
      className={cn(
        "flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15",
        disabled && "opacity-60",
      )}
    >
      <textarea
        ref={ref}
        rows={1}
        value={text}
        maxLength={8000}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        placeholder={placeholder ?? tr("Savol bering yoki ish buyuring…")}
        className="max-h-[180px] min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
      {busy ? (
        <button
          type="button"
          onClick={onStop}
          title={tr("To'xtatish")}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-foreground text-background transition-opacity hover:opacity-85"
        >
          <Square className="h-3.5 w-3.5 fill-current" />
        </button>
      ) : (
        <button
          type="button"
          onClick={send}
          disabled={!text.trim() || disabled}
          title={tr("Yuborish")}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
