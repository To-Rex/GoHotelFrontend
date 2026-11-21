import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ChevronDown } from "lucide-react"

import { tr } from "@/i18n"
import { cn } from "@/lib/utils"

import type { TableBlock } from "../api/assistant"
import { formatCell, toNumber } from "../lib/format"

const PAGE = 15

/** Jadval: ustun bo'yicha saralash, "yana ko'rsatish"; raqamlar o'ngda. */
export function TableBlockView({ block }: { block: TableBlock }) {
  const [sort, setSort] = useState<{ key: string; desc: boolean } | null>(null)
  const [shown, setShown] = useState(PAGE)

  const rows = useMemo(() => {
    if (!sort) return block.rows
    const col = block.columns.find((c) => c.key === sort.key)
    const numeric = col && (col.kind === "money" || col.kind === "number")
    return [...block.rows].sort((a, b) => {
      const va = a[sort.key]
      const vb = b[sort.key]
      let cmp: number
      if (numeric) cmp = (toNumber(va) ?? -Infinity) - (toNumber(vb) ?? -Infinity)
      else cmp = String(va ?? "").localeCompare(String(vb ?? ""), undefined, { numeric: true })
      return sort.desc ? -cmp : cmp
    })
  }, [block.rows, block.columns, sort])

  const toggle = (key: string) =>
    setSort((s) => (s?.key === key ? (s.desc ? null : { key, desc: true }) : { key, desc: false }))

  const isNum = (kind: string) => kind === "money" || kind === "number"

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{block.title || tr("Jadval")}</p>
        <span className="flex-shrink-0 text-[11px] text-muted-foreground">
          {block.total > block.rows.length
            ? tr("{{shown}} / {{total}} qator", { shown: block.rows.length, total: block.total })
            : tr("{{count}} qator", { count: block.total })}
        </span>
      </div>
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-[1] bg-muted">
            <tr>
              {block.columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "whitespace-nowrap px-3 py-2 font-semibold text-foreground",
                    isNum(c.kind) ? "text-right" : "text-left",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggle(c.key)}
                    className={cn("inline-flex items-center gap-1 hover:text-primary", isNum(c.kind) && "flex-row-reverse")}
                  >
                    {c.label}
                    {sort?.key === c.key &&
                      (sort.desc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.slice(0, shown).map((r, i) => (
              <tr key={i} className="hover:bg-muted/50">
                {block.columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "max-w-[260px] truncate px-3 py-1.5 text-foreground/90",
                      isNum(c.kind) && "text-right tabular-nums",
                    )}
                    title={String(r[c.key] ?? "")}
                  >
                    {formatCell(r[c.key], c.kind)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE * 2)}
          className="flex w-full items-center justify-center gap-1 border-t border-border py-2 text-xs font-medium text-primary hover:bg-muted/50"
        >
          <ChevronDown className="h-3.5 w-3.5" />
          {tr("Yana ko'rsatish ({{n}})", { n: rows.length - shown })}
        </button>
      )}
    </div>
  )
}
