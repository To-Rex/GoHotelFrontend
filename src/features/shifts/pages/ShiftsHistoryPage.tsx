import { useMemo, useState } from "react"
import { format, subDays } from "date-fns"
import {
  History,
  Search,
  Wallet,
  AlertTriangle,
  ArrowRightLeft,
  Pencil,
  Loader2,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  ShieldAlert,
} from "lucide-react"
import {
  useShiftHistory,
  useShiftSettings,
  useCorrectShift,
  type ShiftSession,
} from "../api/shifts"
import { usePermissions } from "@/lib/permissions"
import { apiErrorMessage } from "@/lib/apiError"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const fmt = (n: number | null | undefined) => Number(n || 0).toLocaleString()

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Faol",
  PENDING_HANDOVER: "Topshirilmoqda",
  CLOSED: "Yopilgan",
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  PENDING_HANDOVER: "bg-amber-100 text-amber-700",
  CLOSED: "bg-slate-100 text-slate-600",
}

// Sessiya davomiyligi daqiqalarda (saralash va o'rtacha uchun)
const durationMins = (s: ShiftSession): number => {
  if (!s.started_at) return 0
  const from = new Date(s.started_at).getTime()
  const to = s.ended_at ? new Date(s.ended_at).getTime() : Date.now()
  return Math.max(0, Math.round((to - from) / 60000))
}

