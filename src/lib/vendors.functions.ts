import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface VendorDetail {
  id: string;
  vendor_code: string;
  vendor_name: string;
  contact_person: string | null;
  mobile: string | null;
  email: string | null;
  address: string | null;
  gst: string | null;
  pan: string | null;
  scope_of_supply: string | null;
  designation: string | null;
  sales_manager: string | null;
  status: string;
  user_id: string | null;
  whatsapp: string | null;
}

/**
 * Full vendor records including PII. Super Admin only — vendor contact columns
 * are not exposed to the Data API for signed-in users.
 */
export const listVendorDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VendorDetail[]> => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("is_admin");
    if (roleError || !isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("vendors")
      .select(
        "id, vendor_code, vendor_name, contact_person, mobile, email, address, gst, pan, scope_of_supply, designation, sales_manager, status, user_id, whatsapp",
      )
      .order("vendor_name");
    if (error) throw new Error(error.message);
    return (data ?? []) as VendorDetail[];
  });
