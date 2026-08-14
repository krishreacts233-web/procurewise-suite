import { supabase } from "@/integrations/supabase/client";

export async function logAudit(params: {
  action: string;
  recordId?: string | null;
  status?: string | null;
  details?: string | null;
}) {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const { error } = await supabase.from("audit_log").insert({
    user_id: user?.id ?? null,
    user_name: (user?.user_metadata?.["full_name"] as string) ?? user?.email ?? "system",
    action: params.action,
    record_id: params.recordId ?? null,
    status: params.status ?? null,
    details: params.details ?? null,
  });
  if (error) console.error("[AUDIT]", error.message);
}

export async function notify(userIds: string[], title: string, message: string, link?: string) {
  if (userIds.length === 0) return;
  const { error } = await supabase.from("notifications").insert(
    userIds.map((user_id) => ({ user_id, title, message, link: link ?? null })),
  );
  if (error) console.error("[NOTIFICATION]", error.message);
}
