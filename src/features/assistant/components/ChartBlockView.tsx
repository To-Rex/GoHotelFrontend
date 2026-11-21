import { useState } from "react"
import { BarChart3, Table2 } from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { tr } from "@/i18n"
import { cn } from "@/lib/utils"

import type { ChartBlock } from "../api/assistant"
import { formatAxisLabel, formatCompact, formatNumber, valueLabel } from "../lib/format"

/* Grafik — vizualizatsiya qoidalari bo'yicha:
   - turkum ranglari belgilangan tartibda (--ai-s1..8), bitta qator — 1-rang;
   - ustun ≤24px, yuqori burchak 4px, qatorlar orasida 2px oraliq;
   - chiziq 2px, nuqta ≥8px (sirt rangidagi 2px halqa bilan);
   - to'r faqat gorizontal va xira; o'qlar va qiymatlar oddiy matn rangida;
   - har belgida hover maslahati; ≥2 qator — legend; jadval ko'rinishi. */

const SERIES = ["--ai-s1", "--ai-s2", "--ai-s3", "--ai-s4", "--ai-s5", "--ai-s6", "--ai-s7", "--ai-s8"]
const seriesColor = (i: number) => `var(${SERIES[i % SERIES.length]})`

const AXIS_TICK = { fill: "hsl(var(--muted-foreground))", fontSize: 11 }

function ChartTooltip({
  active,
  payload,
  label,
  unit,
  names,
}: {
  active?: boolean
  payload?: Array<{ dataKey?: string | number; value?: number; color?: string; payload?: Record<string, unknown> }>
  label?: string
  unit: string | null
  names: Record<string, string>
}) {
  if (!active || !payload?.length) return null
  const title = label ?? String(payload[0]?.payload?.x ?? "")
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-foreground">{valueLabel(title)}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span>{names[String(p.dataKey)] ?? String(p.dataKey)}</span>
          <span className="ml-auto pl-3 font-semibold tabular-nums text-foreground">
            {formatNumber(p.value)}
            {unit ? ` ${unit}` : ""}
          </span>
        </div>
      ))}
    </div>
  )
}

function Legend({ items }: { items: { label: string; color: string; value?: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: it.color }} />
          <span className="text-foreground/80">{it.label}</span>
          {it.value && <span className="tabular-nums">{it.value}</span>}
        </span>
      ))}
    </div>
  )
}

