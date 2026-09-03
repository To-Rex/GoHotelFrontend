import { useState } from "react"
import { Loader2 } from "lucide-react"

import { useHotels, usePanelAudit } from "../api/panel"
import { PanelEmpty, PanelHeading, PanelSelect } from "../components/ui"

/** Harakatlar tarixi — kim, nima qildi. Faqat o'qish uchun. */
export function AuditPage() {
  const { data: hotels = [] } = useHotels()
  const [hotelId, setHotelId] = useState("")
  const { data: rows = [], isLoading } = usePanelAudit(hotelId)

  return (
    <div>
      <PanelHeading
        title="Harakatlar tarixi"
        subtitle="Tizimdagi so'nggi o'zgarishlar"
      />

      <div className="mb-4 max-w-xs">
        <PanelSelect
          value={hotelId}
          onChange={(e) => setHotelId(e.target.value)}
        >
          <option value="">Barcha mehmonxonalar</option>
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
        <PanelEmpty>Yozuv yo'q</PanelEmpty>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-white/[0.03] text-left text-xs text-slate-400">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Vaqt</th>
                  <th className="px-3 py-2.5 font-medium">Xodim</th>
                  <th className="px-3 py-2.5 font-medium">Mehmonxona</th>
                  <th className="px-3 py-2.5 font-medium">Harakat</th>
                  <th className="px-3 py-2.5 font-medium">Obyekt</th>
                  <th className="px-3 py-2.5 font-medium">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
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
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-300">
                        {row.action}
                      </span>
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
