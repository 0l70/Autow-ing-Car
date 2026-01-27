import { LogOut } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { useAuthStore } from "@/features/auth/model/useAuthStore";

export function Header() {
  const { logout, user } = useAuthStore();

  return (
    <header className="relative z-50 flex h-6 w-full shrink-0 items-center justify-between border-b border-white/10 bg-slate-950/80 px-4 backdrop-blur-md">
      {/* 1. Logo / Title */}
      <div className="flex items-center gap-2">
        <div className="h-2 w-1 bg-accent-cyan shadow-[0_0_8px_rgba(0,255,255,0.8)] rounded-full" />
        <h1 className="text-xs font-bold tracking-widest text-slate-200">
          {user?.role === 'PILOT' ? 'PILOT DASHBOARD' : 'ATC CONTROL CENTER'}
        </h1>
      </div>

      {/* 2. Actions */}
      <div className="flex items-center gap-">
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="text-slate-400 hover:text-white hover:bg-white/10 gap-2"
        >
          <LogOut className="h-2 w-2" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </header>
  );
}
