import { ShieldCheck, Gavel } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
        <Gavel className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <div className="text-lg font-bold tracking-tight gold-text">easybidding</div>
        {!compact && (
          <div className="flex items-center gap-1 text-[11px] uppercase tracking-widest text-muted-foreground">
            <ShieldCheck className="h-3 w-3" /> Secure procurement
          </div>
        )}
      </div>
    </div>
  );
}
