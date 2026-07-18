import { useAuthStore } from "@/store/auth";
import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Navbar = () => {
  const { user, logout } = useAuthStore();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-md px-6 shadow-sm">
      <div className="flex items-center gap-4">
        {/* Page Title or Breadcrumbs could go here */}
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
