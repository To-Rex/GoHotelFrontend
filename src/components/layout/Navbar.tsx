import { useAuthStore } from "@/store/auth";
import { LogOut, User, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavbarProps {
  /** Mobil ko'rinishda sidebar drawer'ni ochish */
  onMenuClick?: () => void;
}

export const Navbar = ({ onMenuClick }: NavbarProps) => {
  const { user, logout } = useAuthStore();

  return (
    <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-md px-3 sm:px-6 shadow-sm">
      <div className="flex items-center gap-2">
        {/* Mobilda sidebar drawer tugmasi */}
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
            title="Menyu"
          >
            <Menu size={20} />
          </button>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <User size={18} />
          </div>
          <span className="hidden md:block">
            {user?.first_name} {user?.last_name}
          </span>
        </div>
        <Button variant="ghost" size="icon" onClick={logout} title="Chiqish">
          <LogOut size={18} className="text-muted-foreground hover:text-destructive" />
        </Button>
      </div>
    </header>
  );
};
