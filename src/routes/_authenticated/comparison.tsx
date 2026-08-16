import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDepartments, useItems, useQuotations, useVendors } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/comparison")({
  head: () => ({
    meta: [
      { title: "Comparison Dashboard | easybidding" },
      {
        name: "description",
        content:
          "Compare vendor quotations item-wise by rate, delivery and payment terms with lowest-rate highlighting.",
      },
      { property: "og:title", content: "Comparison Dashboard | easybidding" },
      {
        property: "og:description",
        content: "Item-wise vendor quotation comparison with lowest rate highlighting.",
      },
    ],
  }),
  component: ComparisonPage,
});

const money = (n: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n ?? 0);

function ComparisonPage() {
  const { data: departments = [] } = useDepartments();
  const { data: items = [] } = useItems();
  const { data: vendors = [] } = useVendors();
  const { data: quotations = [] } = useQuotations();

  const [dept, setDept] = useState("all");
  const [item, setItem] = useState("all");
  const [vendor, setVendor] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      quotations.filter((q) => {
        if (dept !== "all" && q.department_id !== dept) return false;
        if (item !== "all" && q.item_id !== item) return false;
        if (vendor !== "all" && q.vendor_id !== vendor) return false;
        if (search.trim()) {
          const t = search.toLowerCase();
          const hay = [
            q.offer_number,
            q.items?.item_code,
            q.items?.item_name,
            q.vendors?.vendor_name,
            q.departments?.name,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!hay.includes(t)) return false;
        }
        return true;
      }),
    [quotations, dept, item, vendor, search],
  );

  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const q of filtered) {
      const key = `${q.department_id}::${q.item_id}`;
      const arr = map.get(key) ?? [];
      arr.push(q);
      map.set(key, arr);
    }
    return [...map.entries()].map(([key, rows]) => {
      const sorted = [...rows].sort((a, b) => Number(a.rate) - Number(b.rate));
      const lowest = sorted.length ? Number(sorted[0].rate) : 0;
      return { key, rows: sorted, lowest, head: sorted[0] };
    });
  }, [filtered]);

  const totalSaving = groups.reduce((acc, g) => {
    if (g.rows.length < 2) return acc;
    const highest = Number(g.rows[g.rows.length - 1].rate);
    return acc + (highest - g.lowest) * Number(g.rows[0].quantity ?? 1);
  }, 0);

  return (
    <>
      <PageHeader
        title="Comparison Dashboard"
        subtitle="Item-wise vendor quotation comparison. Lowest rate per item is highlighted."
        actions={
          <Button variant="outline" onClick={() => window.print()}>
            Print / Export PDF
          </Button>
        }
      />

      <Card className="panel mb-6">
        <CardContent className="grid gap-3 p-4 md:grid-cols-4">
          <Select value={dept} onValueChange={setDept}>
            <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.code} — {d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={item} onValueChange={setItem}>
            <SelectTrigger><SelectValue placeholder="Item" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All items</SelectItem>
              {items.map((i) => (
                <SelectItem key={i.id} value={i.id}>{i.item_code} — {i.item_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={vendor} onValueChange={setVendor}>
            <SelectTrigger><SelectValue placeholder="Vendor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All vendors</SelectItem>
              {vendors.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.vendor_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Search offer / item / vendor"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Comparison groups" value={String(groups.length)} />
        <Stat label="Quotations compared" value={String(filtered.length)} />
        <Stat label="Potential saving (₹)" value={money(totalSaving)} />
      </div>

      {groups.length === 0 && (
        <Card className="panel">
          <CardContent className="p-6 text-sm text-muted-foreground">
            No quotations match the selected filters.
          </CardContent>
        </Card>
      )}

      <div className="space-y-5">
        {groups.map((g) => (
          <Card key={g.key} className="panel">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                <span className="text-primary">{g.head?.items?.item_code}</span>{" "}
                {g.head?.items?.item_name}
                <span className="ml-2 text-xs font-normal uppercase tracking-wide text-muted-foreground">
                  {g.head?.departments?.code} · {g.rows.length} quotation
                  {g.rows.length > 1 ? "s" : ""}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2">Vendor</th>
                    <th>Offer No.</th>
                    <th>Offer Date</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Rate</th>
                    <th className="text-right">Total</th>
                    <th>Delivery Terms</th>
                    <th>Payment Terms</th>
                    <th>Contact</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((q) => {
                    const best = Number(q.rate) === g.lowest;
                    return (
                      <tr
                        key={q.id}
                        className={`border-t border-border/60 ${
                          best ? "bg-success/10" : ""
                        }`}
                      >
                        <td className="py-2 font-medium">
                          {q.vendors?.vendor_name}
                          {best && (
                            <span className="ml-2 rounded-full border border-success/30 bg-success/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-success">
                              Lowest
                            </span>
                          )}
                        </td>
                        <td>{q.offer_number}</td>
                        <td>{q.offer_date}</td>
                        <td className="text-right">{money(Number(q.quantity))}</td>
                        <td className={`text-right ${best ? "font-bold text-success" : ""}`}>
                          {money(Number(q.rate))}
                        </td>
                        <td className="text-right">{money(Number(q.total))}</td>
                        <td>{q.delivery_terms || "—"}</td>
                        <td>{q.payment_terms || "—"}</td>
                        <td>
                          {q.contact_person || "—"}
                          {q.contact_number ? ` · ${q.contact_number}` : ""}
                        </td>
                        <td><StatusPill status={q.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="panel">
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
