import {
  BedDouble,
  Building2,
  CalendarCheck,
  Loader2,
  MapPin,
  UserRound,
  Users,
} from "lucide-react"

import { useOverview } from "../api/panel"
import { PanelCard, PanelHeading } from "../components/ui"

/** Tizim bo'yicha yig'ma raqamlar — panelning bosh sahifasi. */
export function OverviewPage() {
  const { data, isLoading } = useOverview()

  const cards = [
    {
      label: "Mehmonxonalar",
      value: data?.hotels,
      hint: `${data?.hotels_active ?? 0} ta faol`,
      icon: Building2,
    },
    { label: "Filiallar", value: data?.branches, icon: MapPin },
    { label: "Xonalar", value: data?.rooms, icon: BedDouble },
    { label: "Xodimlar", value: data?.users, icon: Users },
    { label: "Mehmonlar", value: data?.guests, icon: UserRound },
    {
      label: "Bronlar",
      value: data?.reservations,
      hint: `${data?.reservations_active ?? 0} ta faol`,
      icon: CalendarCheck,
    },
  ]

  return (
    <div>
      <PanelHeading
        title="Umumiy holat"
        subtitle="Tizimdagi barcha mehmonxonalar bo'yicha"
      />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {cards.map((card) => (
            <PanelCard key={card.label}>
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-800">
                  <card.icon className="h-4 w-4 text-emerald-400" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">{card.label}</p>
                  <p className="text-xl font-bold tabular-nums text-slate-100">
                    {card.value ?? 0}
                  </p>
                  {card.hint && (
                    <p className="text-[11px] text-slate-500">{card.hint}</p>
                  )}
                </div>
              </div>
            </PanelCard>
          ))}
        </div>
      )}
    </div>
  )
}
