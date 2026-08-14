import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  ShieldCheck,
  Users,
  Package,
  Building2,
  Truck,
  FileText,
  GitCompare,
  Activity,
  ScrollText,
  Settings,
  ShoppingCart,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/lib/auth";

type NavItem = { to: string; label: string; icon: typeof Users; roles: string[] };

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["super_admin", "purchase", "vendor"] },
  { to: "/approvals", label: "Approvals", icon: ShieldCheck, roles: ["super_admin"] },
  { to: "/users", label: "Users", icon: Users, roles: ["super_admin"] },
  { to: "/departments", label: "Departments", icon: Building2, roles: ["super_admin", "purchase"] },
  { to: "/items", label: "Item Master", icon: Package, roles: ["super_admin", "purchase"] },
  { to: "/vendors", label: "Vendor Master", icon: Truck, roles: ["super_admin", "purchase"] },
  { to: "/purchase", label: "Purchase", icon: ShoppingCart, roles: ["super_admin", "purchase"] },
  { to: "/quotations", label: "Vendor Quotations", icon: FileText, roles: ["super_admin", "purchase", "vendor"] },
  { to: "/comparison", label: "Comparison Dashboard", icon: GitCompare, roles: ["super_admin", "purchase"] },
  { to: "/status", label: "Status", icon: Activity, roles: ["super_admin", "purchase", "vendor"] },
  { to: "/audit", label: "Audit Log", icon: ScrollText, roles: ["super_admin"] },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["super_admin", "purchase", "vendor"] },
];

export function PortalLayout({ children }: { children: ReactNode }) {
  const { roles, isSuperAdmin, vendorName, profile } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const visible = NAV.filter((n) => n.roles.some((r) => roles.includes(r as never)));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <div className="flex">
        <aside className="sticky top-[65px] hidden h-[calc(100vh-65px)] w-64 shrink-0 overflow-y-auto border-r border-sidebar-border bg-sidebar p-3 md:block print:hidden">
          <p className="px-3 pb-2 pt-2 text-[11px] uppercase tracking-widest text-muted-foreground">
            {isSuperAdmin ? "Admin Panel" : vendorName ? "Vendor Portal" : "Portal Access"}
          </p>
          <nav className="space-y-1">
            {visible.map((item) => {
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-6 rounded-lg border border-sidebar-border p-3 text-xs text-muted-foreground">
            <div className="font-medium text-sidebar-foreground">{profile?.display_name}</div>
            <div>{roles.join(", ") || "no role"}</div>
            {vendorName && <div className="mt-1 text-primary">{vendorName}</div>}
          </div>
        </aside>
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
      <nav className="sticky bottom-0 z-30 flex gap-1 overflow-x-auto border-t border-border bg-sidebar p-2 md:hidden print:hidden">
        {visible.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex min-w-16 flex-col items-center gap-1 rounded-md px-2 py-1 text-[10px] text-sidebar-foreground/80"
          >
            <item.icon className="h-4 w-4" />
            {item.label.split(" ")[0]}
          </Link>
        ))}
      </nav>
    </div>
  );
}
