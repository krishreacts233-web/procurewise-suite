import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  QUOTE_STATUSES,
  useDepartments,
  useQuotations,
  useRequirements,
  useVendors,
  type Requirement,
} from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { logAudit, notify } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/quotations")({
  head: () => ({
    meta: [
      { title: "Vendor Quotations | easybidding" },
      { name: "description", content: "Submit, filter and review vendor quotations by department, item and status." },
      { property: "og:title", content: "Vendor Quotations | easybidding" },
      { property: "og:description", content: "Quotation management with combined filters and review flags." },
    ],
  }),
  component: QuotationsPage,
});

const EMPTY = {
  offer_number: "",
  offer_date: new Date().toISOString().slice(0, 10),
  rate: "",
  delivery_terms: "",
  payment_terms: "",
  contact_person: "",
  contact_number: "",
  attachment_url: "",
};

function QuotationsPage() {
  const { isStaff, isVendor, vendorId, user } = useAuth();
  const qc = useQueryClient();
  const { data: quotations = [] } = useQuotations();
  const { data: requirements = [] } = useRequirements();
  const { data: vendors = [] } = useVendors();
  const { data: departments = [] } = useDepartments();

  const [target, setTarget] = useState<Requirement | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [filters, setFilters] = useState({
    search: "",
    itemCode: "",
    offerDate: "",
    status: "all",
    vendor: "all",
    review: "all",
    department: "all",
  });

  const filtered = useMemo(
    () =>
      quotations.filter((q) => {
        const s = filters.search.toLowerCase();
        if (
          s &&
          !`${q.items?.item_name ?? ""} ${q.items?.item_code ?? ""} ${q.vendors?.vendor_name ?? ""} ${q.offer_number}`
            .toLowerCase()
            .includes(s)
        )
          return false;
        if (
          filters.itemCode &&
          !(q.items?.item_code ?? "").toLowerCase().includes(filters.itemCode.toLowerCase())
        )
          return false;
        if (filters.offerDate && q.offer_date !== filters.offerDate) return false;
        if (filters.status !== "all" && q.status !== filters.status) return false;
        if (filters.vendor !== "all" && q.vendor_id !== filters.vendor) return false;
        if (filters.department !== "all" && q.department_id !== filters.department) return false;
        if (filters.review === "required" && !q.review_flag) return false;
        if (filters.review === "not-required" && q.review_flag) return false;
        return true;
      }),
    [quotations, filters],
  );

  const myAssigned = requirements.filter(
    (r) => isVendor && r.vendor_id === vendorId && r.vendor_id !== null,
  );

  async function submitQuotation(e: React.FormEvent) {
    e.preventDefault();
    if (!target || !vendorId) return;
    const rate = Number(form.rate) || 0;
    const payload = {
      requirement_id: target.id,
      department_id: target.department_id,
      item_id: target.item_id,
      vendor_id: vendorId,
      offer_number: form.offer_number.trim(),
      offer_date: form.offer_date,
      quantity: target.quantity,
      rate,
      total: rate * Number(target.quantity),
      delivery_terms: form.delivery_terms || null,
      payment_terms: form.payment_terms || null,
      contact_person: form.contact_person || null,
      contact_number: form.contact_number || null,
      attachment_url: form.attachment_url || null,
      status: "Submitted",
    };
    const { data, error } = await supabase.from("quotations").insert(payload).select("id").single();
    if (error) {
      console.error("[QUOTATION] submit failed:", error.message);
      toast.error(
        error.code === "23505" ? "This offer number already exists for this requirement." : error.message,
      );
      return;
    }
    await supabase
      .from("purchase_requirements")
      .update({ status: "Quotation Received", updated_at: new Date().toISOString() })
      .eq("id", target.id);

    const { data: staff } = await supabase.from("user_roles").select("user_id, role");
    const staffIds = (staff ?? [])
      .filter((r) => r.role === "super_admin" || r.role === "purchase")
      .map((r) => r.user_id);
    await notify(
      staffIds,
      "New quotation submitted",
      `${target.items?.item_name ?? "Item"} quotation received.`,
      "/quotations",
    );
    await logAudit({ action: "Quotation Submitted", recordId: data.id, status: "Submitted" });
    toast.success("Quotation submitted");
    setTarget(null);
    setForm(EMPTY);
    void qc.invalidateQueries();
  }

  async function updateQuotation(id: string, patch: { status?: string; review_flag?: boolean }) {
    const { error } = await supabase
      .from("quotations")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[QUOTATION] update failed:", error.message);
      toast.error(error.message);
      return;
    }
    if (patch.status) {
      await logAudit({
        action: patch.status === "Approved" ? "Quotation Approved" : `Quotation ${patch.status}`,
        recordId: id,
        status: patch.status,
      });
    }
    void qc.invalidateQueries({ queryKey: ["quotations"] });
  }

  return (
    <>
      <PageHeader
        title="Vendor Quotations"
        subtitle={
          isVendor
            ? "Your assigned requirements and your own quotations only."
            : "All vendor quotations with combined filters."
        }
      />

      {isVendor && (
        <Card className="panel mb-6">
          <CardHeader>
            <CardTitle className="text-base">My assigned requirements</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Department</th>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Required</th>
                  <th className="print:hidden">Action</th>
                </tr>
              </thead>
              <tbody>
                {myAssigned.map((r) => (
                  <tr key={r.id} className="border-t border-border/60">
                    <td className="py-2 font-semibold text-primary">{r.departments?.code}</td>
                    <td>
                      {r.items?.item_code} — {r.items?.item_name}
                    </td>
                    <td>
                      {r.quantity} {r.unit}
                    </td>
                    <td className="text-xs text-muted-foreground">{r.required_date ?? "—"}</td>
                    <td className="print:hidden">
                      <Button
                        size="sm"
                        onClick={() => {
                          setTarget(r);
                          setForm(EMPTY);
                        }}
                      >
                        Submit quotation
                      </Button>
                    </td>
                  </tr>
                ))}
                {myAssigned.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted-foreground">
                      No requirements assigned to you yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card className="panel mb-4 print:hidden">
        <CardContent className="grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-6">
          <Input
            placeholder="Search item, code, vendor, offer no."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
          <Input
            placeholder="Item code"
            value={filters.itemCode}
            onChange={(e) => setFilters({ ...filters, itemCode: e.target.value })}
          />
          <Input
            type="date"
            value={filters.offerDate}
            onChange={(e) => setFilters({ ...filters, offerDate: e.target.value })}
          />
          <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              {QUOTE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.department}
            onValueChange={(v) => setFilters({ ...filters, department: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isStaff ? (
            <Select value={filters.vendor} onValueChange={(v) => setFilters({ ...filters, vendor: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All vendors</SelectItem>
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.vendor_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select value={filters.review} onValueChange={(v) => setFilters({ ...filters, review: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All reviews</SelectItem>
                <SelectItem value="required">Review required</SelectItem>
                <SelectItem value="not-required">No review required</SelectItem>
              </SelectContent>
            </Select>
          )}
          {isStaff && (
            <Select value={filters.review} onValueChange={(v) => setFilters({ ...filters, review: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All reviews</SelectItem>
                <SelectItem value="required">Review required</SelectItem>
                <SelectItem value="not-required">No review required</SelectItem>
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      <Card className="panel">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="p-3">Dept</th>
                <th>Item</th>
                <th>Vendor</th>
                <th>Offer</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Total</th>
                <th>Terms</th>
                <th>Status</th>
                <th className="p-3 print:hidden">Review</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => (
                <tr key={q.id} className="border-b border-border/60">
                  <td className="p-3 font-semibold text-primary">{q.departments?.code}</td>
                  <td>
                    <div>{q.items?.item_name}</div>
                    <div className="text-xs text-muted-foreground">{q.items?.item_code}</div>
                  </td>
                  <td>{q.vendors?.vendor_name}</td>
                  <td>
                    <div>{q.offer_number}</div>
                    <div className="text-xs text-muted-foreground">{q.offer_date}</div>
                  </td>
                  <td>{q.quantity}</td>
                  <td>{q.rate}</td>
                  <td className="font-semibold">{q.total}</td>
                  <td className="text-xs text-muted-foreground">
                    {q.delivery_terms ?? "—"} / {q.payment_terms ?? "—"}
                    <br />
                    {q.contact_person ?? ""} {q.contact_number ?? ""}
                  </td>
                  <td>
                    {isStaff ? (
                      <Select value={q.status} onValueChange={(v) => updateQuotation(q.id, { status: v })}>
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {QUOTE_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <StatusPill status={q.status} />
                    )}
                  </td>
                  <td className="p-3 print:hidden">
                    {isStaff ? (
                      <Button
                        size="sm"
                        variant={q.review_flag ? "default" : "outline"}
                        onClick={() => updateQuotation(q.id, { review_flag: !q.review_flag })}
                      >
                        {q.review_flag ? "Review required" : "No review"}
                      </Button>
                    ) : (
                      <StatusPill status={q.review_flag ? "Review required" : "No review"} />
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-muted-foreground">
                    No quotations match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Quotation — {target?.items?.item_code} ({target?.departments?.code})
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submitQuotation} className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["offer_number", "Offer Number", "text", true],
                ["offer_date", "Offer Date", "date", true],
                ["rate", "Rate", "number", true],
                ["delivery_terms", "Delivery Terms", "text", false],
                ["payment_terms", "Payment Terms", "text", false],
                ["contact_person", "Contact Person", "text", false],
                ["contact_number", "Contact Number", "text", false],
                ["attachment_url", "Attachment link", "url", false],
              ] as [keyof typeof EMPTY, string, string, boolean][]
            ).map(([key, label, type, req]) => (
              <div key={key} className="space-y-2">
                <Label>{label}</Label>
                <Input
                  type={type}
                  required={req}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
            <div className="sm:col-span-2 text-sm text-muted-foreground">
              Quantity {target?.quantity} {target?.unit} · Total{" "}
              <span className="font-semibold text-foreground">
                {(Number(form.rate) || 0) * Number(target?.quantity ?? 0)}
              </span>
            </div>
            <Button type="submit" className="sm:col-span-2" disabled={!user}>
              Submit quotation
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
