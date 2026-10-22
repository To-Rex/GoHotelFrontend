import { useEffect, useState } from "react"
import { NavLink, Navigate, Outlet, useNavigate } from "react-router-dom"
import {
  Building2,
  CalendarRange,
  KeyRound,
  HeartPulse,
  LayoutDashboard,
  Megaphone,
  Loader2,
  LogOut,
  Menu,
  PackageOpen,
  Activity,
  ScrollText,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { PANEL_TOKEN_KEY } from "../api/client"
import { panelLogout, usePanelMe } from "../api/panel"
import { CommandPalette, type PaletteNavItem } from "../components/CommandPalette"
import { tr, trc } from "@/i18n"
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher"

/**
 * Panel qobig'i: chapda menyu, o'ngda sahifa.
 *
 * Ko'rinish mehmonxona tizimidan ATAYLAB farq qiladi (to'q fon, zumrad
 * urg'u): bu boshqa tizim va u barcha mehmonxonalar ustidan nazorat
 * beradi. Dizayn minimal: gradient yo'q, faqat tekis sirt va ingichka
 * chegaralar. Ctrl/Cmd+K — istalgan sahifa yoki mehmonxonaga tezkor o'tish.
 */

const GROUPS = [
  {
    title: tr("Nazorat"),
    links: [
      { to: "/panel", end: true, label: tr("Umumiy"), icon: LayoutDashboard },
      { to: "/panel/reservations", label: tr("Bronlar"), icon: CalendarRange },
      { to: "/panel/finance", label: tr("Moliya"), icon: Wallet },
    ],
  },
  {
    title: tr("Obyektlar"),
    links: [
      { to: "/panel/hotels", label: tr("Mehmonxonalar"), icon: Building2 },
      { to: "/panel/guests", label: tr("Mehmonlar"), icon: UserRound },
      { to: "/panel/configurators", label: tr("Sozlovchilar"), icon: SlidersHorizontal },
    ],
  },
  {
    title: tr("Tizim"),
    links: [
      { to: "/panel/broadcast", label: tr("E'lonlar"), icon: Megaphone },
      { to: "/panel/system", label: tr("Tizim holati"), icon: HeartPulse },
      { to: "/panel/apps", label: tr("Dasturlar do'koni"), icon: PackageOpen },
      { to: "/panel/users", label: tr("Panel foydalanuvchilari"), icon: Users },
      { to: "/panel/audit", label: tr("Harakatlar tarixi"), icon: ScrollText },
      { to: "/panel/api-logs", label: tr("So'rovlar jurnali"), icon: Activity },
      { to: "/panel/security", label: tr("Xavfsizlik"), icon: KeyRound },
    ],
  },
]

const PALETTE_NAV: PaletteNavItem[] = GROUPS.flatMap((group) =>
  group.links.map((link) => ({
    label: link.label,
    to: link.to,
    icon: link.icon,
  }))
)

export function PanelLayout() {
  const navigate = useNavigate()
  const hasToken = !!localStorage.getItem(PANEL_TOKEN_KEY)
  const { data: me, isLoading, isError } = usePanelMe(hasToken)
  const [open, setOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setPaletteOpen((value) => !value)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  if (!hasToken) return <Navigate to="/panel/login" replace />

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0b0d]">
        <Loader2 className="h-7 w-7 animate-spin text-slate-600" />
      </div>
    )
  }

  // Token yaroqsiz — mijoz uni allaqachon o'chirgan, kirishga qaytamiz
  if (isError || !me) return <Navigate to="/panel/login" replace />

  const signOut = () => {
    panelLogout()
    navigate("/panel/login", { replace: true })
  }

  const menu = (
    <div className="flex h-full flex-col gap-5 p-3">
      {GROUPS.map((group) => (
        <div key={group.title}>
          <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
            {group.title}
          </p>
          <ul className="space-y-0.5">
            {group.links.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors",
                      isActive
                        ? "bg-white/[0.06] font-medium text-slate-100"
                        : "text-slate-500 hover:bg-white/[0.03] hover:text-slate-300"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          "absolute left-0 h-4 w-0.5 rounded-full transition-colors",
                          isActive ? "bg-emerald-400" : "bg-transparent"
                        )}
                      />
                      <link.icon
                        className={cn(
                          "h-4 w-4 flex-shrink-0",
                          isActive ? "text-emerald-300" : "text-slate-600 group-hover:text-slate-400"
                        )}
                      />
                      {link.label}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-slate-100">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-white/[0.06] bg-[#0a0b0d]/90 px-4 backdrop-blur">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-white/[0.04] hover:text-slate-200 lg:hidden"
          aria-label={tr("Menyu")}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-400/15 bg-emerald-400/10">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight text-slate-100">
            {tr("Boshqaruv paneli")}
          </p>
          <p className="hidden text-[10px] leading-tight text-slate-600 sm:block">
            {tr("Barcha mehmonxonalar ustidan nazorat")}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="ml-auto hidden h-8 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 text-xs text-slate-500 transition-colors hover:border-white/15 hover:text-slate-300 sm:flex"
        >
          <Search className="h-3.5 w-3.5" />
          {tr("Qidirish...")}
          <kbd className="ml-2 rounded border border-white/10 px-1 py-0.5 text-[10px] text-slate-600">
            Ctrl K
          </kbd>
        </button>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="ml-auto rounded-lg border border-white/[0.08] p-1.5 text-slate-500 hover:text-slate-200 sm:hidden"
          aria-label={tr("Qidirish...")}
        >
          <Search className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 sm:ml-2">
          <LanguageSwitcher scene="night" />
          <span className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
            {me.label}
            {me.is_root && (
              <span className="rounded border border-emerald-400/15 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                {tr("egasi")}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white/[0.04] hover:text-slate-100"
            title={trc("login", "Chiqish")}
            aria-label={trc("login", "Chiqish")}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="relative flex">
        <nav
          className={cn(
            "border-r border-white/[0.06] bg-[#0c0e11] lg:block lg:w-60 lg:flex-shrink-0",
            open ? "block w-full" : "hidden"
          )}
        >
          <div className="lg:sticky lg:top-14">{menu}</div>
        </nav>

        <main
          className={cn(
            "min-w-0 flex-1 p-4 sm:p-6 lg:p-8",
            open && "hidden lg:block"
          )}
        >
          <div className="mx-auto w-full max-w-[1500px]">
            <Outlet context={{ isRoot: me.is_root }} />
          </div>
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        nav={PALETTE_NAV}
      />
    </div>
  )
}
