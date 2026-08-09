import { useMemo, useState } from "react"
import { format } from "date-fns"
import {
  History,
  Search,
  Wallet,
  AlertTriangle,
  ArrowRightLeft,
  Pencil,
  Loader2,
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

// Sessiya davomiyligi: "7 s 30 d"
const duration = (s: ShiftSession): string => {
  if (!s.started_at) return "—"
  const from = new Date(s.started_at).getTime()
  const to = s.ended_at ? new Date(s.ended_at).getTime() : Date.now()
  const mins = Math.max(0, Math.round((to - from) / 60000))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h} s ${m} d` : `${m} d`
}

/* Smenalar tarixi — admin va menejer (shift.force_close) uchun.
   Oddiy xodim ochsa backend faqat o'z sessiyalarini qaytaradi. */
export const ShiftsHistoryPage = () => {
  const { data: sessions = [], isLoading } = useShiftHistory(200)
  const { data: settings } = useShiftSettings()
  const { isAdmin, can } = usePermissions()
  const canEdit = isAdmin || can("shift.force_close")
  const correctMutation = useCorrectShift()
  const [search, setSearch] = useState("")

  // Tuzatish dialogi
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

  const filtered = useMemo(() => {
    if (!search.trim()) return sessions
    const q = search.toLowerCase()
    return sessions.filter(
      (s) =>
        (s.user_name || "").toLowerCase().includes(q) ||
        (s.accepted_by_name || "").toLowerCase().includes(q) ||
        (s.closed_by_name || "").toLowerCase().includes(q)
    )
  }, [sessions, search])

  const closed = sessions.filter((s) => s.status === "CLOSED")
  const withDiff = closed.filter((s) => Number(s.cash_diff || 0) !== 0)
  const totalDiff = withDiff.reduce((sum, s) => sum + Number(s.cash_diff || 0), 0)
  const forced = closed.filter((s) => s.force_closed).length

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Smenalar tarixi</h1>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

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
              {settings && (
                <span className="text-gray-400">
                  {" "}
                  · rejim:{" "}
                  {settings.mode === "cash" ? "kassali" : "oddiy"} · kesim:{" "}
                  {settings.day_close}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Statistika chiplari */}
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700">
          <Wallet className="h-3.5 w-3.5" />
          {closed.length} ta yopilgan
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
            withDiff.length
              ? "bg-red-100 text-red-600"
              : "bg-gray-100 text-gray-500"
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          {withDiff.length} ta farqli
          {withDiff.length > 0 && ` (jami: ${fmt(totalDiff)} so'm)`}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
            forced ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
          )}
        >
          {forced} ta majburiy yopilgan
        </span>
      </div>

      {/* Qidiruv */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          className="pl-9"
          placeholder="Xodim bo'yicha qidirish..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Jadval */}
      <div className="rounded-2xl border bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Xodim</TableHead>
                <TableHead>Boshlangan</TableHead>
                <TableHead>Tugagan</TableHead>
                <TableHead>Davomiylik</TableHead>
                <TableHead className="text-right">Boshlang'ich</TableHead>
                <TableHead className="text-right">Kutilgan</TableHead>
                <TableHead className="text-right">Sanalgan</TableHead>
                <TableHead className="text-right">Farq</TableHead>
                <TableHead>Holat</TableHead>
                <TableHead>Topshirilgan</TableHead>
                {canEdit && <TableHead className="text-right">Amallar</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canEdit ? 11 : 10}
                    className="py-8 text-center text-gray-400"
                  >
                    Sessiyalar topilmadi
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((s) => {
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
                        {duration(s)}
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
                            <span
                              title={s.corrections
                                .map(
                                  (c) =>
                                    `${c.corrected_by_name || "?"} (${format(
                                      new Date(c.corrected_at),
                                      "dd.MM HH:mm"
                                    )}): ${fmt(c.old_counted_cash)} → ${fmt(
                                      c.new_counted_cash
                                    )} — ${c.note}`
                                )
                                .join("\n")}
                            >
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
                              title={s.corrections
                                .map(
                                  (c) =>
                                    `${c.corrected_by_name || "?"} (${format(
                                      new Date(c.corrected_at),
                                      "dd.MM HH:mm"
                                    )}): ${fmt(c.old_counted_cash)} → ${fmt(
                                      c.new_counted_cash
                                    )} — ${c.note}`
                                )
                                .join("\n")}
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
