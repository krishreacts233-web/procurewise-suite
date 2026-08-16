import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({
    meta: [
      { title: "Audit Log | easybidding" },
      {
        name: "description",
        content:
          "Full audit trail of user, approval, master data and quotation activity in the procurement portal.",
      },
      { property: "og:title", content: "Audit Log | easybidding" },
      { property: "og:description", content: "Who did what, and when, across easybidding." },
    ],
  }),
  component: AuditPage,
});

interface AuditRow {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  record_id: string | null;
  status: string | null;
  details: string | null;
  created_at: string;
}

function useAuditLog() {
  return useQuery({
    queryKey: ["audit_log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) {
        console.error("[AUDIT]", error.message);
        throw error;
      }
      return data as AuditRow[];
    },
  });
}

function toCsv(rows: AuditRow[]) {
  const head = ["Date", "User", "Action", "Record", "Status", "Details"];
  const body = rows.map((r) =>
    [
      new Date(r.created_at).toISOString(),
      r.user_name ?? "",
      r.action,
      r.record_id ?? "",
      r.status ?? "",
      (r.details ?? "").replace(/"/g, '""'),
    ]
      .map((v) => `"${v}"`)
      .join(","),
  );
  return [head.join(","), ...body].join("\n");
}

function AuditPage() {
  const { isSuperAdmin } = useAuth();
  const { data = [], isLoading } = useAuditLog();
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");

  const actions = useMemo(
    () => Array.from(new Set(data.map((r) => r.action))).sort(),
    [data],
  );

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.filter((r) => {
      if (action !== "all" && r.action !== action) return false;
      if (!term) return true;
      return [r.user_name, r.action, r.details, r.record_id, r.status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [data, search, action]);

  if (!isSuperAdmin) return <p className="text-sm text-muted-foreground">Not authorized.</p>;

  function download() {
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `easybidding-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle="Every account, master data and procurement action recorded by the system."
        actions={
          <Button variant="secondary" onClick={download} disabled={rows.length === 0}>
            Export CSV
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          placeholder="Search user, action, details"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:max-w-xs"
        />
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-full md:w-60">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {actions.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-3">Date &amp; time</th>
                <th className="p-3">User</th>
                <th className="p-3">Action</th>
                <th className="p-3">Status</th>
                <th className="p-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="whitespace-nowrap p-3 text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="p-3">{r.user_name ?? "system"}</td>
                  <td className="p-3 font-medium">{r.action}</td>
                  <td className="p-3">{r.status ? <StatusPill status={r.status} /> : "—"}</td>
                  <td className="p-3 text-muted-foreground">{r.details ?? r.record_id ?? "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">
                    {isLoading ? "Loading audit trail…" : "No audit entries found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
