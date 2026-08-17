import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { parseWorkbook, type UploadResult } from "@/lib/upload";

interface ExcelUploadProps {
  label?: string;
  onTemplate: () => void;
  onImport: (rows: Record<string, unknown>[]) => Promise<UploadResult>;
  onDone?: () => void;
}

export function ExcelUpload({ label = "Upload Excel", onTemplate, onImport, onDone }: ExcelUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const rows = await parseWorkbook(file);
      if (rows.length === 0) {
        toast.error("No rows found in the file");
        return;
      }
      const res = await onImport(rows);
      toast.success(`${res.inserted} row(s) imported, ${res.skipped} skipped`);
      if (res.errors.length > 0) toast.error(res.errors.slice(0, 3).join(" | "));
      onDone?.();
    } catch (err) {
      console.error("[UPLOAD]", err);
      toast.error("Could not read the Excel file");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <Button type="button" variant="outline" onClick={onTemplate}>
        Download template
      </Button>
      <Button type="button" variant="secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? "Uploading…" : label}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}
