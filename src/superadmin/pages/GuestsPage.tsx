import { useState } from "react"
import { Loader2, Search, ShieldAlert } from "lucide-react"

import { usePanelGuests } from "../api/panel"
import { PanelEmpty, PanelHeading } from "../components/ui"

/** Mehmonlar bazasi — u barcha mehmonxonalar uchun umumiy. */
export function GuestsPage() {
  const [input, setInput] = useState("")
  const [search, setSearch] = useState("")
  const { data: rows = [], isLoading } = usePanelGuests(search)

  return (
    <div>
      <PanelHeading
        title="Mehmonlar"
        subtitle="Baza barcha mehmonxonalar uchun umumiy"
      />

      <form
        className="relative mb-4 max-w-md"
        onSubmit={(e) => {
          e.preventDefault()
          setSearch(input)
        }}
      >
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ism, telefon yoki pasport..."
          className="h-9 w-full rounded-lg border border-white/10 bg-slate-950/60 pl-8 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500/60 focus:outline-none"
        />
      </form>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
        </div>
      ) : rows.length === 0 ? (
        <PanelEmpty>Mehmon topilmadi</PanelEmpty>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-white/[0.03] text-left text-xs text-slate-400">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Ism</th>
                  <th className="px-3 py-2.5 font-medium">Telefon</th>
                  <th className="px-3 py-2.5 font-medium">Pasport</th>
                  <th className="px-3 py-2.5 font-medium">Qo'shilgan</th>
                  <th className="px-3 py-2.5 font-medium">Holat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5 font-medium text-slate-200">
                      {row.name}
                    </td>
                    <td className="px-3 py-2.5 text-slate-400">
                      {row.phone || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-400">
                      {row.passport_number || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-500">
                      {row.created_at
                        ? new Date(row.created_at).toLocaleDateString("uz-UZ")
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      {row.blacklisted ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] text-red-300"
                          title={row.blacklist_reason || undefined}
                        >
                          <ShieldAlert className="h-3 w-3" />
                          Qora ro'yxat
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
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
