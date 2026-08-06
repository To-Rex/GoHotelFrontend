import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  DoorOpen,
  CalendarCheck,
  CalendarDays,
  Wallet,
  Settings,
  Layers,
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
  TrendingDown,
  Store,
  FileBarChart,
  BedDouble,
  Sparkles,
  ConciergeBell,
  ClipboardList,
  UserCog,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { usePermissions } from "@/lib/permissions";
import { useAuthStore } from "@/store/auth";

export const Sidebar = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(true);
  const { canRoute } = usePermissions();
  const user = useAuthStore((s) => s.user);

  const allLinks = [
    { name: "Boshqaruv", href: "/", icon: LayoutDashboard },
    { name: "Bron qilish", href: "/booking", icon: CalendarDays },
    { name: "Bandlovlar", href: "/reservations", icon: CalendarCheck },
    { name: "Xonalar", href: "/rooms", icon: DoorOpen },
    { name: "Qavatlar", href: "/floors", icon: Layers },
    { name: "Mehmonlar", href: "/guests", icon: Users },
    { name: "Moliya", href: "/finance", icon: Wallet },
    { name: "Xarajatlar", href: "/expenses", icon: TrendingDown },
    { name: "Do'kon", href: "/shop", icon: Store },
    { name: "Mening hisobotim", href: "/my-reports", icon: FileBarChart },
    { name: "Sozlamalar", href: "/settings", icon: Settings },
  ];

  // Boshqaruv (administratsiya) bo'limlari — admin/menejer o'z mehmonxonasini
  // to'liq boshqarishi uchun. Ruxsati bo'lmagan foydalanuvchiga ko'rinmaydi.
  const managementLinks = [
    { name: "Xona turlari", href: "/room-types", icon: BedDouble },
    { name: "Qulayliklar", href: "/amenities", icon: Sparkles },
    { name: "Xizmatlar", href: "/services", icon: ConciergeBell },
    { name: "Xo'jalik ishlari", href: "/housekeeping", icon: ClipboardList },
    { name: "Xodimlar", href: "/employees", icon: UserCog },
    { name: "Ruxsatnomalar", href: "/permissions", icon: ShieldCheck },
  ];

  // Foydalanuvchining ruxsatlariga mos sahifalargina ko'rsatiladi.
  const links = allLinks.filter((l) => canRoute(l.href));
  const adminLinks = managementLinks.filter((l) => canRoute(l.href));

  const initials = user
    ? `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase() || "?"
    : "?";

  const roleLabel =
    user?.user_type === "SUPER_ADMIN"
      ? "Super admin"
      : user?.user_type === "ADMIN"
        ? "Administrator"
        : "Xodim";

  // Bitta havolani chizish — asosiy va administratsiya guruhlari uchun umumiy
  const renderLink = (link: { name: string; href: string; icon: any }) => {
    const isActive =
      link.href === "/"
        ? location.pathname === "/"
        : location.pathname === link.href ||
          location.pathname.startsWith(link.href + "/");
    return (
      <Link
        key={link.name}
        to={link.href}
        title={!isOpen ? link.name : undefined}
        className={cn(
          "group relative flex items-center rounded-xl text-sm font-medium transition-all duration-200",
          isOpen ? "gap-3 px-3 py-2.5" : "justify-center px-0 py-2.5",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        {/* Active accent bar */}
        {isActive && (
          <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
        )}
        <link.icon
          size={19}
          className={cn(
            "flex-shrink-0 transition-transform duration-200",
            isActive ? "scale-105" : "group-hover:scale-105"
          )}
        />
        {isOpen && <span className="truncate">{link.name}</span>}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-border bg-card/60 backdrop-blur-xl transition-[width] duration-300 ease-in-out",
        isOpen ? "w-64" : "w-[76px]"
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          "flex h-16 flex-shrink-0 items-center border-b border-border/70",
          isOpen ? "px-4" : "justify-center px-0"
        )}
      >
        <Link to="/" className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-500/25">
            <Building2 className="h-[18px] w-[18px] text-white" />
          </div>
          {isOpen && (
            <span className="truncate text-[15px] font-bold tracking-tight text-foreground">
              GoHotel
            </span>
          )}
        </Link>
        {isOpen && (
          <button
            onClick={() => setIsOpen(false)}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Yig'ish"
          >
            <PanelLeftClose size={18} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        {links.map(renderLink)}

        {/* Administratsiya bo'limi — ruxsatga ega bo'lganlarga ko'rinadi */}
        {adminLinks.length > 0 && (
          <>
            <div
              className={cn(
                "pt-4 pb-1",
                isOpen ? "px-3" : "flex justify-center"
              )}
            >
              {isOpen ? (
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Administratsiya
                </span>
              ) : (
                <span className="block h-px w-6 bg-border" />
              )}
            </div>
            {adminLinks.map(renderLink)}
          </>
        )}
      </nav>

      {/* Expand button (collapsed) */}
      {!isOpen && (
        <div className="flex justify-center pb-2">
          <button
            onClick={() => setIsOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Yoyish"
          >
            <PanelLeftOpen size={18} />
          </button>
        </div>
      )}

      {/* User */}
      <div className="flex-shrink-0 border-t border-border/70 p-3">
        <div
          className={cn(
            "flex items-center rounded-xl transition-colors",
            isOpen ? "gap-3 p-2 hover:bg-muted" : "justify-center"
          )}
        >
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-xs font-semibold text-white shadow-sm ring-2 ring-primary-500/15">
            {initials}
          </div>
          {isOpen && (
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="truncate text-[13px] font-semibold leading-tight text-foreground">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="truncate text-[11px] leading-tight text-muted-foreground">
                {roleLabel}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
