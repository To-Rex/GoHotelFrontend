import { useState } from "react"
import { Loader2, TrendingDown, TrendingUp, Wallet } from "lucide-react"

import { usePanelFinance, useHotels } from "../api/panel"
import {
  PanelCard,
  PanelEmpty,
  PanelHeading,
  PanelInput,
  PanelSelect,
} from "../components/ui"

const iso = (d: Date) => d.toISOString().slice(0, 10)

const monthStart = () => {
  const now = new Date()
  return iso(new Date(now.getFullYear(), now.getMonth(), 1))
}

const money = (value: number) =>
  value.toLocaleString("uz-UZ", { maximumFractionDigits: 0 })

/** Barcha mehmonxonalar bo'yicha kirim/chiqim — davr tanlanadi. */
export function FinancePage() {
  const { data: hotels = [] } = useHotels()
  const [dateFrom, setDateFrom] = useState(monthStart)
  const [dateTo, setDateTo] = useState(() => iso(new Date()))
  const [hotelId, setHotelId] = useState("")

  const { data, isLoading } = usePanelFinance(dateFrom, dateTo, hotelId)
  const rows = data?.items ?? []

  const cards = [
    {
      label: "Kirim",
      value: data?.income ?? 0,
      icon: TrendingUp,
      tone: "text-emerald-400",
    },
    {
      label: "Chiqim",
      value: data?.expense ?? 0,
      icon: TrendingDown,
      tone: "text-red-400",
    },
    {
      label: "Sof foyda",
      value: data?.net ?? 0,
      icon: Wallet,
      // Sof foyda manfiy bo'lishi mumkin — rang shundan kelib chiqadi
      tone: (data?.net ?? 0) < 0 ? "text-red-400" : "text-sky-400",
    },
  ]

  return (
    <div>
      <PanelHeading title="Moliya" subtitle="Davr bo'yicha kirim va chiqim" />

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <PanelInput
          type="date"
          label="Boshlanish"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <PanelInput
          type="date"
          label="Tugash"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
        <PanelSelect
          label="Mehmonxona"
          value={hotelId}
          onChange={(e) => setHotelId(e.target.value)}
        >
          <option value="">Barchasi</option>
          {hotels.map((hotel) => (
            <option key={hotel.id} value={hotel.id}>
              {hotel.name}
            </option>
          ))}
        </PanelSelect>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <PanelCard key={card.label}>
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">{card.label}</p>
              <card.icon className={`h-4 w-4 ${card.tone}`} />
            </div>
            <p className={`mt-1.5 text-2xl font-bold tabular-nums ${card.tone}`}>
              {money(card.value)}
            </p>
          </PanelCard>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
        </div>
      ) : rows.length === 0 ? (
        <PanelEmpty>Bu davrda to'lov yo'q</PanelEmpty>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="bg-white/[0.03] text-left text-xs text-slate-400">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Mehmonxona</th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    To'lovlar
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium">Kirim</th>
                  <th className="px-3 py-2.5 text-right font-medium">Chiqim</th>
                  <th className="px-3 py-2.5 text-right font-medium">Sof</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((row) => (
                  <tr key={row.hotel_id} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5 font-medium text-slate-200">
                      {row.hotel_name}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">
                      {row.payment_count}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-emerald-400">
                      {money(row.income)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-red-400">
                      {money(row.expense)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums text-slate-200">
                      {money(row.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
