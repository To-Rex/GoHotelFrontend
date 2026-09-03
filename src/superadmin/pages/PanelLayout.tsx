import { useState } from "react"
import { NavLink, Navigate, Outlet, useNavigate } from "react-router-dom"
import {
  Building2,
  CalendarRange,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  ScrollText,
  ShieldCheck,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { PANEL_TOKEN_KEY } from "../api/client"
import { panelLogout, usePanelMe } from "../api/panel"

/**
 * Panel qobig'i: chapda menyu, o'ngda sahifa.
 *
 * Ko'rinish mehmonxona tizimidan ATAYLAB farq qiladi (to'q fon,
 * zumrad urg'u): bu boshqa tizim va u barcha mehmonxonalar ustidan
 * nazorat beradi — xodim tasodifan bu yerga tushib qolsa, farqni
 * darhol ko'rsin.
 *
 * Menyu MAVZULARGA bo'lingan: bo'limlar soni o'sib borgani sayin
 * tekis ro'yxatda kerakli bandni topish qiyinlashardi.
 */

const GROUPS = [
  {
    title: "Nazorat",
    links: [
      { to: "/panel", end: true, label: "Umumiy", icon: LayoutDashboard },
      { to: "/panel/reservations", label: "Bronlar", icon: CalendarRange },
      { to: "/panel/finance", label: "Moliya", icon: Wallet },
    ],
  },
  {
    title: "Obyektlar",
    links: [
      { to: "/panel/hotels", label: "Mehmonxonalar", icon: Building2 },
      { to: "/panel/guests", label: "Mehmonlar", icon: UserRound },
    ],
  },
  {
    title: "Tizim",
    links: [
      { to: "/panel/users", label: "Panel foydalanuvchilari", icon: Users },
      { to: "/panel/audit", label: "Harakatlar tarixi", icon: ScrollText },
      { to: "/panel/security", label: "Xavfsizlik", icon: KeyRound },
    ],
  },
]

export function PanelLayout() {
  const navigate = useNavigate()
  const hasToken = !!localStorage.getItem(PANEL_TOKEN_KEY)
  const { data: me, isLoading, isError } = usePanelMe(hasToken)
  const [open, setOpen] = useState(false)

  if (!hasToken) return <Navigate to="/panel/login" replace />

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
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
    <div className="flex h-full flex-col gap-5 p-4">
      {GROUPS.map((group) => (
        <div key={group.title}>
          <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
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
                      "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-emerald-500/10 font-medium text-emerald-300"
                        : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* Faol bandning chap chetidagi ingichka chiziq —
                          rangdan tashqari ikkinchi belgi */}
                      <span
                        className={cn(
                          "h-4 w-0.5 rounded-full transition-colors",
                          isActive ? "bg-emerald-400" : "bg-transparent"
                        )}
                      />
                      <link.icon className="h-4 w-4 flex-shrink-0" />
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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Yuqoridagi yumshoq yorug'lik — panelni mehmonxona ekranidan
          ajratib turadigan yagona bezak */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-64 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(16,185,129,0.10),transparent)]"
      />

      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-white/5 bg-slate-950/80 px-4 py-3 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 lg:hidden"
          aria-label="Menyu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">Boshqaruv paneli</p>
          <p className="hidden text-[11px] leading-tight text-slate-500 sm:block">
            Barcha mehmonxonalar ustidan nazorat
          </p>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-2 text-xs text-slate-400 sm:flex">
            {me.label}
            {me.is_root && (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                egasi
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-100"
            title="Chiqish"
            aria-label="Chiqish"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="relative flex">
        <nav
          className={cn(
            "border-r border-white/5 bg-slate-900/40 lg:block lg:w-64 lg:flex-shrink-0",
            open ? "block w-full" : "hidden"
          )}
        >
          <div className="lg:sticky lg:top-[57px]">{menu}</div>
        </nav>

        <main
          className={cn(
            "min-w-0 flex-1 p-4 sm:p-6 lg:p-8",
            open && "hidden lg:block"
          )}
        >
          <Outlet context={{ isRoot: me.is_root }} />
        </main>
      </div>
    </div>
  )
}
