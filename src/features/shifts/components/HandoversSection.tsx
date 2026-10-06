import { useMemo, useState } from "react"
import { format } from "date-fns"
import { AlertTriangle, ArrowRight, ArrowRightLeft, Clock, LogOut, ShieldAlert } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  handoverMismatch,
  isForbiddenError,
  useShiftHandovers,
  type HandoverKind,
  type ShiftHandover,
} from "../api/shifts"
import { tr } from "@/i18n"

/* Smenadan smenaga o'tgan pullar.

   Kassali rejimda xodim smenani tugatganda kassadagi pulni sanab topshiradi
   va keyingi xodim uni o'z paroli bilan qabul qiladi — sanalgan summa
   qabul qiluvchining boshlang'ich kassasi bo'ladi. Bu bo'lim shu zanjirni
   ko'rsatadi: kimdan kimga, qancha (sanalgan), kutilgan va farq. Kunlik
   kesimda yoki majburiy yopishda kassadan chiqqan pul ham shu yerda.

   Sana — smena topshirilgan kun (sahifadagi sana filtri bilan bir xil).
   Faqat administrator va menejer ko'radi. */

const fmt = (n: number | null | undefined) => Number(n || 0).toLocaleString()
const stamp = (value?: string | null) => (value ? format(new Date(value), "dd.MM.yyyy HH:mm") : "—")

const KIND_STYLE: Record<HandoverKind, string> = {
  HANDOVER: "bg-primary-50 text-primary-700",
  PENDING: "bg-amber-100 text-amber-700",
  CASH_OUT: "bg-slate-100 text-slate-700",
  FORCE_TAKEN: "bg-orange-100 text-orange-700",
}

export const handoverKindLabel = (kind: HandoverKind): string => {
  if (kind === "HANDOVER") return tr("Keyingi smenaga o'tdi")
  if (kind === "PENDING") return tr("Qabul kutilmoqda")
  if (kind === "CASH_OUT") return tr("Kassadan olindi (kesim)")
  return tr("Majburiy yopildi — pulni rahbar oldi")
}

function Receiver({ h }: { h: ShiftHandover }) {
  if (h.kind === "HANDOVER") {
    return (
      <span>
        <span className="font-semibold text-gray-900">{h.to_user_name || "—"}</span>
        {h.accepted_at && (
          <span className="block text-[11px] text-gray-400">
            {tr("qabul: {{time}}", { time: stamp(h.accepted_at) })}
          </span>
        )}
      </span>
    )
  }
  if (h.kind === "PENDING") return <span className="font-medium text-amber-700">{tr("Qabul kutilmoqda")}</span>
  if (h.kind === "FORCE_TAKEN") {
    return (
      <span className="font-medium text-orange-700">
        {tr("Rahbar oldi")}
        {h.closed_by_name ? ` · ${h.closed_by_name}` : ""}
      </span>
    )
  }
  return <span className="font-medium text-slate-700">{tr("Kassadan olindi")}</span>
}

function DiffText({ diff }: { diff?: number | null }) {
  if (diff == null) return <span className="text-gray-400">—</span>
  if (Math.abs(diff) < 1) return <span className="text-gray-500">0</span>
  return (
    <span className={cn("font-semibold", diff < 0 ? "text-red-600" : "text-amber-600")}>
      {diff > 0 ? "+" : ""}
      {fmt(diff)}
    </span>
  )
}

