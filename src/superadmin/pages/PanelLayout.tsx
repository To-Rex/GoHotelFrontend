import { useState } from "react"
import { NavLink, Navigate, Outlet, useNavigate } from "react-router-dom"
import {
  Building2,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  ShieldCheck,
  Users,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { PANEL_TOKEN_KEY } from "../api/client"
import { panelLogout, usePanelMe } from "../api/panel"

/**
 * Panel qobig'i: chapda menyu, o'ngda sahifa.
 *
 * Ko'rinish mehmonxona tizimidan ATAYLAB farq qiladi (to'q fon): bu
 * boshqa tizim va u butun mehmonxonalar ustidan nazorat beradi —
 * xodim tasodifan bu yerga tushib qolsa, farqni darhol ko'rsin.
 */

const LINKS = [
  { to: "/panel", end: true, label: "Umumiy", icon: LayoutDashboard },
  { to: "/panel/hotels", label: "Mehmonxonalar", icon: Building2 },
  { to: "/panel/users", label: "Panel foydalanuvchilari", icon: Users },
  { to: "/panel/security", label: "Xavfsizlik", icon: KeyRound },
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
        <Loader2 className="h-7 w-7 animate-spin text-slate-500" />
      </div>
    )
  }

  // Token yaroqsiz — mijoz uni allaqachon o'chirgan, kirishga qaytamiz
  if (isError || !me) return <Navigate to="/panel/login" replace />

  const signOut = () => {
    panelLogout()
    navigate("/panel/login", { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-800 bg-slate-900/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 lg:hidden"
          aria-label="Menyu"
        >
          <LayoutDashboard className="h-5 w-5" />
        </button>
        <ShieldCheck className="h-5 w-5 text-emerald-400" />
        <span className="text-sm font-bold">Boshqaruv paneli</span>
        <span className="ml-auto hidden text-xs text-slate-400 sm:block">
          {me.label}
          {me.is_root && (
            <span className="ml-2 rounded-full bg-emerald-900/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
              egasi
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={signOut}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          title="Chiqish"
          aria-label="Chiqish"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      <div className="flex">
        <nav
          className={cn(
            "border-r border-slate-800 bg-slate-900 p-3 lg:block lg:w-60 lg:flex-shrink-0",
            open ? "block w-full" : "hidden"
          )}
        >
          <ul className="space-y-1">
            {LINKS.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-slate-800 font-medium text-slate-100"
                        : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                    )
                  }
                >
                  <link.icon className="h-4 w-4 flex-shrink-0" />
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <main className={cn("min-w-0 flex-1 p-4 sm:p-6", open && "hidden lg:block")}>
          <Outlet context={{ isRoot: me.is_root }} />
        </main>
      </div>
    </div>
  )
}
