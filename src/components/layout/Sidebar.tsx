import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, DoorOpen, CalendarCheck, CalendarDays, Wallet, Settings, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useAuthStore } from "@/store/auth";

export const Sidebar = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(true);
  const { user } = useAuthStore();

  const links = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Booking", href: "/booking", icon: CalendarDays },
    { name: "Reservations", href: "/reservations", icon: CalendarCheck },
    { name: "Rooms", href: "/rooms", icon: DoorOpen },
    { name: "Guests", href: "/guests", icon: Users },
    { name: "Finance", href: "/finance", icon: Wallet },
  ];

  if (user?.user_type === "ADMIN" || user?.user_type === "SUPER_ADMIN") {
    links.push({ name: "Settings", href: "/settings", icon: Settings });
  }

  return (
    <div
      className={cn(
        "flex flex-col border-r border-border bg-card transition-all duration-300 h-screen sticky top-0",
        isOpen ? "w-64" : "w-20"
      )}
    >
      <div className="flex h-16 items-center justify-between px-4 border-b border-border">
        {isOpen && <span className="text-xl font-bold text-primary">GoHotel</span>}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors"
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
        {links.map((link) => {
          const isActive = location.pathname === link.href;
          return (
            <Link
              key={link.name}
              to={link.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <link.icon size={20} />
              {isOpen && <span>{link.name}</span>}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