export function HandoversSection({
  dateFrom,
  dateTo,
  userId,
}: {
  dateFrom?: string
  dateTo?: string
  /** Sahifada bitta xodim tanlangan bo'lsa — u topshirgan yoki qabul qilgani */
  userId?: string | null
}) {
  const { data, isLoading, isError, error } = useShiftHandovers(dateFrom, dateTo)
  const [visible, setVisible] = useState(20)

  const items = useMemo(() => {
    const all = data?.items ?? []
    if (!userId) return all
    return all.filter((h) => h.from_user_id === userId || h.to_user_id === userId)
  }, [data, userId])

  const summary = useMemo(() => {
    const s = { handed: 0, handedCount: 0, out: 0, outCount: 0, pending: 0, pendingCount: 0 }
    for (const h of items) {
      const v = Number(h.counted_cash || 0)
      if (h.kind === "HANDOVER") {
        s.handed += v
        s.handedCount += 1
      } else if (h.kind === "PENDING") {
        s.pending += v
        s.pendingCount += 1
      } else {
        s.out += v
        s.outCount += 1
      }
    }
    return s
  }, [items])

  // Ruxsat yo'q — bo'lim umuman ko'rinmaydi (xato emas)
  if (isError && isForbiddenError(error)) return null

  return (
    <div className="overflow-hidden rounded-2xl border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            <ArrowRightLeft className="h-4.5 w-4.5" />
          </span>
          <div>
            <h2 className="text-base font-bold tracking-tight text-gray-900">
              {tr("Smenadan smenaga o'tgan pullar")}
            </h2>
            <p className="text-xs text-gray-500">
              {tr("Har topshirilgan kassa: kimdan kimga, qancha sanab berildi, kutilgan summa va farq")}
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : isError || !data ? (
        <p className="p-4 text-sm text-red-600">{tr("Xatolik yuz berdi. Iltimos qayta urining.")}</p>
      ) : (
        <>
          {/* Jamlanma */}
          <div className="grid gap-2 border-b bg-gray-50/60 p-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-primary-100">
              <p className="text-[11px] font-medium text-primary-700">{tr("Keyingi smenaga o'tdi")}</p>
              <p className="text-sm font-bold tabular-nums text-gray-900">
                {tr("{{amount}} so'm", { amount: fmt(summary.handed) })}
              </p>
              <p className="text-[11px] text-gray-400">{tr("{{count}} marta", { count: summary.handedCount })}</p>
            </div>
            <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
              <p className="text-[11px] font-medium text-slate-600">{tr("Kassadan olindi")}</p>
              <p className="text-sm font-bold tabular-nums text-gray-900">
                {tr("{{amount}} so'm", { amount: fmt(summary.out) })}
              </p>
              <p className="text-[11px] text-gray-400">
                {tr("kesim va majburiy yopish · {{count}} marta", { count: summary.outCount })}
              </p>
            </div>
            <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-amber-100">
              <p className="text-[11px] font-medium text-amber-700">{tr("Qabul kutilmoqda")}</p>
              <p className="text-sm font-bold tabular-nums text-gray-900">
                {tr("{{amount}} so'm", { amount: fmt(summary.pending) })}
              </p>
              <p className="text-[11px] text-gray-400">{tr("{{count}} marta", { count: summary.pendingCount })}</p>
            </div>
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-400">
              {data.mode !== "cash" && (data.items ?? []).length === 0
                ? tr("Oddiy rejimda kassa smenadan smenaga topshirilmaydi")
                : tr("Tanlangan davrda smena topshirilmagan")}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {items.slice(0, visible).map((h) => {
                const mismatch = handoverMismatch(h)
                return (
                  <li key={h.id} className="grid gap-2 px-4 py-3 md:grid-cols-[150px_1fr_auto] md:items-center">
                    <div className="text-xs text-gray-500">
                      <span className="flex items-center gap-1 font-medium text-gray-700">
                        <Clock className="h-3 w-3" />
                        {stamp(h.ended_at)}
                      </span>
                      {h.branch_name && <span className="block text-[11px] text-gray-400">{h.branch_name}</span>}
                    </div>

                    <div className="min-w-0 text-sm">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-gray-900">{h.from_user_name || "—"}</span>
                        {h.kind === "HANDOVER" || h.kind === "PENDING" ? (
                          <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                        ) : (
                          <LogOut className="h-3.5 w-3.5 text-gray-400" />
                        )}
                        <Receiver h={h} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", KIND_STYLE[h.kind])}>
                          {handoverKindLabel(h.kind)}
                        </span>
                        {h.force_closed && h.kind !== "FORCE_TAKEN" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700">
                            <ShieldAlert className="h-3 w-3" />
                            {tr("Majburiy yopilgan")}
                          </span>
                        )}
                        {h.corrected && (
                          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                            {tr("Tuzatilgan")}
                          </span>
                        )}
                      </div>
                      {mismatch != null && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-700">
                          <AlertTriangle className="h-3 w-3" />
                          {tr("Qabul qiluvchining boshlang'ich kassasi: {{amount}} so'm", {
                            amount: fmt(h.received_opening_cash),
                          })}
                        </p>
                      )}
                    </div>

                    <div className="text-left md:text-right">
                      <p className="text-base font-bold tabular-nums text-gray-900">
                        {tr("{{amount}} so'm", { amount: fmt(h.counted_cash) })}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {tr("kutilgan {{expected}}", { expected: fmt(h.expected_cash) })} ·{" "}
                        {tr("farq")} <DiffText diff={h.cash_diff} />
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {items.length > visible && (
            <div className="border-t px-4 py-2.5 text-center">
              <button
                type="button"
                onClick={() => setVisible((v) => v + 20)}
                className="text-xs font-semibold text-primary-700 hover:underline"
              >
                {tr("Yana ko'rsatish ({{count}})", { count: items.length - visible })}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
