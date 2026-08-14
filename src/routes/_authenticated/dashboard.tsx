import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDepartments, useQuotations, useRequirements } from "@/lib/queries";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | easybidding" },
      {
        name: "description",
        content: "Department-wise procurement dashboard with live item, vendor and quotation counts.",
      },
      { property: "og:title", content: "Dashboard | easybidding" },
      { property: "og:description", content: "Live department-wise procurement overview." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { isStaff, vendorName } = useAuth();
  const { data: departments = [] } = useDepartments();
  const { data: requirements = [] } = useRequirements();
  const { data: quotations = [] } = useQuotations();

  const rows = departments.map((d) => {
    const reqs = requirements.filter((r) => r.department_id === d.id);
    return {
      dept: d,
      total: reqs.length,
      pending: reqs.filter((r) => r.status === "Pending").length,
      assigned: reqs.filter((r) => r.vendor_id).length,
      quoted: quotations.filter((q) => q.department_id === d.id).length,
    };
  });

  return (
    <>
      <PageHeader
        title={isStaff ? "Procurement Dashboard" : `${vendorName ?? "Vendor"} Dashboard`}
        subtitle={
          isStaff
            ? "Department-wise live figures from the database."
            : "Requirements assigned to your vendor account only."
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map((r) => (
          <Card key={r.dept.id} className="panel">
            <CardHeader className="pb-2">
              <CardTitle className="text-base uppercase tracking-wide text-primary">
                {r.dept.code}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Line label="Total Items" value={r.total} />
              <Line label="Pending" value={r.pending} />
              <Line label="Vendor Assigned" value={r.assigned} />
              <Line label="Quotation Received" value={r.quoted} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="panel mt-6">
        <CardHeader>
          <CardTitle className="text-base">Latest requirements</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2">Department</th>
                <th>Item</th>
                <th>Qty</th>
                <th>Vendor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {requirements.slice(0, 10).map((r) => (
                <tr key={r.id} className="border-t border-border/60">
                  <td className="py-2">{r.departments?.code}</td>
                  <td>
                    {r.items?.item_code} — {r.items?.item_name}
                  </td>
                  <td>
                    {r.quantity} {r.unit}
                  </td>
                  <td>{r.vendors?.vendor_name ?? "—"}</td>
                  <td>
                    <StatusPill status={r.status} />
                  </td>
                </tr>
              ))}
              {requirements.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">
                    No requirements yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
