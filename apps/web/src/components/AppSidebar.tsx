import { Link, useMatchRoute } from "@tanstack/react-router";
import {
  BoxesIcon,
  FolderOpenIcon,
  SettingsIcon,
  LogOutIcon,
} from "lucide-react";
import { useState } from "react";
import { logout } from "../lib/api";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function NavIcon({
  to,
  icon: Icon,
  label,
  matchPath,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  matchPath?: Record<string, unknown>;
}) {
  const matchRoute = useMatchRoute();
  const isActive = !!matchRoute({ to, fuzzy: true, ...matchPath });

  return (
    <Link
      to={to}
      title={label}
      className={cn(
        "flex items-center justify-center size-10 transition-colors",
        isActive
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon className="size-5" />
    </Link>
  );
}

export function AppSidebar() {
  const navigate = useNavigate();
  const [showLogout, setShowLogout] = useState(false);

  async function handleLogout() {
    try {
      await logout();
      navigate({ to: "/login" });
    } catch (e) {
      toast.error("Logout failed — please try again.");
      console.error("Logout failed:", e);
    }
  }

  return (
    <aside className="flex flex-col items-center w-14 shrink-0 border-r border-border bg-card py-3 gap-1">
      {/* App logo */}
      <Link
        to="/projects"
        title="Memo Mesh"
        className="flex items-center justify-center size-10 mb-2 text-primary"
      >
        <BoxesIcon className="size-6" />
      </Link>

      {/* Divider */}
      <div className="w-6 h-px bg-border mb-1" />

      {/* Navigation */}
      <nav className="flex flex-col items-center gap-1 flex-1">
        <NavIcon to="/projects" icon={FolderOpenIcon} label="Projects" />
      </nav>

      {/* Bottom section */}
      <div className="flex flex-col items-center gap-1 mt-auto">
        <div className="w-6 h-px bg-border mb-1" />
        <NavIcon to="/settings" icon={SettingsIcon} label="Settings" />

        {/* Profile / Logout */}
        <div className="relative">
          <button
            onClick={() => setShowLogout((v) => !v)}
            title="Account"
            className={cn(
              "flex items-center justify-center size-10 transition-colors text-muted-foreground hover:bg-accent hover:text-foreground",
              showLogout && "bg-accent text-foreground"
            )}
          >
            <LogOutIcon className="size-5" />
          </button>

          {showLogout && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowLogout(false)}
              />
              <div className="absolute left-full bottom-0 ml-2 z-50 min-w-32 bg-popover text-popover-foreground ring-1 ring-foreground/10 shadow-md p-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <LogOutIcon className="size-3.5" />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
