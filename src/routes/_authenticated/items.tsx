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
import { ExcelUpload } from "@/components/ExcelUpload";
import { downloadItemTemplate, importItems } from "@/lib/upload";
import { useItems, type Item } from "@/lib/queries";
import { logAudit } from "@/lib/audit";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/items")({
  head: () => ({
    meta: [
      { title: "Item Master | easybidding" },
      { name: "description", content: "Item master with codes, specifications, units and categories." },
      { property: "og:title", content: "Item Master | easybidding" },
      { property: "og:description", content: "Single source of truth for procurement items." },
    ],
  }),
  component: ItemsPage,
});

const EMPTY = {
  item_code: "",
  item_name: "",
  description: "",
  specification: "",
  unit: "NOS",
  category: "",
};

function ItemsPage() {
  const { isStaff } = useAuth();
  const { data = [] } = useItems();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Item | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [search, setSearch] = useState("");

  if (!isStaff) return <p className="text-sm text-muted-foreground">Not authorized.</p>;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      item_code: form.item_code.trim().toUpperCase(),
      item_name: form.item_name.trim(),
      description: form.description.trim() || null,
      specification: form.specification.trim() || null,
      unit: form.unit.trim() || "NOS",
      category: form.category.trim() || null,
    };
    const res = edit
      ? await supabase.from("items").update(payload).eq("id", edit.id)
      : await supabase.from("items").insert(payload);
    if (res.error) {
      console.error("[ITEM] save failed:", res.error.message);
      toast.error(res.error.message);
      return;
    }
    await logAudit({ action: "Item Uploaded", status: "Saved", details: payload.item_code });
    toast.success("Item saved");
    setOpen(false);
    setEdit(null);
    setForm(EMPTY);
    void qc.invalidateQueries({ queryKey: ["items"] });
  }

  const filtered = data.filter((i) =>
    `${i.item_code} ${i.item_name} ${i.category ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <PageHeader
        title="Item Master"
        subtitle="Items are linked everywhere by ID, never by name alone."
        actions={
          <div className="flex flex-wrap items-center gap-2">
          <ExcelUpload
            label="Upload items"
            onTemplate={downloadItemTemplate}
            onImport={importItems}
            onDone={() => void qc.invalidateQueries({ queryKey: ["items"] })}
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
              <Button>Add item</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{edit ? "Edit item" : "New item"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["item_code", "Item Code", true],
                    ["item_name", "Item Name", true],
                    ["description", "Description", false],
                    ["specification", "Specification", false],
                    ["unit", "Unit", false],
                    ["category", "Category", false],
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

      <Input
        placeholder="Search item code, name or category"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 max-w-sm"
      />

      <Card className="panel">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="p-3">Item Code</th>
                <th>Item Name</th>
                <th>Specification</th>
                <th>Unit</th>
                <th>Category</th>
                <th>Status</th>
                <th className="p-3 print:hidden">Manage</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id} className="border-b border-border/60">
                  <td className="p-3 font-semibold text-primary">{i.item_code}</td>
                  <td>{i.item_name}</td>
                  <td className="text-muted-foreground">{i.specification ?? "—"}</td>
                  <td>{i.unit}</td>
                  <td>{i.category ?? "—"}</td>
                  <td>
                    <StatusPill status={i.status} />
                  </td>
                  <td className="p-3 print:hidden">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEdit(i);
                        setForm({
                          item_code: i.item_code,
                          item_name: i.item_name,
                          description: i.description ?? "",
                          specification: i.specification ?? "",
                          unit: i.unit,
                          category: i.category ?? "",
                        });
                        setOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    No items found.
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
