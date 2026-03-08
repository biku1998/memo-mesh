import { Link, useMatchRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BoxesIcon,
  FolderOpenIcon,
  BookOpenIcon,
  SettingsIcon,
  LogOutIcon,
} from "lucide-react";
import { getMe, logout } from "../lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

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
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to={to}
          className={cn(
            "flex items-center justify-center size-10 transition-colors",
            isActive
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <Icon className="size-5" />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function getInitials(email: string) {
  return email.charAt(0).toUpperCase();
}

export function AppSidebar() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    staleTime: Infinity,
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      navigate({ to: "/login" });
    },
    onError: () => {
      toast.error("Logout failed — please try again.");
    },
  });

  return (
    <aside className="flex flex-col items-center w-14 shrink-0 border-r border-border bg-card py-3 gap-1">
      {/* App logo */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to="/projects"
            className="flex items-center justify-center size-10 mb-2 text-primary"
          >
            <BoxesIcon className="size-6" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">Memo Mesh</TooltipContent>
      </Tooltip>

      {/* Divider */}
      <div className="w-6 h-px bg-border mb-1" />

      {/* Navigation */}
      <nav className="flex flex-col items-center gap-1 flex-1">
        <NavIcon to="/projects" icon={FolderOpenIcon} label="Projects" />
      </nav>

      {/* Bottom section */}
      <div className="flex flex-col items-center gap-1 mt-auto">
        <div className="w-6 h-px bg-border mb-1" />
        <NavIcon to="/api-docs" icon={BookOpenIcon} label="API Docs" />
        <NavIcon to="/settings" icon={SettingsIcon} label="Settings" />

        {/* User menu */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center justify-center size-10 transition-colors text-muted-foreground hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
                >
                  <Avatar size="sm">
                    <AvatarFallback className="text-xs font-medium">
                      {user ? getInitials(user.email) : "?"}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right">Account</TooltipContent>
          </Tooltip>
          <DropdownMenuContent side="right" align="end" className="min-w-48">
            {user && (
              <>
                <DropdownMenuLabel className="font-normal">
                  <span className="text-xs text-muted-foreground truncate block">
                    {user.email}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => logoutMutation.mutate()}>
              <LogOutIcon className="size-3.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