const durationLabel = (mins: number): string => {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h} s ${m} d` : `${m} d`
}

type SortKey =
  | "user"
  | "started_at"
  | "ended_at"
  | "duration"
  | "opening"
  | "expected"
  | "counted"
  | "diff"

type StatusFilter = "ALL" | "ACTIVE" | "PENDING_HANDOVER" | "CLOSED"

/* Smenalar tarixi — admin va menejer (shift.force_close) uchun: saralash,
   filtrlash, statistika, xodimlar kesimi va sanalgan summani tuzatish (audit
   bilan). Oddiy xodim ochsa backend faqat o'z sessiyalarini qaytaradi. */
export const ShiftsHistoryPage = () => {
  const { data: sessions = [], isLoading } = useShiftHistory(200)
  const { data: settings } = useShiftSettings()
  const { isAdmin, can } = usePermissions()
  const canEdit = isAdmin || can("shift.force_close")
  const correctMutation = useCorrectShift()

  // --- Filtrlar ---
  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("") // bo'sh — chegara yo'q
  const [dateTo, setDateTo] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [onlyDiff, setOnlyDiff] = useState(false)
  const [onlyForced, setOnlyForced] = useState(false)
  const [onlyCorrected, setOnlyCorrected] = useState(false)

  const todayStr = format(new Date(), "yyyy-MM-dd")
  const presets = [
    { key: "today", label: "Bugun", from: todayStr, to: todayStr },
    {
      key: "week",
      label: "7 kun",
      from: format(subDays(new Date(), 6), "yyyy-MM-dd"),
      to: todayStr,
    },
    {
      key: "month",
      label: "30 kun",
      from: format(subDays(new Date(), 29), "yyyy-MM-dd"),
      to: todayStr,
    },
    { key: "all", label: "Hammasi", from: "", to: "" },
  ]

  // --- Saralash ---
  const [sortKey, setSortKey] = useState<SortKey>("started_at")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir(key === "user" ? "asc" : "desc")
    }
  }

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (search.trim()) {
        const q = search.toLowerCase()
        const hit =
          (s.user_name || "").toLowerCase().includes(q) ||
          (s.accepted_by_name || "").toLowerCase().includes(q) ||
          (s.closed_by_name || "").toLowerCase().includes(q)
        if (!hit) return false
      }
      if (s.started_at) {
        const day = format(new Date(s.started_at), "yyyy-MM-dd")
        if (dateFrom && day < dateFrom) return false
        if (dateTo && day > dateTo) return false
      }
      if (statusFilter !== "ALL" && s.status !== statusFilter) return false
      if (onlyDiff && !(s.status === "CLOSED" && Number(s.cash_diff || 0) !== 0))
        return false
      if (onlyForced && !s.force_closed) return false
      if (onlyCorrected && !(s.corrections && s.corrections.length > 0)) return false
      return true
    })
  }, [sessions, search, dateFrom, dateTo, statusFilter, onlyDiff, onlyForced, onlyCorrected])

  const sorted = useMemo(() => {
    const val = (s: ShiftSession): number | string => {
      switch (sortKey) {
        case "user":
          return (s.user_name || "").toLowerCase()
        case "started_at":
          return s.started_at ? new Date(s.started_at).getTime() : 0
        case "ended_at":
          return s.ended_at ? new Date(s.ended_at).getTime() : 0
        case "duration":
          return durationMins(s)
        case "opening":
          return Number(s.opening_cash || 0)
        case "expected":
          return Number(s.expected_cash ?? -Infinity)
        case "counted":
          return Number(s.counted_cash ?? -Infinity)
        case "diff":
          return s.status === "CLOSED" ? Number(s.cash_diff || 0) : -Infinity
      }
    }
    const dir = sortDir === "asc" ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = val(a)
      const bv = val(b)
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
  }, [filtered, sortKey, sortDir])

  // --- Statistika (filtrlangan to'plam bo'yicha) ---
  const closedF = filtered.filter((s) => s.status === "CLOSED")
  const activeF = filtered.filter((s) => s.status === "ACTIVE").length
  const pendingF = filtered.filter((s) => s.status === "PENDING_HANDOVER").length
  const totalCounted = closedF.reduce((sum, s) => sum + Number(s.counted_cash || 0), 0)
  const shortageList = closedF.filter((s) => Number(s.cash_diff || 0) < 0)
  const surplusList = closedF.filter((s) => Number(s.cash_diff || 0) > 0)
  const shortageTotal = shortageList.reduce((sum, s) => sum + Number(s.cash_diff || 0), 0)
  const surplusTotal = surplusList.reduce((sum, s) => sum + Number(s.cash_diff || 0), 0)
  const forcedCount = filtered.filter((s) => s.force_closed).length
  const correctedCount = filtered.filter(
    (s) => s.corrections && s.corrections.length > 0
  ).length
  const avgDuration =
    closedF.length > 0
      ? Math.round(closedF.reduce((sum, s) => sum + durationMins(s), 0) / closedF.length)
      : 0

  // Xodimlar kesimi: har xodim bo'yicha jami sessiya, sanalgan, kamomad/ortiqcha
  const byEmployee = useMemo(() => {
    const map = new Map<
      string,
      { name: string; count: number; counted: number; shortage: number; surplus: number }
    >()
    for (const s of filtered) {
      const key = s.user_id
      const row = map.get(key) || {
        name: s.user_name || "—",
        count: 0,
        counted: 0,
        shortage: 0,
        surplus: 0,
      }
      row.count += 1
      if (s.status === "CLOSED") {
        row.counted += Number(s.counted_cash || 0)
        const d = Number(s.cash_diff || 0)
        if (d < 0) row.shortage += d
        if (d > 0) row.surplus += d
      }
      map.set(key, row)
    }
    // Eng katta kamomad birinchi ko'rinadi
    return [...map.values()].sort((a, b) => a.shortage - b.shortage)
  }, [filtered])

  // --- Tuzatish dialogi ---
  const [editTarget, setEditTarget] = useState<ShiftSession | null>(null)
  const [newCounted, setNewCounted] = useState("")
  const [editNote, setEditNote] = useState("")
  const [editError, setEditError] = useState<string | null>(null)

  const openEdit = (s: ShiftSession) => {
    setEditTarget(s)
    setNewCounted(String(s.counted_cash ?? ""))
    setEditNote("")
    setEditError(null)
  }

  const submitEdit = async () => {
    if (!editTarget) return
    const n = Number(newCounted.replace(/\s/g, ""))
    if (Number.isNaN(n) || n < 0) {
      setEditError("Yangi summani to'g'ri kiriting")
      return
    }
    if (editNote.trim().length < 3) {
      setEditError("Tuzatish sababini yozing (izoh majburiy)")
      return
    }
    setEditError(null)
    try {
      await correctMutation.mutateAsync({
        session_id: editTarget.id,
        counted_cash: n,
        note: editNote.trim(),
      })
      setEditTarget(null)
    } catch (e) {
      setEditError(apiErrorMessage(e))
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Smenalar tarixi</h1>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  const correctionTitle = (s: ShiftSession) =>
    (s.corrections || [])
      .map(
        (c) =>
          `${c.corrected_by_name || "?"} (${format(
            new Date(c.corrected_at),
            "dd.MM HH:mm"
          )}): ${fmt(c.old_counted_cash)} → ${fmt(c.new_counted_cash)} — ${c.note}`
      )
      .join("\n")

  const SortHead = ({
    label,
    k,
    right,
  }: {
    label: string
    k: SortKey
    right?: boolean
  }) => (
    <TableHead className={cn(right && "text-right")}>
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-gray-900",
          sortKey === k ? "font-semibold text-primary-700" : ""
        )}
      >
        {label}
        {sortKey === k ? (
          sortDir === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </TableHead>
  )

  const stats = [
    {
      icon: History,
      accent: "bg-primary-50 text-primary-600",
      label: "Sessiyalar",
      value: `${filtered.length} ta`,
      sub: `${activeF} faol · ${pendingF} topshirilmoqda`,
    },
    {
      icon: Wallet,
      accent: "bg-emerald-50 text-emerald-600",
      label: "Jami sanalgan (yopilgan)",
      value: `${fmt(totalCounted)} so'm`,
      sub: `${closedF.length} ta yopilgan sessiya`,
    },
    {
      icon: TrendingDown,
      accent: shortageList.length ? "bg-red-50 text-red-500" : "bg-gray-50 text-gray-400",
      label: "Kamomad",
      value: `${fmt(shortageTotal)} so'm`,
      sub: `${shortageList.length} ta sessiyada`,
    },
    {
      icon: TrendingUp,
      accent: surplusList.length
        ? "bg-amber-50 text-amber-600"
        : "bg-gray-50 text-gray-400",
      label: "Ortiqcha",
      value: `+${fmt(surplusTotal)} so'm`,
      sub: `${surplusList.length} ta sessiyada`,
    },
    {
      icon: ShieldAlert,
      accent: forcedCount ? "bg-orange-50 text-orange-600" : "bg-gray-50 text-gray-400",
      label: "Majburiy yopilgan",
      value: `${forcedCount} ta`,
      sub: `tahrirlangan: ${correctedCount} ta`,
    },
    {
      icon: Clock,
      accent: "bg-sky-50 text-sky-600",
      label: "O'rtacha davomiylik",
      value: closedF.length ? durationLabel(avgDuration) : "—",
      sub: "yopilgan sessiyalar bo'yicha",
    },
  ]

  return (
    <div className="space-y-5">
      {/* Sarlavha */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 shadow-lg shadow-primary-500/25">
            <History className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              Smenalar tarixi
            </h1>
            <p className="text-sm text-gray-500">
              Jami {sessions.length} ta sessiya
              {filtered.length !== sessions.length && (
                <span className="font-medium text-primary-700">
                  {" "}
                  · natija: {filtered.length} ta
                </span>
              )}
              {settings && (
                <span className="text-gray-400">
                  {" "}
                  · rejim: {settings.mode === "cash" ? "kassali" : "oddiy"} · kesim:{" "}
                  {settings.day_close}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Statistika kartalari (filtrga mos yangilanadi) */}
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(190px,1fr))]">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border bg-white p-3.5">
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg",
                  s.accent
                )}
              >
                <s.icon className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium text-gray-400">
                  {s.label}
                </p>
                <p className="truncate text-sm font-bold text-gray-900">{s.value}</p>
                <p className="truncate text-[11px] text-gray-500">{s.sub}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filtrlar paneli */}
      <div className="space-y-3 rounded-2xl border bg-white p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Sana presetlari */}
          {presets.map((p) => {
            const active = dateFrom === p.from && dateTo === p.to
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  setDateFrom(p.from)
                  setDateTo(p.to)
                }}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-primary-600 bg-primary-600 text-white"
                    : "border-gray-200 text-gray-600 hover:border-primary-200 hover:bg-primary-50"
                )}
              >
                {p.label}
              </button>
            )
          })}
          <Input
            type="date"
            className="h-8 w-36 text-xs"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <span className="text-xs text-gray-400">—</span>
          <Input
            type="date"
            className="h-8 w-36 text-xs"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Holat filtrlari */}
          {(
            [
              ["ALL", "Barcha holat"],
              ["ACTIVE", "Faol"],
              ["PENDING_HANDOVER", "Topshirilmoqda"],
              ["CLOSED", "Yopilgan"],
            ] as [StatusFilter, string][]
          ).map(([v, l]) => (
            <button
              key={v}
              type="button"
              onClick={() => setStatusFilter(v)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === v
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {l}
            </button>
          ))}

          <span className="mx-1 h-4 w-px bg-gray-200" />

          {/* Maxsus filtrlar */}
          <button
            type="button"
            onClick={() => setOnlyDiff((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              onlyDiff
                ? "bg-red-600 text-white"
                : "bg-red-50 text-red-600 hover:bg-red-100"
            )}
          >
            <AlertTriangle className="h-3 w-3" />
            Farqli
          </button>
          <button
            type="button"
            onClick={() => setOnlyForced((v) => !v)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              onlyForced
                ? "bg-orange-600 text-white"
                : "bg-orange-50 text-orange-600 hover:bg-orange-100"
            )}
          >
            Majburiy
          </button>
          <button
            type="button"
            onClick={() => setOnlyCorrected((v) => !v)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              onlyCorrected
                ? "bg-amber-500 text-white"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100"
            )}
          >
            Tahrirlangan
          </button>

          {/* Qidiruv */}
          <div className="relative ml-auto min-w-[180px] max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              className="h-8 pl-9 text-xs"
              placeholder="Xodim bo'yicha qidirish..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Xodimlar kesimi */}
      {byEmployee.length > 1 && (
        <div className="rounded-2xl border bg-white overflow-hidden">
          <p className="flex items-center gap-2 border-b bg-gray-50/70 px-4 py-2.5 text-xs font-semibold text-gray-600">
            <Users className="h-3.5 w-3.5" />
            Xodimlar kesimi (filtrga mos)
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Xodim</TableHead>
                  <TableHead className="text-right">Sessiyalar</TableHead>
                  <TableHead className="text-right">Jami sanalgan</TableHead>
                  <TableHead className="text-right">Kamomad</TableHead>
                  <TableHead className="text-right">Ortiqcha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byEmployee.map((e) => (
                  <TableRow key={e.name}>
                    <TableCell className="font-medium text-gray-900">{e.name}</TableCell>
                    <TableCell className="text-right tabular-nums text-gray-600">
                      {e.count} ta
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-gray-600">
                      {fmt(e.counted)} so'm
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold tabular-nums",
                        e.shortage < 0 ? "text-red-600" : "text-gray-400"
                      )}
                    >
                      {e.shortage < 0 ? `${fmt(e.shortage)} so'm` : "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold tabular-nums",
                        e.surplus > 0 ? "text-amber-600" : "text-gray-400"
                      )}
                    >
                      {e.surplus > 0 ? `+${fmt(e.surplus)} so'm` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Sessiyalar jadvali (saralanadigan ustunlar) */}
      <div className="rounded-2xl border bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead label="Xodim" k="user" />
                <SortHead label="Boshlangan" k="started_at" />
                <SortHead label="Tugagan" k="ended_at" />
                <SortHead label="Davomiylik" k="duration" />
                <SortHead label="Boshlang'ich" k="opening" right />
                <SortHead label="Kutilgan" k="expected" right />
                <SortHead label="Sanalgan" k="counted" right />
                <SortHead label="Farq" k="diff" right />
                <TableHead>Holat</TableHead>
                <TableHead>Topshirilgan</TableHead>
                {canEdit && <TableHead className="text-right">Amallar</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canEdit ? 11 : 10}
                    className="py-8 text-center text-gray-400"
                  >
                    Sessiyalar topilmadi
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((s) => {
                  const diff = Number(s.cash_diff || 0)
                  return (
                    <TableRow
                      key={s.id}
                      className={cn(
                        s.status === "CLOSED" && diff !== 0 && "bg-red-50/40"
                      )}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-[11px] font-bold text-primary-700">
                            {(s.user_name || "?")
                              .split(" ")
                              .map((w) => w[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                          <span className="font-medium text-gray-900">
                            {s.user_name || "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-gray-600">
                        {s.started_at
                          ? format(new Date(s.started_at), "dd.MM HH:mm")
                          : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-gray-600">
                        {s.ended_at
                          ? format(new Date(s.ended_at), "dd.MM HH:mm")
                          : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-gray-500">
                        {durationLabel(durationMins(s))}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums text-gray-600">
                        {fmt(s.opening_cash)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums text-gray-600">
                        {s.expected_cash !== null && s.expected_cash !== undefined
                          ? fmt(s.expected_cash)
                          : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums text-gray-600">
                        {s.counted_cash !== null && s.counted_cash !== undefined ? (
                          s.corrections && s.corrections.length > 0 ? (
                            /* Tahrirlangan: asl qiymat o'chirilgan chiziq bilan */
                            <span title={correctionTitle(s)}>
                              <span className="mr-1.5 text-gray-400 line-through">
                                {fmt(s.corrections[0].old_counted_cash)}
                              </span>
                              <span className="font-semibold text-gray-800">
                                {fmt(s.counted_cash)}
                              </span>
                            </span>
                          ) : (
                            fmt(s.counted_cash)
                          )
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "whitespace-nowrap text-right font-semibold tabular-nums",
                          s.status !== "CLOSED"
                            ? "text-gray-400"
                            : diff === 0
                              ? "text-emerald-600"
                              : "text-red-600"
                        )}
                      >
                        {s.status === "CLOSED" ? fmt(diff) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[11px] font-medium",
                              STATUS_STYLES[s.status] || STATUS_STYLES.CLOSED
                            )}
                          >
                            {STATUS_LABELS[s.status] || s.status}
                          </span>
                          {s.force_closed && (
                            <span
                              className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-600"
                              title={s.notes || undefined}
                            >
                              majburiy
                            </span>
                          )}
                          {s.continue_after_end && (
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                              davom etgan
                            </span>
                          )}
                          {s.corrections && s.corrections.length > 0 && (
                            <span
                              className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700"
                              title={correctionTitle(s)}
                            >
                              tahrirlangan
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-gray-600">
                        {s.accepted_by_name ? (
                          <span className="inline-flex items-center gap-1">
                            <ArrowRightLeft className="h-3 w-3 text-gray-400" />
                            {s.accepted_by_name}
                          </span>
                        ) : s.force_closed && s.closed_by_name ? (
                          <span className="text-gray-400">
                            {s.closed_by_name} yopdi
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          {s.status === "CLOSED" && (
                            <button
                              type="button"
                              title="Sanalgan summani tuzatish"
                              onClick={() => openEdit(s)}
                              className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Sanalgan summani tuzatish dialogi (admin/menejer, izoh majburiy) */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-amber-600" />
              Sanalgan summani tuzatish
            </DialogTitle>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-gray-600">
                <b>{editTarget.user_name}</b> sessiyasi (
                {editTarget.started_at &&
                  format(new Date(editTarget.started_at), "dd.MM HH:mm")}
                ). Eski qiymat o'chirilmaydi — tuzatish tarixi bilan birga
                saqlanadi va jadvalda "tahrirlangan" belgisi ko'rinadi.
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-gray-50 px-2.5 py-1 font-medium text-gray-600 ring-1 ring-gray-200">
                  Kutilgan:{" "}
                  <b className="tabular-nums">{fmt(editTarget.expected_cash)}</b> so'm
                </span>
                <span className="rounded-full bg-gray-50 px-2.5 py-1 font-medium text-gray-600 ring-1 ring-gray-200">
                  Hozirgi sanalgan:{" "}
                  <b className="tabular-nums">{fmt(editTarget.counted_cash)}</b> so'm
                </span>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">
                  Yangi sanalgan summa (so'm) *
                </label>
                <Input
                  type="number"
                  min={0}
                  value={newCounted}
                  onChange={(e) => setNewCounted(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">
                  Tuzatish sababi (izoh) *
                </label>
                <Input
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Masalan: xodim bitta nol ortiqcha yozgan"
                />
              </div>
              {editError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  {editError}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Bekor qilish
            </Button>
            <Button onClick={submitEdit} disabled={correctMutation.isPending}>
              {correctMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Tuzatishni saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
