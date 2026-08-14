import { statusTone } from "@/lib/queries";

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusTone(status)}`}
    >
      {status}
    </span>
  );
}
