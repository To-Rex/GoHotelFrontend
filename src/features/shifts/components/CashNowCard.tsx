import { format } from "date-fns"
import { Banknote, Info, Loader2, RefreshCw } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { usePermissions } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { isForbiddenError, useCashOverview, type CashDrawer } from "../api/shifts"
import { tr } from "@/i18n"

/* Kassada hozir — ochiq smenalardagi kassalarda HOZIR bo'lishi kerak bo'lgan
   naqd pul (server: `/shifts/cash-overview`, smena topshirish bilan AYNAN bir
   hisob): boshlang'ich kassa + naqd to'lovlar + do'kon naqd savdosi − naqd
   xarajat. Har daqiqada yangilanadi.

   Faqat administrator va menejer (`shift.force_close`) ko'radi — "ko'r
   sanash": kassir o'z kassasidagi kutilgan summani topshirishdan oldin
   ko'rmasligi kerak. Ruxsat bo'lmasa karta umuman chiqmaydi.

   Oddiy rejimda kassa sessiyalari yuritilmaydi — tizim kassadagi pulni
   bilmaydi, shuni tushuntiruvchi qisqa izoh chiqadi. */

const fmt = (n: number | null | undefined) => Number(n || 0).toLocaleString()

const time = (value?: string | null) => (value ? format(new Date(value), "dd.MM HH:mm") : "")

function DrawerRow({ drawer }: { drawer: CashDrawer }) {
  const pending = drawer.status === "PENDING_HANDOVER"
  const counted = drawer.counted_cash
  const diff = pending && counted != null ? counted - drawer.expected_cash : null
  return (
    <li className="rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-gray-900">
            <span className="truncate">{drawer.user_name || "—"}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                pending ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
              )}
            >
              {pending ? tr("Topshirilmoqda") : tr("Ishlamoqda")}
            </span>
          </p>
          <p className="text-[11px] text-gray-500">
            {[drawer.branch_name, tr("boshlangan: {{time}}", { time: time(drawer.started_at) })]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <p className="text-base font-bold tabular-nums text-gray-900">
          {tr("{{amount}} so'm", { amount: fmt(drawer.expected_cash) })}
        </p>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
        {tr("Boshlang'ich {{opening}} + to'lovlar {{payments}} + do'kon {{shop}} − xarajat {{expenses}}", {
          opening: fmt(drawer.opening_cash),
          payments: fmt(drawer.payments_cash),
          shop: fmt(drawer.shop_cash),
          expenses: fmt(drawer.expenses_cash),
        })}
      </p>
      {pending && counted != null && (
        <p
          className={cn(
            "mt-1 text-[11px] font-medium",
            diff != null && Math.abs(diff) >= 1 ? (diff < 0 ? "text-red-600" : "text-amber-600") : "text-gray-600"
          )}
        >
          {tr("Sanab topshirildi: {{counted}} so'm", { counted: fmt(counted) })}
          {diff != null && Math.abs(diff) >= 1 && (
            <> · {tr("farq: {{diff}}", { diff: `${diff > 0 ? "+" : ""}${fmt(diff)}` })}</>
          )}
        </p>
      )}
    </li>
  )
}

export function CashNowCard({ className }: { className?: string }) {
  // Administrator (sozlovchi ham) yoki kassa nazorati huquqi — server bilan bir xil
  const { can } = usePermissions()
  const allowed = can("shift.force_close")
  const { data, isLoading, isError, error, isFetching, refetch, dataUpdatedAt } =
    useCashOverview(allowed)

  // Ruxsat yo'q — karta umuman ko'rinmaydi (xato emas)
  if (!allowed || (isError && isForbiddenError(error))) return null

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <Banknote className="h-5 w-5" />
        </span>
        <div>
          <p className="text-base font-bold tracking-tight text-gray-900">{tr("Kassada hozir")}</p>
          <p className="text-xs text-gray-500">
            {tr("Ochiq smenalarda kassada bo'lishi kerak bo'lgan naqd pul")}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => refetch()}
        disabled={isFetching}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:opacity-60"
        title={tr("Yangilash")}
      >
        {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        {dataUpdatedAt ? format(new Date(dataUpdatedAt), "HH:mm") : ""}
      </button>
    </div>
  )

  return (
    <div className={cn("rounded-xl border-2 border-emerald-200 bg-white p-4", className)}>
      {header}

      {isLoading ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : isError || !data ? (
        <p className="mt-3 text-sm text-red-600">{tr("Xatolik yuz berdi. Iltimos qayta urining.")}</p>
      ) : data.mode !== "cash" ? (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2.5 text-xs leading-relaxed text-gray-600">
          <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
          {tr("Smenalar oddiy rejimda — kassa sessiyalari yuritilmaydi, shuning uchun tizim kassada hozir qancha pul borligini bilmaydi. Buni ko'rish uchun sozlovchi Sozlamalar → «Kassa va smena» bo'limida kassali rejimni yoqadi.")}
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
            <p className="text-3xl font-bold tabular-nums leading-none text-emerald-700">
              {fmt(data.total_expected)}
              <span className="ml-1.5 text-base font-medium text-gray-400">{tr("so'm")}</span>
            </p>
            <p className="text-xs text-gray-500">
              {tr("Ochiq: {{active}} · topshirilmoqda: {{pending}}", {
                active: data.active_count,
                pending: data.pending_count,
              })}
            </p>
          </div>
          {data.sessions.length === 0 ? (
            <p className="mt-3 text-xs text-gray-500">
              {tr("Hozir ochiq kassa yo'q — pul topshirilgan yoki kassadan olingan.")}
            </p>
          ) : (
            <ul className="mt-3 grid gap-2 lg:grid-cols-2">
              {data.sessions.map((drawer) => (
                <DrawerRow key={drawer.id} drawer={drawer} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
