import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { ExcelUpload } from "@/components/ExcelUpload";
import { downloadVendorTemplate, importVendors } from "@/lib/upload";
import { useVendors, type Vendor } from "@/lib/queries";
import { logAudit } from "@/lib/audit";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/vendors")({
  head: () => ({
    meta: [
      { title: "Vendor Master | easybidding" },
      { name: "description", content: "Vendor master with contacts, GST, PAN, scope of supply and login linking." },
      { property: "og:title", content: "Vendor Master | easybidding" },
      { property: "og:description", content: "Manage vendors and link their portal login accounts." },
    ],
  }),
  component: VendorsPage,
});

const EMPTY = {
  vendor_code: "",
  vendor_name: "",
  contact_person: "",
  mobile: "",
  email: "",
  address: "",
  gst: "",
  pan: "",
  scope_of_supply: "",
  designation: "",
  sales_manager: "",
};

function VendorsPage() {
  const { isStaff, isSuperAdmin } = useAuth();
  const { data = [] } = useVendors();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Vendor | null>(null);
  const [form, setForm] = useState(EMPTY);

  const { data: linkable = [] } = useQuery({
    queryKey: ["linkable-users"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, display_name, email");
      if (error) throw error;
      return data;
    },
  });

  if (!isStaff) return <p className="text-sm text-muted-foreground">Not authorized.</p>;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      vendor_code: form.vendor_code.trim().toUpperCase(),
      vendor_name: form.vendor_name.trim(),
    };
    const res = edit
      ? await supabase.from("vendors").update(payload).eq("id", edit.id)
      : await supabase.from("vendors").insert(payload);
    if (res.error) {
      console.error("[VENDOR] save failed:", res.error.message);
      toast.error(res.error.message);
      return;
    }
    await logAudit({ action: "Vendor Created", status: "Saved", details: payload.vendor_code });
    toast.success("Vendor saved");
    setOpen(false);
    setEdit(null);
    setForm(EMPTY);
    void qc.invalidateQueries({ queryKey: ["vendors"] });
  }

  async function linkUser(vendor: Vendor, userId: string) {
    const { error } = await supabase
      .from("vendors")
      .update({ user_id: userId === "none" ? null : userId })
      .eq("id", vendor.id);
    if (error) {
      console.error("[VENDOR] link failed:", error.message);
      toast.error(error.message);
      return;
    }
    if (userId !== "none") {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      await supabase.from("user_roles").insert({ user_id: userId, role: "vendor" });
    }
    toast.success("Vendor login linked");
    void qc.invalidateQueries({ queryKey: ["vendors"] });
  }

  async function toggleStatus(v: Vendor) {
    const { error } = await supabase
      .from("vendors")
      .update({ status: v.status === "Active" ? "Inactive" : "Active" })
      .eq("id", v.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["vendors"] });
  }

  return (
    <>
      <PageHeader
        title="Vendor Master"
        subtitle="Vendors are linked to requirements and quotations by vendor ID."
        actions={
          <div className="flex flex-wrap items-center gap-2">
          <ExcelUpload
            label="Upload vendors"
            onTemplate={downloadVendorTemplate}
            onImport={importVendors}
            onDone={() => void qc.invalidateQueries({ queryKey: ["vendors"] })}
          />
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) {
                setEdit(null);
                setForm(EMPTY);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>Add vendor</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{edit ? "Edit vendor" : "New vendor"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["vendor_code", "Vendor ID / Code", true],
                    ["vendor_name", "Vendor Name", true],
                    ["contact_person", "Contact Person", false],
                    ["mobile", "Mobile", false],
                    ["email", "Email", false],
                    ["address", "Address", false],
                    ["gst", "GST", false],
                    ["pan", "PAN", false],
                    ["scope_of_supply", "Scope of Supply", false],
                    ["designation", "Designation", false],
                    ["sales_manager", "Sales Manager", false],
                  ] as [keyof typeof EMPTY, string, boolean][]
                ).map(([key, label, req]) => (
                  <div key={key} className="space-y-2">
                    <Label>{label}</Label>
                    <Input
                      required={req}
                      value={form[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    />
                  </div>
                ))}
                <Button type="submit" className="sm:col-span-2">
                  Save
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        }
      />

      <Card className="panel">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="p-3">Vendor ID</th>
                <th>Vendor Name</th>
                <th>Contact</th>
                <th>GST / PAN</th>
                <th>Scope</th>
                <th>Status</th>
                {isSuperAdmin && <th>Login account</th>}
                <th className="p-3 print:hidden">Manage</th>
              </tr>
            </thead>
            <tbody>
              {data.map((v) => (
                <tr key={v.id} className="border-b border-border/60">
                  <td className="p-3 font-semibold text-primary">{v.vendor_code}</td>
                  <td>{v.vendor_name}</td>
                  <td className="text-muted-foreground">
                    {v.contact_person ?? "—"}
                    <br />
                    <span className="text-xs">
                      {v.mobile ?? ""} {v.email ?? ""}
                    </span>
                  </td>
                  <td className="text-xs text-muted-foreground">
                    {v.gst ?? "—"} / {v.pan ?? "—"}
                  </td>
                  <td className="text-muted-foreground">{v.scope_of_supply ?? "—"}</td>
                  <td>
                    <StatusPill status={v.status} />
                  </td>
                  {isSuperAdmin && (
                    <td className="print:hidden">
                      <Select
                        value={v.user_id ?? "none"}
                        onValueChange={(uid) => linkUser(v, uid)}
                      >
                        <SelectTrigger className="w-44">
                          <SelectValue placeholder="Link login" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Not linked</SelectItem>
                          {linkable.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.display_name || p.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  )}
                  <td className="space-x-2 p-3 print:hidden">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEdit(v);
                        setForm({
                          vendor_code: v.vendor_code,
                          vendor_name: v.vendor_name,
                          contact_person: v.contact_person ?? "",
                          mobile: v.mobile ?? "",
                          email: v.email ?? "",
                          address: v.address ?? "",
                          gst: v.gst ?? "",
                          pan: v.pan ?? "",
                          scope_of_supply: v.scope_of_supply ?? "",
                          designation: v.designation ?? "",
                          sales_manager: v.sales_manager ?? "",
                        });
                        setOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => toggleStatus(v)}>
                      {v.status === "Active" ? "Disable" : "Enable"}
                    </Button>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-muted-foreground">
                    No vendors yet.
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
