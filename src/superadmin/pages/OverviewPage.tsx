import { useState } from "react"
import { Link } from "react-router-dom"
import {
  Activity,
  ArrowUpRight,
  BedDouble,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Database,
  HardDrive,
  HeartPulse,
  Loader2,
  MapPin,
  Megaphone,
  PackageOpen,
  ScrollText,
  ShieldCheck,
  UserRound,
  Users,
  Wallet,
  XCircle,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { panelError } from "../api/client"
import {
  useEnterHotel,
  useHotels,
  useOverview,
  usePanelAudit,
  useSystemStatus,
  type PanelHotel,
} from "../api/panel"
import {
  PanelBadge,
  PanelButton,
  PanelCard,
  PanelHeading,
  PanelSection,
  PanelStat,
} from "../components/ui"
import { tr, trc } from "@/i18n"

const QUICK_ACTIONS = [
  {
    to: "/panel/hotels",
    label: tr("Mehmonxonalar"),
    hint: tr("Qo'shish, tahrirlash, kirish"),
    icon: Building2,
  },
  {
    to: "/panel/broadcast",
    label: tr("E'lonlar"),
    hint: tr("SMS va push yuborish"),
    icon: Megaphone,
  },
  {
    to: "/panel/system",
    label: tr("Tizim holati"),
    hint: tr("Baza, ombor, scheduler"),
    icon: HeartPulse,
  },
  {
    to: "/panel/api-logs",
    label: tr("So'rovlar jurnali"),
    hint: tr("Jonli API oqimi"),
    icon: Activity,
  },
  {
    to: "/panel/apps",
    label: tr("Dasturlar do'koni"),
    hint: tr("Mobil ilova relizlari"),
    icon: PackageOpen,
  },
  {
    to: "/panel/security",
    label: tr("Xavfsizlik"),
    hint: tr("Panel va kirish sozlamalari"),
    icon: ShieldCheck,
  },
]

/**
 * Boshqaruv markazi — tizim bo'yicha yig'ma raqamlar, tezkor amallar,
 * tizim salomatligi, mehmonxonalar va so'nggi harakatlar bir sahifada.
 */
export function OverviewPage() {
  const { data, isLoading } = useOverview()
  const { data: hotels = [] } = useHotels()
  const { data: system } = useSystemStatus()
  const { data: audit = [] } = usePanelAudit()
  const enter = useEnterHotel()
  const [enterError, setEnterError] = useState<string | null>(null)

  const cards = [
    {
      label: tr("Mehmonxonalar"),
      value: data?.hotels,
      hint: tr("{{v}} ta faol", { v: data?.hotels_active ?? 0 }),
      icon: Building2,
      to: "/panel/hotels",
    },
    {
      label: tr("Filiallar"),
      value: data?.branches,
      icon: MapPin,
      to: "/panel/hotels",
    },
    {
      label: tr("Xonalar"),
      value: data?.rooms,
      icon: BedDouble,
      to: "/panel/hotels",
    },
    {
      label: tr("Xodimlar"),
      value: data?.users,
      icon: Users,
      to: "/panel/hotels",
    },
    {
      label: tr("Mehmonlar"),
      value: data?.guests,
      icon: UserRound,
      to: "/panel/guests",
    },
    {
      label: tr("Bronlar"),
      value: data?.reservations,
      hint: tr("{{v}} ta faol", { v: data?.reservations_active ?? 0 }),
      icon: CalendarCheck,
      to: "/panel/reservations",
    },
  ]

  const sortedHotels = [...hotels]
    .sort(
      (a, b) =>
        Number(b.status === "ACTIVE") - Number(a.status === "ACTIVE") ||
        a.name.localeCompare(b.name)
    )
    .slice(0, 6)

  const health = system
    ? [
        { label: tr("Ma'lumotlar bazasi"), ok: system.database.ok, icon: Database },
        { label: tr("Fayl ombori"), ok: system.storage.ok, icon: HardDrive },
        { label: tr("Push"), ok: system.push.ok, icon: Megaphone },
        { label: tr("Rejalashtiruvchi"), ok: system.scheduler.running, icon: Activity },
      ]
    : []

  const openHotel = async (hotel: PanelHotel) => {
    setEnterError(null)
    try {
      await enter.mutateAsync({ hotelId: hotel.id })
    } catch (error) {
      setEnterError(panelError(error))
    }
  }

  return (
    <div>
      <PanelHeading
        title={tr("Boshqaruv markazi")}
        subtitle={tr("Tizimdagi barcha mehmonxonalar bo'yicha")}
        action={
          <Link
            to="/panel/hotels"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-slate-200"
          >
            {tr("Barcha mehmonxonalar")}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        }
      />

      {enterError && (
        <p className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/[0.07] px-3 py-2 text-xs text-rose-300">
          {enterError}
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            {cards.map((card) => (
              <PanelStat
                key={card.label}
                label={card.label}
                value={card.value}
                hint={card.hint}
                icon={card.icon}
                to={card.to}
              />
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="space-y-6">
              <PanelSection
                title={tr("Tezkor amallar")}
                subtitle={tr("Eng ko'p ishlatiladigan bo'limlar")}
              >
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {QUICK_ACTIONS.map((action) => (
                    <Link
                      key={action.to}
                      to={action.to}
                      className="group flex items-center gap-3 rounded-xl border border-white/[0.07] bg-[#101216] px-3 py-3 transition-colors hover:border-white/15"
                    >
                      <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-white/[0.04] text-slate-400 group-hover:text-emerald-300">
                        <action.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-slate-200">
                          {action.label}
                        </span>
                        <span className="block truncate text-[11px] text-slate-600">
                          {action.hint}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </PanelSection>

              <PanelSection
                title={tr("Mehmonxonalar")}
                subtitle={tr("Faol va boshqarishga tayyor obyektlar")}
                action={
                  <Link
                    to="/panel/hotels"
                    className="text-xs text-slate-500 transition-colors hover:text-slate-300"
                  >
                    {tr("Barchasi")} →
                  </Link>
                }
              >
                <PanelCard className="overflow-hidden p-0">
                  {sortedHotels.length === 0 ? (
                    <p className="px-4 py-8 text-center text-xs text-slate-500">
                      {tr("Hozircha mehmonxona yo'q")}
                    </p>
                  ) : (
                    <div className="divide-y divide-white/[0.06]">
                      {sortedHotels.map((hotel) => (
                        <div
                          key={hotel.id}
                          className="flex flex-wrap items-center gap-3 px-4 py-3"
                        >
                          <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-white/[0.04] text-slate-500">
                            <Building2 className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-2 truncate text-[13px] font-medium text-slate-200">
                              {hotel.name}
                              <PanelBadge
                                tone={hotel.status === "ACTIVE" ? "success" : "warning"}
                              >
                                {hotel.status === "ACTIVE" ? tr("Faol") : tr("To'xtatilgan")}
                              </PanelBadge>
                            </p>
                            <p className="truncate text-[11px] text-slate-600">
                              {hotel.code}
                              {hotel.city ? ` · ${hotel.city}` : ""} · {hotel.branch_count ?? 0}{" "}
                              {trc("count", "Filial")} · {hotel.room_count ?? 0}{" "}
                              {trc("count", "Xona")} · {hotel.user_count ?? 0}{" "}
                              {trc("count", "Xodim")}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Link
                              to={`/panel/hotels/${hotel.id}`}
                              className="inline-flex h-7 items-center rounded-md border border-white/[0.08] px-2 text-[11px] text-slate-300 hover:bg-white/[0.04]"
                            >
                              {tr("Boshqarish")}
                            </Link>
                            <PanelButton
                              className="h-7 px-2 text-[11px]"
                              disabled={enter.isPending}
                              onClick={() => void openHotel(hotel)}
                            >
                              {tr("Kirish")}
                            </PanelButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </PanelCard>
              </PanelSection>
            </div>

            <div className="space-y-6">
              <PanelSection
                title={tr("Tizim holati")}
                subtitle={tr("Asosiy servislar bir qarashda")}
                action={
                  <Link
                    to="/panel/system"
                    className="text-xs text-slate-500 transition-colors hover:text-slate-300"
                  >
                    {tr("Batafsil")} →
                  </Link>
                }
              >
                <PanelCard className="space-y-1">
                  {health.length === 0 ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-600" />
                    </div>
                  ) : (
                    health.map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-white/[0.03]"
                      >
                        <item.icon className="h-4 w-4 flex-shrink-0 text-slate-500" />
                        <span className="min-w-0 flex-1 truncate text-[13px] text-slate-300">
                          {item.label}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 text-[11px]",
                            item.ok ? "text-emerald-300" : "text-rose-300"
                          )}
                        >
                          {item.ok ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" />
                          )}
                          {item.ok ? tr("Ishlayapti") : tr("Ishlamayapti")}
                        </span>
                      </div>
                    ))
                  )}
                </PanelCard>
              </PanelSection>

              <PanelSection
                title={tr("So'nggi harakatlar")}
                subtitle={tr("Tizimdagi oxirgi o'zgarishlar")}
                action={
                  <Link
                    to="/panel/audit"
                    className="text-xs text-slate-500 transition-colors hover:text-slate-300"
                  >
                    {tr("Barchasi")} →
                  </Link>
                }
              >
                <PanelCard className="p-0">
                  {audit.length === 0 ? (
                    <p className="px-4 py-8 text-center text-xs text-slate-500">
                      {tr("Yozuv yo'q")}
                    </p>
                  ) : (
                    <div className="divide-y divide-white/[0.06]">
                      {audit.slice(0, 5).map((row) => (
                        <div key={row.id} className="flex items-start gap-2.5 px-3 py-2.5">
                          <ScrollText className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-600" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] text-slate-300">
                              {row.user_name || "—"}{" "}
                              <span className="text-slate-500">· {row.action}</span>
                            </p>
                            <p className="truncate text-[10px] text-slate-600">
                              {row.hotel_name || "—"}
                              {row.entity_type ? ` · ${row.entity_type}` : ""}
                              {row.created_at
                                ? ` · ${new Date(row.created_at).toLocaleString("uz-UZ")}`
                                : ""}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </PanelCard>
              </PanelSection>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center gap-2 border-t border-white/[0.06] pt-3 text-[11px] text-slate-600">
        <Wallet className="h-3.5 w-3.5" />
        {tr("Har bir mehmonxonani to'liq boshqarish uchun «Kirish» — sozlovchi huquqida asosiy tizimni ochadi.")}
      </div>
    </div>
  )
}
