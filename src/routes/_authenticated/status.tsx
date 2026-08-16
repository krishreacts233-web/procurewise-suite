import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
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
import {
  REQ_STATUSES,
  useDepartments,
  useQuotations,
  useRequirements,
} from "@/lib/queries";
import { logAudit } from "@/lib/audit";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/status")({
  head: () => ({
    meta: [
      { title: "Status Tracking | easybidding" },
      {
        name: "description",
        content:
          "Track every purchase requirement from vendor assignment to quotation received and final approval.",
      },
      { property: "og:title", content: "Status Tracking | easybidding" },
      {
        property: "og:description",
        content: "Live procurement status across departments, items and vendors.",
      },
    ],
  }),
  component: StatusPage,
});

function StatusPage() {
  const { isStaff } = useAuth();
  const qc = useQueryClient();
  const { data: requirements = [], isLoading } = useRequirements();
  const { data: quotations = [] } = useQuotations();
  const { data: departments = [] } = useDepartments();
  const [dept, setDept] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const quoteCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const q of quotations) {
      map.set(q.requirement_id, (map.get(q.requirement_id) ?? 0) + 1);
    }
    return map;
  }, [quotations]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return requirements.filter((r) => {
      if (dept !== "all" && r.department_id !== dept) return false;
      if (status !== "all" && r.status !== status) return false;
      if (!term) return true;
      return [
        r.items?.item_code,
        r.items?.item_name,
        r.vendors?.vendor_name,
        r.departments?.name,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [requirements, dept, status, search]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of requirements) map.set(r.status, (map.get(r.status) ?? 0) + 1);
    return map;
  }, [requirements]);

  async function updateStatus(id: string, next: string) {
    const { error } = await supabase
      .from("purchase_requirements")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[STATUS] update failed:", error.message);
      toast.error(error.message);
      return;
    }
    await logAudit({ action: "Status Changed", recordId: id, status: next });
    toast.success(`Status set to ${next}`);
    void qc.invalidateQueries({ queryKey: ["requirements"] });
  }

  return (
    <div>
      <PageHeader
        title="Status Tracking"
        subtitle="Live progress of every requirement across departments and vendors."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {["Pending", "Vendor Assigned", "Quotation Received", "Completed"].map((s) => (
          <Card key={s}>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{s}</p>
              <p className="mt-1 text-2xl font-bold">{counts.get(s) ?? 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          placeholder="Search item, vendor, department"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:max-w-xs"
        />
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="w-full md:w-56">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.code} — {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full md:w-56">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {REQ_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
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
                <th className="p-3">Department</th>
                <th className="p-3">Item</th>
                <th className="p-3">Qty</th>
                <th className="p-3">Vendor</th>
                <th className="p-3">Required</th>
                <th className="p-3">Quotes</th>
                <th className="p-3">Status</th>
                {isStaff && <th className="p-3">Update</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="p-3">{r.departments?.code ?? "—"}</td>
                  <td className="p-3">
                    <div className="font-medium">{r.items?.item_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.items?.item_code}</div>
                  </td>
                  <td className="p-3">
                    {r.quantity} {r.unit}
                  </td>
                  <td className="p-3">{r.vendors?.vendor_name ?? "Unassigned"}</td>
                  <td className="p-3">{r.required_date ?? "—"}</td>
                  <td className="p-3">{quoteCount.get(r.id) ?? 0}</td>
                  <td className="p-3">
                    <StatusPill status={r.status} />
                  </td>
                  {isStaff && (
                    <td className="p-3">
                      <Select value={r.status} onValueChange={(v) => void updateStatus(r.id, v)}>
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {REQ_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-sm text-muted-foreground">
                    {isLoading ? "Loading requirements…" : "No requirements match these filters."}
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
