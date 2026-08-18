import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, Upload, Trash2, Mail, MessageSquare, Phone, RefreshCw } from "lucide-react";
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
  useNotificationLog,
  useQuotations,
  useRequirements,
  useVendors,
  type Requirement,
} from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { logAudit, notify } from "@/lib/audit";
import { downloadTemplate, importRequirements, parseWorkbook } from "@/lib/upload";
import { sendRequirementAlerts, type AlertChannel } from "@/lib/notify.functions";

export const Route = createFileRoute("/_authenticated/purchase")({
  head: () => ({
    meta: [
      { title: "Enquiries | easybidding" },
      { name: "description", content: "Department-wise purchase enquiries, Excel upload and vendor assignment." },
      { property: "og:title", content: "Enquiries | easybidding" },
      { property: "og:description", content: "Upload material enquiries and assign them to specific vendors." },
    ],
  }),
  component: PurchasePage,
});

interface Enquiry {
  key: string;
  ref: string;
  createdAt: string;
  departmentCode: string;
  departmentId: string;
  lines: Requirement[];
}

function groupEnquiries(rows: Requirement[]): Enquiry[] {
  const map = new Map<string, Enquiry>();
  for (const r of rows) {
    const key = `${r.department_id}|${r.created_at}`;
    const existing = map.get(key);
    if (existing) {
      existing.lines.push(r);
    } else {
      map.set(key, {
        key,
        ref: r.requirement_no,
        createdAt: r.created_at,
        departmentCode: r.departments?.code ?? "—",
        departmentId: r.department_id,
        lines: [r],
      });
    }
  }
  return [...map.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function PurchasePage() {
  const { isStaff, isSuperAdmin, user } = useAuth();
  const qc = useQueryClient();
  const { data: departments = [] } = useDepartments();
  const { data: items = [] } = useItems();
  const { data: vendors = [] } = useVendors();
  const { data: requirements = [] } = useRequirements();
  const { data: quotations = [] } = useQuotations();
  const sendAlerts = useServerFn(sendRequirementAlerts);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [openEnquiry, setOpenEnquiry] = useState<string | null>(null);

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

  const enquiries = useMemo(() => groupEnquiries(filtered), [filtered]);
  const active = enquiries.find((e) => e.key === openEnquiry) ?? null;

  if (!isStaff) return <p className="text-sm text-muted-foreground">Not authorized.</p>;

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const rows = await parseWorkbook(file);
      const res = await importRequirements(rows, user!.id);
      toast.success(`${res.inserted} line item(s) imported, ${res.skipped} skipped.`);
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

  async function alertVendor(reqId: string, channels?: AlertChannel[]) {
    try {
      const res = await sendAlerts({ data: { requirementId: reqId, ...(channels ? { channels } : {}) } });
      if (!res.ok && res.error) {
        toast.error(res.error);
      } else {
        const failed = res.results.filter((r) => r.status === "Failed");
        if (failed.length === 0) toast.success("Vendor alerted by email, WhatsApp and SMS");
        else
          toast.warning(
            failed.map((f) => `${f.channel}: ${f.response.slice(0, 80)}`).join(" | "),
            { duration: 8000 },
          );
      }
    } catch (err) {
      console.error("[NOTIFY]", err);
      toast.error("Could not send vendor alerts");
    } finally {
      void qc.invalidateQueries({ queryKey: ["requirements"] });
      void qc.invalidateQueries({ queryKey: ["notification-log"] });
    }
  }

  async function addRequirement(e: React.FormEvent) {
    e.preventDefault();
    const vendorId = isSuperAdmin ? form.vendor_id || null : null;
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
      toast.error(error.code === "23505" ? "This enquiry line already exists." : error.message);
      return;
    }
    const vendor = vendors.find((v) => v.id === vendorId);
    if (vendor?.user_id) {
      await notify([vendor.user_id], "New material enquiry", "You have received a new enquiry.", "/dashboard");
    }
    await logAudit({
      action: vendorId ? "Vendor Assigned" : "Item Uploaded",
      recordId: data.id,
      status: payload.status,
    });
    toast.success("Enquiry saved");
    setOpen(false);
    setForm({ ...form, item_id: "", quantity: "1", remarks: "" });
    void qc.invalidateQueries({ queryKey: ["requirements"] });
    if (vendorId) await alertVendor(data.id);
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
    void qc.invalidateQueries({ queryKey: ["requirements"] });
    if (vendorId === "none") return;
    const vendor = vendors.find((v) => v.id === vendorId);
    if (vendor?.user_id) {
      await notify([vendor.user_id], "New material enquiry", "You have received a new enquiry.", "/dashboard");
    }
    await logAudit({ action: "Vendor Assigned", recordId: reqId, status: "Vendor Assigned" });
    await alertVendor(reqId);
  }

  async function assignEnquiry(enquiry: Enquiry, vendorId: string) {
    for (const line of enquiry.lines) {
      await assignVendor(line.id, vendorId);
    }
  }

  async function deleteEnquiry(enquiry: Enquiry) {
    if (!confirm(`Delete enquiry ${enquiry.ref} and its ${enquiry.lines.length} line item(s)?`)) return;
    const ids = enquiry.lines.map((l) => l.id);
    const { error } = await supabase.from("purchase_requirements").delete().in("id", ids);
    if (error) {
      console.error("[PURCHASE] delete failed:", error.message);
      toast.error(error.message);
      return;
    }
    await logAudit({ action: "Enquiry Deleted", recordId: enquiry.ref, status: "Deleted" });
    toast.success("Enquiry deleted");
    setOpenEnquiry(null);
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
        title="Enquiries"
        subtitle="Each upload appears as one enquiry line. Open an enquiry to see all its item details."
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
                <Button>Add enquiry</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New enquiry</DialogTitle>
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
                  {isSuperAdmin && (
                    <div className="space-y-2">
                      <Label>Vendor (Super Admin only)</Label>
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
                  )}
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
                    Save enquiry
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
                <th className="p-3">Enquiry</th>
                <th>Date</th>
                <th>Department</th>
                <th>Line items</th>
                {isSuperAdmin && <th>Vendor</th>}
                <th>Status</th>
                <th className="p-3 print:hidden">Actions</th>
              </tr>
            </thead>
            <tbody>
              {enquiries.map((e) => {
                const vendorNames = [
                  ...new Set(e.lines.map((l) => l.vendors?.vendor_name).filter(Boolean)),
                ] as string[];
                const statuses = [...new Set(e.lines.map((l) => l.status))];
                return (
                  <tr
                    key={e.key}
                    className="cursor-pointer border-b border-border/60 hover:bg-muted/60"
                    onClick={() => setOpenEnquiry(e.key)}
                  >
                    <td className="p-3 font-semibold text-primary">{e.ref}</td>
                    <td className="text-xs text-muted-foreground">
                      {new Date(e.createdAt).toLocaleString()}
                    </td>
                    <td>{e.departmentCode}</td>
                    <td>{e.lines.length}</td>
                    {isSuperAdmin && (
                      <td className="text-muted-foreground">
                        {vendorNames.length ? vendorNames.join(", ") : "Unassigned"}
                      </td>
                    )}
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {statuses.map((s) => (
                          <StatusPill key={s} status={s} />
                        ))}
                      </div>
                    </td>
                    <td className="space-x-2 p-3 print:hidden" onClick={(ev) => ev.stopPropagation()}>
                      <Button size="sm" variant="outline" onClick={() => setOpenEnquiry(e.key)}>
                        Open
                      </Button>
                      {isSuperAdmin && (
                        <Button size="sm" variant="destructive" onClick={() => deleteEnquiry(e)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {enquiries.length === 0 && (
                <tr>
                  <td colSpan={isSuperAdmin ? 7 : 6} className="p-6 text-center text-muted-foreground">
                    No enquiries match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!active} onOpenChange={(o) => !o && setOpenEnquiry(null)}>
        <DialogContent className="max-h-[88vh] max-w-5xl overflow-y-auto">
          {active && (
            <EnquiryDetail
              enquiry={active}
              isSuperAdmin={isSuperAdmin}
              vendors={vendors}
              quotations={quotations}
              onAssignLine={assignVendor}
              onAssignAll={(vendorId) => assignEnquiry(active, vendorId)}
              onStatus={changeStatus}
              onRetry={(id, channel) => alertVendor(id, [channel])}
              onDelete={() => deleteEnquiry(active)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function EnquiryDetail({
  enquiry,
  isSuperAdmin,
  vendors,
  quotations,
  onAssignLine,
  onAssignAll,
  onStatus,
  onRetry,
  onDelete,
}: {
  enquiry: Enquiry;
  isSuperAdmin: boolean;
  vendors: { id: string; vendor_name: string }[];
  quotations: { requirement_id: string }[];
  onAssignLine: (reqId: string, vendorId: string) => Promise<void>;
  onAssignAll: (vendorId: string) => Promise<void>;
  onStatus: (reqId: string, status: string) => Promise<void>;
  onRetry: (reqId: string, channel: AlertChannel) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const ids = enquiry.lines.map((l) => l.id);
  const { data: logs = [] } = useNotificationLog(ids);

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          Enquiry {enquiry.ref} · {enquiry.departmentCode}
        </DialogTitle>
      </DialogHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Raised {new Date(enquiry.createdAt).toLocaleString()} · {enquiry.lines.length} line item(s)
        </p>
        {isSuperAdmin && (
          <div className="flex items-center gap-2">
            <Select onValueChange={(v) => void onAssignAll(v)}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Assign whole enquiry to vendor" />
              </SelectTrigger>
              <SelectContent>
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.vendor_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="destructive" onClick={() => void onDelete()}>
              <Trash2 className="h-4 w-4" /> Delete enquiry
            </Button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr className="border-b border-border">
              <th className="p-3">Item</th>
              <th>Qty</th>
              <th>Required</th>
              {isSuperAdmin && <th>Vendor</th>}
              <th>Status</th>
              <th>Alerts</th>
              <th>Quotation</th>
            </tr>
          </thead>
          <tbody>
            {enquiry.lines.map((l) => (
              <tr key={l.id} className="border-b border-border/60 align-top">
                <td className="p-3">
                  <div className="font-medium">{l.items?.item_name}</div>
                  <div className="text-xs text-muted-foreground">{l.items?.item_code}</div>
                  {l.items?.specification && (
                    <div className="text-xs text-muted-foreground">{l.items.specification}</div>
                  )}
                  {l.remarks && <div className="text-xs text-muted-foreground">Remarks: {l.remarks}</div>}
                </td>
                <td>
                  {l.quantity} {l.unit}
                </td>
                <td className="text-xs text-muted-foreground">{l.required_date ?? "—"}</td>
                {isSuperAdmin && (
                  <td>
                    <Select value={l.vendor_id ?? "none"} onValueChange={(v) => void onAssignLine(l.id, v)}>
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
                )}
                <td>
                  <Select value={l.status} onValueChange={(v) => void onStatus(l.id, v)}>
                    <SelectTrigger className="w-44">
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
                <td className="space-y-1 py-2">
                  <ChannelRow
                    icon={<Mail className="h-3.5 w-3.5" />}
                    label="Email"
                    status={l.email_status}
                    canRetry={isSuperAdmin && !!l.vendor_id}
                    onRetry={() => void onRetry(l.id, "email")}
                  />
                  <ChannelRow
                    icon={<MessageSquare className="h-3.5 w-3.5" />}
                    label="WhatsApp"
                    status={l.whatsapp_status}
                    canRetry={isSuperAdmin && !!l.vendor_id}
                    onRetry={() => void onRetry(l.id, "whatsapp")}
                  />
                  <ChannelRow
                    icon={<Phone className="h-3.5 w-3.5" />}
                    label="SMS"
                    status={l.sms_status}
                    canRetry={isSuperAdmin && !!l.vendor_id}
                    onRetry={() => void onRetry(l.id, "sms")}
                  />
                </td>
                <td>
                  <StatusPill
                    status={quotations.some((q) => q.requirement_id === l.id) ? "Received" : "Awaited"}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <h3 className="mb-2 text-sm font-semibold">Notification history</h3>
        <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <tbody>
              {logs.map((n) => (
                <tr key={n.id} className="border-b border-border/60">
                  <td className="p-2 whitespace-nowrap">{new Date(n.created_at).toLocaleString()}</td>
                  <td className="p-2 capitalize">{n.channel}</td>
                  <td className="p-2">{n.recipient || "—"}</td>
                  <td className="p-2">
                    <StatusPill status={n.status} />
                  </td>
                  <td className="p-2 text-muted-foreground">{n.provider_response?.slice(0, 120)}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td className="p-3 text-center text-muted-foreground">No alerts sent yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function ChannelRow({
  icon,
  label,
  status,
  canRetry,
  onRetry,
}: {
  icon: React.ReactNode;
  label: string;
  status: string;
  canRetry: boolean;
  onRetry: () => void;
}) {
  const failed = status.startsWith("Failed");
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">{icon}</span>
      <span className="w-16">{label}</span>
      <span className={failed ? "text-destructive" : status === "Sent" ? "text-success" : "text-muted-foreground"}>
        {status}
      </span>
      {canRetry && failed && (
        <Button size="sm" variant="ghost" className="h-6 px-1" onClick={onRetry}>
          <RefreshCw className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
