import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { supabase } from "@/integrations/supabase/client";
import { useDepartments, type Department } from "@/lib/queries";
import { logAudit } from "@/lib/audit";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/departments")({
  head: () => ({
    meta: [
      { title: "Departments | easybidding" },
      { name: "description", content: "Create and manage procurement departments used across the portal." },
      { property: "og:title", content: "Departments | easybidding" },
      { property: "og:description", content: "Department master for department-wise procurement." },
    ],
  }),
  component: DepartmentsPage,
});

function DepartmentsPage() {
  const { isStaff } = useAuth();
  const { data = [] } = useDepartments();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Department | null>(null);
  const [form, setForm] = useState({ code: "", name: "", description: "" });

  if (!isStaff) return <p className="text-sm text-muted-foreground">Not authorized.</p>;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      description: form.description.trim() || null,
    };
    const res = edit
      ? await supabase.from("departments").update(payload).eq("id", edit.id)
      : await supabase.from("departments").insert(payload);
    if (res.error) {
      console.error("[DEPARTMENT] save failed:", res.error.message);
      toast.error(res.error.message);
      return;
    }
    await logAudit({ action: edit ? "Status Changed" : "Department Created", status: "Saved", details: payload.code });
    toast.success("Department saved");
    setOpen(false);
    setEdit(null);
    setForm({ code: "", name: "", description: "" });
    void qc.invalidateQueries({ queryKey: ["departments"] });
  }

  async function toggle(d: Department) {
    const { error } = await supabase
      .from("departments")
      .update({ is_active: !d.is_active })
      .eq("id", d.id);
    if (error) {
      console.error("[DEPARTMENT]", error.message);
      toast.error(error.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["departments"] });
  }

  return (
    <>
      <PageHeader
        title="Departments"
        subtitle="Department master — add as many departments as you need."
        actions={
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) {
                setEdit(null);
                setForm({ code: "", name: "", description: "" });
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>Add department</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{edit ? "Edit department" : "New department"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={save} className="space-y-4">
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input
                    required
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                <Button type="submit" className="w-full">
                  Save
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="panel">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="p-3">Code</th>
                <th>Name</th>
                <th>Description</th>
                <th>Status</th>
                <th className="p-3 print:hidden">Manage</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.id} className="border-b border-border/60">
                  <td className="p-3 font-semibold text-primary">{d.code}</td>
                  <td>{d.name}</td>
                  <td className="text-muted-foreground">{d.description ?? "—"}</td>
                  <td>
                    <StatusPill status={d.is_active ? "Active" : "Disabled"} />
                  </td>
                  <td className="space-x-2 p-3 print:hidden">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEdit(d);
                        setForm({
                          code: d.code,
                          name: d.name,
                          description: d.description ?? "",
                        });
                        setOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => toggle(d)}>
                      {d.is_active ? "Disable" : "Enable"}
                    </Button>
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
