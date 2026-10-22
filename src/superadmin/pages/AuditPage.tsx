import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Loader2 } from "lucide-react"

import { useHotels, usePanelAudit } from "../api/panel"
import { PanelBadge, PanelEmpty, PanelHeading, PanelSelect } from "../components/ui"
import { tr } from "@/i18n"

/** Harakatlar tarixi — kim, nima qildi. Faqat o'qish uchun. */
export function AuditPage() {
  const [params, setParams] = useSearchParams()
  const { data: hotels = [] } = useHotels()
  const [hotelId, setHotelId] = useState(params.get("hotel_id") || "")

  useEffect(() => {
    setHotelId(params.get("hotel_id") || "")
  }, [params])

  const changeHotel = (value: string) => {
    setHotelId(value)
    const next = new URLSearchParams(params)
    if (value) next.set("hotel_id", value)
    else next.delete("hotel_id")
    setParams(next, { replace: true })
  }

  const { data: rows = [], isLoading } = usePanelAudit(hotelId)

  return (
    <div>
      <PanelHeading
        title={tr("Harakatlar tarixi")}
        subtitle={tr("Tizimdagi so'nggi o'zgarishlar")}
      />

      <div className="mb-4 max-w-xs">
        <PanelSelect
          value={hotelId}
          onChange={(e) => changeHotel(e.target.value)}
          aria-label={tr("Mehmonxona")}
        >
          <option value="">{tr("Barcha mehmonxonalar")}</option>
          {hotels.map((hotel) => (
            <option key={hotel.id} value={hotel.id}>
              {hotel.name}
            </option>
          ))}
        </PanelSelect>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
        </div>
      ) : rows.length === 0 ? (
        <PanelEmpty>{tr("Yozuv yo'q")}</PanelEmpty>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#101216]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-white/[0.06] bg-white/[0.02] text-left text-[11px] text-slate-500">
                <tr>
                  <th className="px-3 py-2.5 font-medium">{tr("Vaqt")}</th>
                  <th className="px-3 py-2.5 font-medium">{tr("Xodim")}</th>
                  <th className="px-3 py-2.5 font-medium">{tr("Mehmonxona")}</th>
                  <th className="px-3 py-2.5 font-medium">{tr("Harakat")}</th>
                  <th className="px-3 py-2.5 font-medium">{tr("Obyekt")}</th>
                  <th className="px-3 py-2.5 font-medium">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.02]">
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-400">
                      {row.created_at
                        ? new Date(row.created_at).toLocaleString("uz-UZ")
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-300">
                      {row.user_name || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-400">
                      {row.hotel_name || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <PanelBadge tone="info">{row.action}</PanelBadge>
                    </td>
                    <td className="px-3 py-2.5 text-slate-400">
                      {row.entity_type}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">
                      {row.ip_address || "—"}
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
