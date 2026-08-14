import { Bell } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/lib/auth";

export function NotificationBell() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return data;
    },
  });

  const unread = (data ?? []).filter((n) => !n.is_read).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2 text-sm font-semibold">
          Notifications
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await supabase
                .from("notifications")
                .update({ is_read: true })
                .eq("user_id", user!.id)
                .eq("is_read", false);
              void qc.invalidateQueries({ queryKey: ["notifications"] });
            }}
          >
            Mark all read
          </Button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {(data ?? []).length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No notifications yet.</p>
          )}
          {(data ?? []).map((n) => (
            <div
              key={n.id}
              className={`border-b border-border/60 px-3 py-2 text-sm ${n.is_read ? "opacity-60" : ""}`}
            >
              <div className="font-medium">{n.title}</div>
              <div className="text-xs text-muted-foreground">{n.message}</div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                {new Date(n.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