function DataTable({ block }: { block: ChartBlock }) {
  return (
    <div className="max-h-64 overflow-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-muted">
          <tr>
            <th className="px-2.5 py-1.5 text-left font-semibold text-foreground">{block.x.label}</th>
            {block.series.map((s) => (
              <th key={s.key} className="px-2.5 py-1.5 text-right font-semibold text-foreground">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {block.data.map((row, i) => (
            <tr key={i}>
              <td className="px-2.5 py-1.5 text-foreground/80">{valueLabel(row.x)}</td>
              {block.series.map((s) => (
                <td key={s.key} className="px-2.5 py-1.5 text-right tabular-nums text-foreground">
                  {formatNumber(row[s.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ChartBlockView({ block }: { block: ChartBlock }) {
  const [asTable, setAsTable] = useState(false)
  const names = Object.fromEntries(block.series.map((s) => [s.key, s.label]))
  const multi = block.series.length > 1
  const pie = block.chart === "pie"
  const pieKey = block.series[0]?.key
  const pieTotal = pie ? block.data.reduce((sum, r) => sum + (Number(r[pieKey]) || 0), 0) : 0
  const many = block.data.length > 12
  const tooltip = (
    <Tooltip
      cursor={block.chart === "bar" ? { fill: "hsl(var(--muted))", opacity: 0.6 } : { stroke: "hsl(var(--border))" }}
      content={<ChartTooltip unit={block.unit} names={names} />}
    />
  )
  const axes = (
    <>
      <CartesianGrid vertical={false} stroke="var(--ai-grid)" strokeDasharray="0" />
      <XAxis
        dataKey="x"
        tick={AXIS_TICK}
        tickLine={false}
        axisLine={{ stroke: "var(--ai-grid)" }}
        tickFormatter={formatAxisLabel}
        interval="preserveStartEnd"
        minTickGap={12}
      />
      <YAxis
        tick={AXIS_TICK}
        tickLine={false}
        axisLine={false}
        width={44}
        tickFormatter={(v: number) => formatCompact(v)}
      />
    </>
  )

  return (
    <figure className="ai-viz rounded-xl border border-border bg-card p-3 sm:p-4">
      <figcaption className="mb-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{block.title || tr("Grafik")}</p>
          {block.unit && <p className="text-[11px] text-muted-foreground">{tr("Birlik: {{unit}}", { unit: block.unit })}</p>}
        </div>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          className="inline-flex flex-shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title={asTable ? tr("Grafik") : tr("Jadval ko'rinishi")}
        >
          {asTable ? <BarChart3 className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
          {asTable ? tr("Grafik") : tr("Jadval")}
        </button>
      </figcaption>

      {asTable ? (
        <DataTable block={block} />
      ) : pie ? (
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <div className="h-48 w-full max-w-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={block.data}
                  dataKey={pieKey}
                  nameKey="x"
                  innerRadius="58%"
                  outerRadius="92%"
                  stroke="var(--ai-surface)"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {block.data.map((_, i) => (
                    <Cell key={i} fill={seriesColor(i)} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip unit={block.unit} names={{ [pieKey]: block.series[0]?.label }} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="w-full min-w-0 flex-1 space-y-1.5">
            {block.data.map((r, i) => {
              const v = Number(r[pieKey]) || 0
              const pct = pieTotal ? Math.round((v / pieTotal) * 1000) / 10 : 0
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ background: seriesColor(i) }} />
                  <span className="min-w-0 flex-1 truncate text-foreground/80">{valueLabel(r.x)}</span>
                  <span className="tabular-nums font-semibold text-foreground">{formatNumber(v)}</span>
                  <span className="w-12 text-right tabular-nums text-muted-foreground">{String(pct).replace(".", ",")}%</span>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <>
          {multi && (
            <div className="mb-2">
              <Legend items={block.series.map((s, i) => ({ label: s.label, color: seriesColor(i) }))} />
            </div>
          )}
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {block.chart === "line" ? (
                <LineChart data={block.data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  {axes}
                  {tooltip}
                  {block.series.map((s, i) => (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      stroke={seriesColor(i)}
                      strokeWidth={2}
                      dot={many ? false : { r: 4, fill: seriesColor(i), stroke: "var(--ai-surface)", strokeWidth: 2 }}
                      activeDot={{ r: 5, fill: seriesColor(i), stroke: "var(--ai-surface)", strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              ) : block.chart === "area" ? (
                <AreaChart data={block.data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  {axes}
                  {tooltip}
                  {block.series.map((s, i) => (
                    <Area
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      stroke={seriesColor(i)}
                      strokeWidth={2}
                      fill={seriesColor(i)}
                      fillOpacity={0.14}
                      activeDot={{ r: 5, fill: seriesColor(i), stroke: "var(--ai-surface)", strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                  ))}
                </AreaChart>
              ) : (
                <BarChart data={block.data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
                  {axes}
                  {tooltip}
                  {block.series.map((s, i) => (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      fill={seriesColor(i)}
                      maxBarSize={24}
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </>
      )}
      {block.truncated && (
        <p className={cn("mt-2 text-[11px] text-muted-foreground")}>
          {tr("Grafikda {{n}} ta nuqta ko'rsatildi — to'liq ma'lumot uchun jadval yoki Excel so'rang", {
            n: block.data.length,
          })}
        </p>
      )}
    </figure>
  )
}
