import { format } from "date-fns"

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
import {
  PENALTY_KINDS,
  penaltyKindLabel,
  useFinancePenalties,
} from "@/features/reservations/api/penalties"
import { tr } from "@/i18n"

/**
 * Jarimalar: davrda yozilgan kech chiqish, shikast va boshqa jarimalar.
 *
 * Sana — jarima YOZILGAN kun. Bekor qilinganlar ham ro'yxatda (kim va
 * nega bekor qilgani bilan), lekin jamiga kirmaydi. Jarima puli alohida
 * tushum emas: u bron qarziga qo'shiladi va to'langanda odatdagi bron
 * to'lovi bo'lib "To'lovlar" ga tushadi.
 */

const fmt = (n: number) => Number(n || 0).toLocaleString()

const KIND_ACCENT: Record<string, string> = {
  LATE_CHECKOUT: "bg-amber-50 text-amber-700",
  DAMAGE: "bg-rose-50 text-rose-700",
  OTHER: "bg-gray-100 text-gray-700",
}

export function PenaltiesSection({ dateFrom, dateTo }: { dateFrom?: string; dateTo?: string }) {
  const { data, isLoading, isError } = useFinancePenalties(dateFrom, dateTo)

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }
  if (isError || !data) {
    return <div className="text-sm text-red-600">{tr("Xatolik yuz berdi. Iltimos qayta urining.")}</div>
  }

  const { summary, items } = data

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border-2 border-rose-200 bg-rose-50/60 p-4">
          <p className="text-xs font-medium text-rose-700">{tr("Jami jarimalar")}</p>
          <p className="text-xl font-bold tabular-nums text-rose-800">
            {tr("{{total}} So'm", { total: fmt(summary.total) })}
          </p>
          <p className="text-[11px] text-rose-600/80">
            {tr("{{count}} ta jarima", { count: summary.count })}
          </p>
        </div>
        {PENALTY_KINDS.map((k) => {
          const row = summary.by_kind[k] ?? { total: 0, count: 0 }
          return (
            <div key={k} className="rounded-lg border bg-white p-4">
              <p className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", KIND_ACCENT[k])}>
                  {penaltyKindLabel(k)}
                </span>
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-gray-900">
                {tr("{{total}} So'm", { total: fmt(row.total) })}
              </p>
              <p className="text-[11px] text-gray-400">{tr("{{count}} ta jarima", { count: row.count })}</p>
            </div>
          )
        })}
      </div>

      <div className="overflow-hidden rounded-lg border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <h2 className="text-lg font-bold tracking-tight">{tr("Yozilgan jarimalar")}</h2>
          <span className="text-xs text-gray-400">
            {tr("to'langanda bron to'lovi bo'lib tushumga kiradi")}
          </span>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>{tr("Sana")}</TableHead>
                <TableHead>{tr("Bron")}</TableHead>
                <TableHead>{tr("Mehmon")}</TableHead>
                <TableHead>{tr("Turi")}</TableHead>
                <TableHead>{tr("Izoh")}</TableHead>
                <TableHead>{tr("Kim yozdi")}</TableHead>
                <TableHead className="text-right">{tr("Summa")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-gray-400">
                    {tr("Tanlangan davrda jarima yozilmagan")}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((p) => {
                  const voided = !!p.voided_at
                  return (
                    <TableRow key={p.id} className={cn(voided && "bg-gray-50/70 text-gray-400")}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {p.created_at ? format(new Date(p.created_at), "dd.MM.yyyy HH:mm") : p.penalty_date || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        <span className="font-medium text-gray-800">{p.reservation_number || "—"}</span>
                        {p.room_number && (
                          <span className="block text-[11px] text-gray-400">
                            {tr("Xona {{room}}", { room: p.room_number })}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{p.guest_name || "—"}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium",
                            KIND_ACCENT[p.kind] || KIND_ACCENT.OTHER
                          )}
                        >
                          {penaltyKindLabel(p.kind)}
                        </span>
                        {voided && (
                          <span className="mt-1 block text-[11px] text-gray-500">
                            {tr("Bekor qilingan")}
                            {p.voided_by_name ? ` · ${p.voided_by_name}` : ""}
                            {p.void_reason ? ` · ${p.void_reason}` : ""}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[220px] break-words text-xs">{p.note || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{p.created_by_name || "—"}</TableCell>
                      <TableCell
                        className={cn(
                          "whitespace-nowrap text-right font-semibold tabular-nums",
                          voided ? "text-gray-400 line-through" : "text-rose-700"
                        )}
                      >
                        {fmt(p.amount)}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
