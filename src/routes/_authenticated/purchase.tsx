import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  REQ_STATUSES,
  useDepartments,
  useItems,
  useQuotations,
  useRequirements,
  useVendors,
} from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { logAudit, notify } from "@/lib/audit";
import { downloadTemplate, importRequirements, parseWorkbook } from "@/lib/upload";

export const Route = createFileRoute("/_authenticated/purchase")({
  head: () => ({
    meta: [
      { title: "Purchase | easybidding" },
      { name: "description", content: "Department-wise purchase requirements, Excel upload and vendor assignment." },
      { property: "og:title", content: "Purchase | easybidding" },
      { property: "og:description", content: "Upload material requirements and assign them to specific vendors." },
    ],
  }),
  component: PurchasePage,
});

function PurchasePage() {
  const { isStaff, user } = useAuth();
  const qc = useQueryClient();
  const { data: departments = [] } = useDepartments();
  const { data: items = [] } = useItems();
  const { data: vendors = [] } = useVendors();
  const { data: requirements = [] } = useRequirements();
  const { data: quotations = [] } = useQuotations();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const [filters, setFilters] = useState({
    department: "all",
    vendor: "all",
    item: "",
    status: "all",
    date: "",
    quotation: "all",
  });

  const [form, setForm] = useState({
    department_id: "",
    item_id: "",
    vendor_id: "",
    quantity: "1",
    unit: "NOS",
    required_date: "",
    remarks: "",
  });

  const filtered = useMemo(() => {
    return requirements.filter((r) => {
      if (filters.department !== "all" && r.department_id !== filters.department) return false;
      if (filters.vendor !== "all" && r.vendor_id !== filters.vendor) return false;
      if (
        filters.item &&
        !`${r.items?.item_code ?? ""} ${r.items?.item_name ?? ""}`
          .toLowerCase()
          .includes(filters.item.toLowerCase())
      )
        return false;
      if (filters.status !== "all" && r.status !== filters.status) return false;
      if (filters.date && (r.required_date ?? "") !== filters.date) return false;
      if (filters.quotation !== "all") {
        const has = quotations.some((q) => q.requirement_id === r.id);
        if (filters.quotation === "received" && !has) return false;
        if (filters.quotation === "awaited" && has) return false;
      }
      return true;
    });
  }, [requirements, quotations, filters]);

  if (!isStaff) return <p className="text-sm text-muted-foreground">Not authorized.</p>;

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const rows = await parseWorkbook(file);
      const res = await importRequirements(rows, user!.id);
      toast.success(`${res.inserted} requirement(s) imported, ${res.skipped} skipped.`);
      if (res.errors.length) {
        console.error("[PURCHASE] upload issues:", res.errors);
        toast.warning(res.errors.slice(0, 3).join(" | "));
      }
      void qc.invalidateQueries();
    } catch (err) {
      console.error("[PURCHASE] upload failed:", err);
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function addRequirement(e: React.FormEvent) {
    e.preventDefault();
    const vendorId = form.vendor_id || null;
    const payload = {
      department_id: form.department_id,
      item_id: form.item_id,
      vendor_id: vendorId,
      quantity: Number(form.quantity) || 1,
      unit: form.unit || "NOS",
      required_date: form.required_date || null,
      remarks: form.remarks || null,
      status: vendorId ? "Vendor Assigned" : "Pending",
      created_by: user!.id,
    };
    const { data, error } = await supabase
      .from("purchase_requirements")
      .insert(payload)
      .select("id")
      .single();
    if (error) {
      console.error("[PURCHASE] insert failed:", error.message);
      toast.error(
        error.code === "23505" ? "This requirement already exists." : error.message,
      );
      return;
    }
    const vendor = vendors.find((v) => v.id === vendorId);
    if (vendor?.user_id) {
      await notify(
        [vendor.user_id],
        "New material requirement",
        "You have received a new material requirement.",
        "/dashboard",
      );
    }
    await logAudit({
      action: vendorId ? "Vendor Assigned" : "Item Uploaded",
      recordId: data.id,
      status: payload.status,
    });
    toast.success("Requirement saved");
    setOpen(false);
    setForm({ ...form, item_id: "", quantity: "1", remarks: "" });
    void qc.invalidateQueries({ queryKey: ["requirements"] });
  }

  async function assignVendor(reqId: string, vendorId: string) {
    const { error } = await supabase
      .from("purchase_requirements")
      .update({
        vendor_id: vendorId === "none" ? null : vendorId,
        status: vendorId === "none" ? "Pending" : "Vendor Assigned",
        updated_at: new Date().toISOString(),
      })
      .eq("id", reqId);
    if (error) {
      console.error("[PURCHASE] assign failed:", error.message);
      toast.error(error.message);
      return;
    }
    const vendor = vendors.find((v) => v.id === vendorId);
    if (vendor?.user_id) {
      await notify(
        [vendor.user_id],
        "New material requirement",
        "You have received a new material requirement.",
        "/dashboard",
      );
    }
    await logAudit({ action: "Vendor Assigned", recordId: reqId, status: "Vendor Assigned" });
    toast.success("Vendor assigned");
    void qc.invalidateQueries({ queryKey: ["requirements"] });
  }

  async function changeStatus(reqId: string, status: string) {
    const { error } = await supabase
      .from("purchase_requirements")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", reqId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit({ action: "Status Changed", recordId: reqId, status });
    void qc.invalidateQueries({ queryKey: ["requirements"] });
  }

  return (
    <>
      <PageHeader
        title="Purchase Requirements"
        subtitle="Organised by department. Every item is assigned to one specific vendor."
        actions={
          <>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4" /> Excel template
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> {busy ? "Uploading…" : "Upload Excel"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>Add requirement</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New requirement</DialogTitle>
                </DialogHeader>
                <form onSubmit={addRequirement} className="space-y-3">
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select
                      value={form.department_id}
                      onValueChange={(v) => setForm({ ...form, department_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Item</Label>
                    <Select
                      value={form.item_id}
                      onValueChange={(v) => {
                        const it = items.find((i) => i.id === v);
                        setForm({ ...form, item_id: v, unit: it?.unit ?? "NOS" });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select item" />
                      </SelectTrigger>
                      <SelectContent>
                        {items.map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.item_code} — {i.item_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Vendor</Label>
                    <Select
                      value={form.vendor_id}
                      onValueChange={(v) => setForm({ ...form, vendor_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select vendor" />
                      </SelectTrigger>
                      <SelectContent>
                        {vendors.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.vendor_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        min="1"
                        value={form.quantity}
                        onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Unit</Label>
                      <Input
                        value={form.unit}
                        onChange={(e) => setForm({ ...form, unit: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Required date</Label>
                    <Input
                      type="date"
                      value={form.required_date}
                      onChange={(e) => setForm({ ...form, required_date: e.target.value })}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={!form.department_id || !form.item_id}
                  >
                    Save requirement
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <Card className="panel mb-4 print:hidden">
        <CardContent className="grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-6">
          <Select
            value={filters.department}
            onValueChange={(v) => setFilters({ ...filters, department: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.vendor} onValueChange={(v) => setFilters({ ...filters, vendor: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vendors</SelectItem>
              {vendors.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.vendor_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Item code / name"
            value={filters.item}
            onChange={(e) => setFilters({ ...filters, item: e.target.value })}
          />
          <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {REQ_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={filters.date}
            onChange={(e) => setFilters({ ...filters, date: e.target.value })}
          />
          <Select
            value={filters.quotation}
            onValueChange={(v) => setFilters({ ...filters, quotation: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any quotation status</SelectItem>
              <SelectItem value="received">Quotation received</SelectItem>
              <SelectItem value="awaited">Quotation awaited</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="panel">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="p-3">Department</th>
                <th>Item</th>
                <th>Qty</th>
                <th>Required</th>
                <th>Vendor</th>
                <th>Status</th>
                <th>Quotations</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="p-3 font-semibold text-primary">{r.departments?.code}</td>
                  <td>
                    <div className="font-medium">{r.items?.item_name}</div>
                    <div className="text-xs text-muted-foreground">{r.items?.item_code}</div>
                  </td>
                  <td>
                    {r.quantity} {r.unit}
                  </td>
                  <td className="text-xs text-muted-foreground">{r.required_date ?? "—"}</td>
                  <td>
                    <Select
                      value={r.vendor_id ?? "none"}
                      onValueChange={(v) => assignVendor(r.id, v)}
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {vendors.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.vendor_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td>
                    <Select value={r.status} onValueChange={(v) => changeStatus(r.id, v)}>
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
                  <td>
                    <StatusPill
                      status={
                        quotations.some((q) => q.requirement_id === r.id) ? "Received" : "Awaited"
                      }
                    />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    No requirements match these filters.
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
