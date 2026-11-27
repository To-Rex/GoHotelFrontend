import { useEffect, useState } from "react"
import { BookUser, ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { tr } from "@/i18n"
import { cn } from "@/lib/utils"

import { JOURNAL_PAGE, useEmehmonJournal, type EmehmonRegistration } from "../api/emehmon"
import { formatMoment, stateLabel, stateTone, type EmehmonState } from "../lib/emehmon"
import { useEmehmonUi } from "../lib/store"

/* E-mehmon ro'yxatlari jurnali — kim, qachon ro'yxatga olingan va
   chiqarilgan. Satr bosilsa o'sha bronning varag'i ochiladi. */

type Filter = "" | Exclude<EmehmonState, "none" | "sending">

const FILTERS: Filter[] = ["", "registered", "checked_out", "failed", "skipped"]

export function EmehmonJournalDialog() {
  const open = useEmehmonUi((s) => s.journalOpen)
  const setOpen = useEmehmonUi((s) => s.setJournalOpen)
  const openReservation = useEmehmonUi((s) => s.openReservation)
  const [status, setStatus] = useState<Filter>("")
  const [typed, setTyped] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const { data, isFetching } = useEmehmonJournal(status, search, page, open)

  // Yozish to'xtagach qidiriladi
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(typed.trim())
      setPage(0)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [typed])

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / JOURNAL_PAGE))

  const pick = (row: EmehmonRegistration) => {
    if (!row.reservation_id) return
    setOpen(false)
    openReservation(row.reservation_id, row.guest_id)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[860px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <BookUser className="h-5 w-5 text-primary" />
            {tr("E-mehmon ro'yxatlari jurnali")}
          </DialogTitle>
          <DialogDescription>{tr("Shu filialdan E-mehmon'ga yuborilgan ro'yxatlar")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((value) => (
              <button
                key={value || "all"}
                type="button"
                onClick={() => {
                  setStatus(value)
                  setPage(0)
                }}
                className={cn(
                  "h-8 rounded-lg px-2.5 text-xs font-medium",
                  status === value ? "bg-primary text-primary-foreground" : "border border-border text-foreground hover:bg-muted"
                )}
              >
                {value ? tr(stateLabel(value)) : tr("Hammasi")}
              </button>
            ))}
          </div>
          <label className="relative ml-auto w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-xs text-foreground outline-none focus:border-primary"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={tr("Ism, pasport yoki ro'yxat raqami")}
            />
          </label>
        </div>

        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">
            {isFetching ? tr("Yuklanmoqda...") : tr("Ro'yxat topilmadi")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[680px] text-xs">
              <thead className="bg-muted/60 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{tr("Mehmon")}</th>
                  <th className="px-3 py-2 font-medium">{tr("Pasport")}</th>
                  <th className="px-3 py-2 font-medium">{tr("Ro'yxat №")}</th>
                  <th className="px-3 py-2 font-medium">{tr("Bron")}</th>
                  <th className="px-3 py-2 font-medium">{tr("Vaqt")}</th>
                  <th className="px-3 py-2 font-medium">{tr("Holat")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => pick(row)}
                    className={cn("border-t border-border", row.reservation_id && "cursor-pointer hover:bg-muted/50")}
                  >
                    <td className="px-3 py-2 font-medium text-foreground">{row.full_name || "—"}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{row.passport_number || "—"}</td>
                    <td className="px-3 py-2 font-mono text-foreground">{row.reg_num || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.reservation_number || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatMoment(row.checked_out_at || row.registered_at || row.created_at)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", stateTone(row.status))}>
                        {tr(stateLabel(row.status))}
                      </span>
                      {(row.error || row.checkout_error) && (
                        <span className="mt-1 block max-w-[16rem] truncate text-[11px] text-red-600" title={row.error || row.checkout_error || ""}>
                          {row.error || row.checkout_error}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {tr("Jami: {{n}} ta", { n: total })}
          </span>
          {pages > 1 && (
            <span className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                title={tr("Oldingi")}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border hover:bg-muted disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-1">
                {page + 1} / {pages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
                disabled={page >= pages - 1}
                title={tr("Keyingi")}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border hover:bg-muted disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
