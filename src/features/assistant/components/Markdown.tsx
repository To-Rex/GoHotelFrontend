import { Fragment, useMemo } from "react"
import { Link } from "react-router-dom"

import { cn } from "@/lib/utils"

import { parseMarkdown, type Inline, type MdBlock } from "../lib/markdown"

function InlineNodes({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.t) {
          case "text":
            return <Fragment key={i}>{n.v}</Fragment>
          case "br":
            return <br key={i} />
          case "b":
            return (
              <strong key={i} className="font-semibold text-foreground">
                <InlineNodes nodes={n.c} />
              </strong>
            )
          case "i":
            return (
              <em key={i}>
                <InlineNodes nodes={n.c} />
              </em>
            )
          case "code":
            return (
              <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
                {n.v}
              </code>
            )
          case "link":
            return n.href.startsWith("/") ? (
              <Link key={i} to={n.href} className="font-medium text-primary underline-offset-2 hover:underline">
                <InlineNodes nodes={n.c} />
              </Link>
            ) : (
              <a
                key={i}
                href={n.href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                <InlineNodes nodes={n.c} />
              </a>
            )
        }
      })}
    </>
  )
}

function BlockNode({ b }: { b: MdBlock }) {
  switch (b.t) {
    case "p":
      return (
        <p>
          <InlineNodes nodes={b.c} />
        </p>
      )
    case "h":
      return (
        <p className={cn("font-semibold text-foreground", b.level === 1 ? "text-base" : "text-[15px]")}>
          <InlineNodes nodes={b.c} />
        </p>
      )
    case "ul":
      return (
        <ul className="list-disc space-y-1 pl-5 marker:text-muted-foreground">
          {b.items.map((it, i) => (
            <li key={i}>
              <InlineNodes nodes={it} />
            </li>
          ))}
        </ul>
      )
    case "ol":
      return (
        <ol start={b.start} className="list-decimal space-y-1 pl-5 marker:text-muted-foreground">
          {b.items.map((it, i) => (
            <li key={i}>
              <InlineNodes nodes={it} />
            </li>
          ))}
        </ol>
      )
    case "quote":
      return (
        <blockquote className="border-l-2 border-primary/40 pl-3 text-muted-foreground">
          <InlineNodes nodes={b.c} />
        </blockquote>
      )
    case "pre":
      return (
        <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed">{b.v}</pre>
      )
    case "hr":
      return <hr className="border-border" />
    case "table":
      return (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/60">
              <tr>
                {b.head.map((c, i) => (
                  <th key={i} className="px-2.5 py-1.5 text-left font-semibold text-foreground">
                    <InlineNodes nodes={c} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {b.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j} className="px-2.5 py-1.5 tabular-nums">
                      <InlineNodes nodes={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
  }
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks = useMemo(() => parseMarkdown(text), [text])
  return (
    <div className={cn("space-y-2 text-sm leading-relaxed text-foreground/90 [overflow-wrap:anywhere]", className)}>
      {blocks.map((b, i) => (
        <BlockNode key={i} b={b} />
      ))}
    </div>
  )
}
