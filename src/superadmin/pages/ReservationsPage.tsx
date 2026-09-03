import { useState } from "react"
import { Loader2, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  useHotels,
  usePanelReservations,
  type ReservationFilters,
} from "../api/panel"
import {
  PanelButton,
  PanelEmpty,
  PanelHeading,
  PanelSelect,
} from "../components/ui"

const PAGE_SIZE = 50

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Kutilmoqda",
  CONFIRMED: "Tasdiqlangan",
  CHECKED_IN: "Joylashgan",
  CHECKED_OUT: "Chiqib ketgan",
  CANCELLED: "Bekor qilingan",
  NO_SHOW: "Kelmagan",
}

const statusStyle: Record<string, string> = {
  PENDING: "bg-slate-500/15 text-slate-300",
  CONFIRMED: "bg-sky-500/15 text-sky-300",
  CHECKED_IN: "bg-emerald-500/15 text-emerald-300",
  CHECKED_OUT: "bg-slate-500/15 text-slate-400",
  CANCELLED: "bg-red-500/15 text-red-300",
  NO_SHOW: "bg-amber-500/15 text-amber-300",
}

const money = (value: number) =>
  value.toLocaleString("uz-UZ", { maximumFractionDigits: 0 })

/**
 * Barcha mehmonxonalardagi bronlar.
 *
 * Mehmonxona ichidagi ekran faqat o'z bronlarini ko'rsatadi — bu yerda
 * hammasi bir joyda va obyekt bo'yicha filtrlanadi.
 */
export function ReservationsPage() {
  const { data: hotels = [] } = useHotels()
  const [filters, setFilters] = useState<ReservationFilters>({
    skip: 0,
    limit: PAGE_SIZE,
  })
  const [searchInput, setSearchInput] = useState("")

  const { data, isLoading, isFetching } = usePanelReservations(filters)
  const rows = data?.items ?? []
  const total = data?.total ?? 0
  const page = Math.floor((filters.skip ?? 0) / PAGE_SIZE)
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const patch = (next: Partial<ReservationFilters>) =>
    // Filtr o'zgarsa birinchi sahifaga qaytiladi: 5-sahifada turib
    // boshqa mehmonxonani tanlagan odam bo'sh ro'yxat ko'rmasligi kerak
    setFilters((f) => ({ ...f, ...next, skip: 0 }))

  return (
    <div>
      <PanelHeading
        title="Bronlar"
        subtitle={`Barcha mehmonxonalar bo'yicha · ${total} ta`}
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <PanelSelect
          value={filters.hotel_id || ""}
          onChange={(e) => patch({ hotel_id: e.target.value || undefined })}
        >
          <option value="">Barcha mehmonxonalar</option>
          {hotels.map((hotel) => (
            <option key={hotel.id} value={hotel.id}>
              {hotel.name}
            </option>
          ))}
        </PanelSelect>

        <PanelSelect
          value={filters.status || ""}
          onChange={(e) => patch({ status: e.target.value || undefined })}
        >
          <option value="">Barcha holatlar</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </PanelSelect>

        <form
          className="relative sm:col-span-2"
          onSubmit={(e) => {
            e.preventDefault()
            patch({ search: searchInput })
          }}
        >
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Mehmon, bron raqami yoki xona..."
            className="h-9 w-full rounded-lg border border-white/10 bg-slate-950/60 pl-8 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500/60 focus:outline-none"
          />
        </form>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
        </div>
      ) : rows.length === 0 ? (
        <PanelEmpty>Bron topilmadi</PanelEmpty>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-white/[0.03] text-left text-xs text-slate-400">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Bron</th>
                  <th className="px-3 py-2.5 font-medium">Mehmonxona</th>
                  <th className="px-3 py-2.5 font-medium">Mehmon</th>
                  <th className="px-3 py-2.5 font-medium">Xona</th>
                  <th className="px-3 py-2.5 font-medium">Muddat</th>
                  <th className="px-3 py-2.5 font-medium">Holat</th>
                  <th className="px-3 py-2.5 text-right font-medium">Summa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5 font-medium text-slate-200">
                      {r.reservation_number}
                    </td>
                    <td className="px-3 py-2.5 text-slate-400">{r.hotel_name}</td>
                    <td className="px-3 py-2.5 text-slate-300">
                      {r.guest_name || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-400">{r.room_number}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-400">
                      {r.check_in_date} → {r.check_out_date}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px]",
                          statusStyle[r.status] || statusStyle.PENDING
                        )}
                      >
                        {STATUS_LABELS[r.status] || r.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <span className="font-medium text-slate-200">
                        {money(r.total_amount)}
                      </span>
                      {r.paid_amount < r.total_amount && (
                        <span className="block text-[11px] text-amber-400">
                          qoldiq {money(r.total_amount - r.paid_amount)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 px-3 py-2 text-xs text-slate-400">
            <span className="tabular-nums">
              {(filters.skip ?? 0) + 1}–{(filters.skip ?? 0) + rows.length} / {total}
            </span>
            {pageCount > 1 && (
              <div className="flex items-center gap-2">
                <PanelButton
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  disabled={page <= 0 || isFetching}
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      skip: Math.max((f.skip ?? 0) - PAGE_SIZE, 0),
                    }))
                  }
                >
                  Oldingi
                </PanelButton>
                <span className="tabular-nums">
                  {page + 1} / {pageCount}
                </span>
                <PanelButton
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  disabled={page >= pageCount - 1 || isFetching}
                  onClick={() =>
                    setFilters((f) => ({ ...f, skip: (f.skip ?? 0) + PAGE_SIZE }))
                  }
                >
                  Keyingi
                </PanelButton>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
