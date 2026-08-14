import { Link, useNavigate } from "@tanstack/react-router";
import { LogIn, LogOut, Printer, Radio } from "lucide-react";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { NotificationBell } from "@/components/NotificationBell";

export function AppHeader() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const isDev = import.meta.env.DEV;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card/80 backdrop-blur">
      <div className="flex w-full items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link to="/" className="shrink-0">
          <Brand />
        </Link>

        <div className="hidden flex-1 justify-center md:flex">
          {isDev && (
            <Badge variant="outline" className="gap-1 border-primary/40 text-primary">
              <Radio className="h-3 w-3 animate-pulse" /> Development connection active
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {user && <NotificationBell />}
          {user && (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {profile?.display_name || user.email}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="hidden sm:inline-flex"
              >
                <Printer className="h-4 w-4" /> Print / Save PDF
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  await signOut();
                  void navigate({ to: "/", replace: true });
                }}
              >
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </>
          )}
          {!user && (
            <Button size="sm" onClick={() => navigate({ to: "/" })}>
              <LogIn className="h-4 w-4" /> Sign in
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
