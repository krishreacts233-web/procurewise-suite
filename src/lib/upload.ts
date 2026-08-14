import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { logAudit, notify } from "@/lib/audit";

export interface UploadRow {
  Department?: string;
  "Item Code"?: string;
  "Item Name"?: string;
  Description?: string;
  Specification?: string;
  Quantity?: number | string;
  Unit?: string;
  "Required Date"?: string;
  Vendor?: string;
}

export interface UploadResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

function pick(row: Record<string, unknown>, keys: string[]): string {
  for (const k of Object.keys(row)) {
    if (keys.some((n) => n.toLowerCase() === k.trim().toLowerCase())) {
      const v = row[k];
      if (v !== undefined && v !== null) return String(v).trim();
    }
  }
  return "";
}

export async function parseWorkbook(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

export function downloadTemplate() {
  const rows = [
    {
      Department: "SPARES",
      "Item Code": "SP-001",
      "Item Name": "Bearing 6205",
      Description: "Deep groove ball bearing",
      Specification: "6205 ZZ",
      Quantity: 500,
      Unit: "NOS",
      "Required Date": "2026-09-30",
      Vendor: "ABC Bearings",
    },
    {
      Department: "IT",
      "Item Code": "IT-001",
      "Item Name": "Keyboard",
      Description: "USB keyboard",
      Specification: "104 keys",
      Quantity: 20,
      Unit: "NOS",
      "Required Date": "2026-09-15",
      Vendor: "ABC Technologies",
    },
  ];
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Requirements");
  XLSX.writeFile(wb, "easybidding-material-upload-template.xlsx");
}

export async function importRequirements(
  rows: Record<string, unknown>[],
  createdBy: string,
): Promise<UploadResult> {
  const result: UploadResult = { inserted: 0, skipped: 0, errors: [] };

  const [{ data: depts }, { data: items }, { data: vendors }] = await Promise.all([
    supabase.from("departments").select("id, code, name"),
    supabase.from("items").select("id, item_code, item_name, unit"),
    supabase.from("vendors").select("id, vendor_code, vendor_name, user_id"),
  ]);

  const deptMap = new Map((depts ?? []).map((d) => [d.code.toUpperCase(), d]));
  const itemMap = new Map((items ?? []).map((i) => [i.item_code.toUpperCase(), i]));
  type VendorRow = { id: string; vendor_code: string; vendor_name: string; user_id: string | null };
  const vendorMap = new Map<string, VendorRow>();
  for (const v of vendors ?? []) {
    vendorMap.set(v.vendor_name.toUpperCase(), v);
    vendorMap.set(v.vendor_code.toUpperCase(), v);
  }

  const notifyVendors = new Map<string, string>();

  for (const [index, raw] of rows.entries()) {
    const line = index + 2;
    const deptCode = pick(raw, ["Department", "Dept"]).toUpperCase();
    const itemCode = pick(raw, ["Item Code", "ItemCode", "Code"]).toUpperCase();
    const itemName = pick(raw, ["Item Name", "ItemName", "Item"]);
    const vendorName = pick(raw, ["Vendor", "Vendor Name"]);
    const qtyRaw = pick(raw, ["Quantity", "Qty"]);
    const unit = pick(raw, ["Unit", "UOM"]) || "NOS";
    const requiredDate = pick(raw, ["Required Date", "RequiredDate"]);
    const description = pick(raw, ["Description"]);
    const specification = pick(raw, ["Specification", "Spec"]);

    if (!deptCode && !itemCode && !itemName) {
      result.skipped++;
      continue;
    }

    let dept = deptMap.get(deptCode);
    if (!dept) {
      if (!deptCode) {
        result.errors.push(`Row ${line}: missing department`);
        result.skipped++;
        continue;
      }
      const { data, error } = await supabase
        .from("departments")
        .insert({ code: deptCode, name: deptCode })
        .select("id, code, name")
        .single();
      if (error || !data) {
        console.error("[DEPARTMENT] auto-create failed:", error?.message);
        result.errors.push(`Row ${line}: department ${deptCode} — ${error?.message}`);
        result.skipped++;
        continue;
      }
      dept = data;
      deptMap.set(deptCode, dept);
    }

    const codeKey = itemCode || itemName.toUpperCase();
    let item = itemMap.get(codeKey);
    if (!item) {
      const { data, error } = await supabase
        .from("items")
        .insert({
          item_code: codeKey,
          item_name: itemName || codeKey,
          description: description || null,
          specification: specification || null,
          unit,
        })
        .select("id, item_code, item_name, unit")
        .single();
      if (error || !data) {
        console.error("[ITEM] auto-create failed:", error?.message);
        result.errors.push(`Row ${line}: item ${codeKey} — ${error?.message}`);
        result.skipped++;
        continue;
      }
      item = data;
      itemMap.set(codeKey, item);
    }

    const vendor = vendorName ? vendorMap.get(vendorName.toUpperCase()) : undefined;
    if (vendorName && !vendor) {
      result.errors.push(`Row ${line}: vendor "${vendorName}" not found in Vendor Master`);
      result.skipped++;
      continue;
    }

    const quantity = Number(qtyRaw) || 1;
    const payload = {
      department_id: dept.id,
      item_id: item.id,
      vendor_id: vendor?.id ?? null,
      quantity,
      unit,
      required_date: requiredDate ? new Date(requiredDate).toISOString().slice(0, 10) : null,
      status: vendor ? "Vendor Assigned" : "Pending",
      created_by: createdBy,
    };

    const { error } = await supabase.from("purchase_requirements").insert(payload);
    if (error) {
      if (error.code === "23505") {
        result.skipped++;
        result.errors.push(`Row ${line}: duplicate requirement skipped`);
        continue;
      }
      console.error("[PURCHASE] insert failed:", error.message);
      result.errors.push(`Row ${line}: ${error.message}`);
      result.skipped++;
      continue;
    }
    result.inserted++;
    if (vendor?.user_id) notifyVendors.set(vendor.user_id, vendor.vendor_name);
  }

  if (notifyVendors.size > 0) {
    await notify(
      [...notifyVendors.keys()],
      "New material requirement",
      "You have received a new material requirement.",
      "/dashboard",
    );
  }
  await logAudit({
    action: "Item Uploaded",
    status: "Completed",
    details: `${result.inserted} requirement(s) imported, ${result.skipped} skipped`,
  });

  return result;
}
