import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { logAudit, notify } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({
    meta: [
      { title: "Account Approvals | easybidding" },
      { name: "description", content: "Super Admin review of pending login and account approval requests." },
      { property: "og:title", content: "Account Approvals | easybidding" },
      { property: "og:description", content: "Approve, reject or request corrections on account access." },
    ],
  }),
  component: Approvals,
});

interface ApprovalRow {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  status: string;
  isActive: boolean;
  rejection_reason: string | null;
  correction_message: string | null;
  last_updated: string;
}

function Approvals() {
  const { isSuperAdmin, user } = useAuth();
  const qc = useQueryClient();
  const [reason, setReason] = useState<Record<string, string>>({});

  const { data = [], isLoading } = useQuery({
    queryKey: ["approvals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_approval_requests")
        .select("*")
        .order("last_updated", { ascending: false });
      if (error) {
        console.error("[APPROVAL]", error.message);
        throw error;
      }
      return data as unknown as ApprovalRow[];
    },
  });

  if (!isSuperAdmin) {
    return <p className="text-sm text-muted-foreground">Super Admin access only.</p>;
  }

  const pending = data.filter((r) => r.status === "Pending");

  async function decide(row: ApprovalRow, decision: "Approved" | "Rejected" | "Correction Required") {
    const now = new Date().toISOString();
    const patch: {
      status: string;
      last_updated: string;
      approved_by?: string;
      approved_date?: string;
      rejected_by?: string;
      rejected_date?: string;
      rejection_reason?: string;
      correction_message?: string;
    } = { status: decision, last_updated: now };
    if (decision === "Approved") {
      patch.approved_by = user!.id;
      patch.approved_date = now;
    }
    if (decision === "Rejected") {
      patch.rejected_by = user!.id;
      patch.rejected_date = now;
      patch.rejection_reason = reason[row.id] ?? "Not specified";
    }
    if (decision === "Correction Required") {
      patch.correction_message = reason[row.id] ?? "Please update your details.";
    }

    const { error } = await supabase
      .from("account_approval_requests")
      .update(patch)
      .eq("id", row.id);
    if (error) {
      console.error("[APPROVAL] update failed:", error.message);
      toast.error(error.message);
      return;
    }

    if (decision === "Approved") {
      const { data: existing } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", row.userId);
      if (!existing || existing.length === 0) {
        const { error: roleErr } = await supabase
          .from("user_roles")
          .insert({ user_id: row.userId, role: "purchase" });
        if (roleErr) console.error("[USER] default role failed:", roleErr.message);
      }
    }

    await notify(
      [row.userId],
      `Account ${decision}`,
      decision === "Approved"
        ? "Your easybidding account has been approved. You can now sign in."
        : (patch.rejection_reason ?? patch.correction_message ?? decision),
    );
    await logAudit({
      action: decision === "Approved" ? "User Approved" : `User ${decision}`,
      recordId: row.userId,
      status: decision,
      details: row.email,
    });
    toast.success(`Request ${decision}`);
    void qc.invalidateQueries({ queryKey: ["approvals"] });
  }

  return (
    <>
      <PageHeader
        title="Account Approvals"
        subtitle="Pending login approvals read live from the database."
      />
      {pending.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">
          <Bell className="h-4 w-4" /> {pending.length} New Approval Request
          {pending.length > 1 ? "s" : ""}
        </div>
      )}

      <Card className="panel">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="p-3">Display Name</th>
                <th>Email</th>
                <th>User ID</th>
                <th>Status</th>
                <th>Last Updated</th>
                <th className="p-3 print:hidden">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
              {data.map((row) => (
                <tr key={row.id} className="border-b border-border/60 align-top">
                  <td className="p-3 font-medium">{row.displayName}</td>
                  <td>{row.email}</td>
                  <td className="font-mono text-xs text-muted-foreground">{row.userId}</td>
                  <td>
                    <StatusPill status={row.status} />
                  </td>
                  <td className="text-xs text-muted-foreground">
                    {new Date(row.last_updated).toLocaleString()}
                  </td>
                  <td className="p-3 print:hidden">
                    {row.status === "Pending" ? (
                      <div className="w-64 space-y-2">
                        <Textarea
                          placeholder="Reason / correction message"
                          value={reason[row.id] ?? ""}
                          onChange={(e) =>
                            setReason((s) => ({ ...s, [row.id]: e.target.value }))
                          }
                          className="min-h-16"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => decide(row, "Approved")}>
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => decide(row, "Rejected")}
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => decide(row, "Correction Required")}
                          >
                            Request correction
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {row.rejection_reason || row.correction_message || "Decision recorded"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}
