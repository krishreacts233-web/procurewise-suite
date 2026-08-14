import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "User Management | easybidding" },
      { name: "description", content: "Manage portal users, roles, access status and password resets." },
      { property: "og:title", content: "User Management | easybidding" },
      { property: "og:description", content: "Super Admin user and role administration." },
    ],
  }),
  component: UsersPage,
});

const ROLES = ["super_admin", "purchase", "vendor"] as const;

function UsersPage() {
  const { isSuperAdmin } = useAuth();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["users-admin"],
    queryFn: async () => {
      const [p, r, a] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("*"),
        supabase.from("account_approval_requests").select("*"),
      ]);
      if (p.error) {
        console.error("[USER]", p.error.message);
        throw p.error;
      }
      return { profiles: p.data ?? [], roles: r.data ?? [], approvals: a.data ?? [] };
    },
  });

  if (!isSuperAdmin) return <p className="text-sm text-muted-foreground">Super Admin access only.</p>;

  async function setRole(userId: string, role: string) {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: role as (typeof ROLES)[number] });
    if (error) {
      console.error("[USER] role assign failed:", error.message);
      toast.error(error.message);
      return;
    }
    await logAudit({ action: "Status Changed", recordId: userId, status: role, details: "Role assigned" });
    toast.success("Role updated");
    void qc.invalidateQueries({ queryKey: ["users-admin"] });
  }

  async function toggleActive(userId: string, isActive: boolean) {
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: !isActive })
      .eq("id", userId);
    if (error) {
      console.error("[USER] toggle failed:", error.message);
      toast.error(error.message);
      return;
    }
    await supabase
      .from("account_approval_requests")
      .update({ isActive: !isActive, last_updated: new Date().toISOString() })
      .eq("userId", userId);
    toast.success(isActive ? "User disabled" : "User enabled");
    void qc.invalidateQueries({ queryKey: ["users-admin"] });
  }

  async function resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/settings`,
    });
    if (error) {
      console.error("[AUTH] reset failed:", error.message);
      toast.error(error.message);
      return;
    }
    toast.success(`Password reset email sent to ${email}`);
  }

  const profiles = data?.profiles ?? [];

  return (
    <>
      <PageHeader
        title="User Management"
        subtitle="All users, roles and access status from the database."
      />
      <Card className="panel">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="p-3">User Name</th>
                <th>User ID</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th className="p-3 print:hidden">Manage</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => {
                const role = data?.roles.find((r) => r.user_id === p.id)?.role ?? "";
                const approval = data?.approvals.find((a) => a.userId === p.id);
                return (
                  <tr key={p.id} className="border-b border-border/60">
                    <td className="p-3 font-medium">{p.display_name}</td>
                    <td className="font-mono text-xs text-muted-foreground">{p.id.slice(0, 8)}…</td>
                    <td>{p.email}</td>
                    <td className="print:hidden">
                      <Select value={role} onValueChange={(v) => setRole(p.id, v)}>
                        <SelectTrigger className="w-36">
                          <SelectValue placeholder="Assign role" />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td>
                      <StatusPill
                        status={!p.is_active ? "Disabled" : (approval?.status ?? "Pending")}
                      />
                    </td>
                    <td className="text-xs text-muted-foreground">
                      {p.last_login ? new Date(p.last_login).toLocaleString() : "—"}
                    </td>
                    <td className="space-x-2 p-3 print:hidden">
                      <Button size="sm" variant="outline" onClick={() => resetPassword(p.email)}>
                        Reset password
                      </Button>
                      <Button
                        size="sm"
                        variant={p.is_active ? "destructive" : "secondary"}
                        onClick={() => toggleActive(p.id, p.is_active)}
                      >
                        {p.is_active ? "Disable" : "Enable"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}
