import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AlertChannel = "email" | "whatsapp" | "sms";

export interface ChannelOutcome {
  channel: AlertChannel;
  status: "Sent" | "Failed";
  recipient: string;
  response: string;
}

export const sendRequirementAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requirementId: string; channels?: AlertChannel[] }) => input)
  .handler(async ({ data, context }): Promise<{ ok: boolean; results: ChannelOutcome[]; error?: string }> => {
    const { sendEmail, sendSms, sendWhatsApp } = await import("./notify.server");
    const supabase = context.supabase;
    const channels: AlertChannel[] = data.channels ?? ["email", "whatsapp", "sms"];

    const { data: req, error } = await supabase
      .from("purchase_requirements")
      .select(
        "id, requirement_no, quantity, unit, required_date, remarks, vendor_id, departments(code,name), items(item_code,item_name,specification), vendors(id,vendor_name,contact_person,email,mobile,whatsapp)",
      )
      .eq("id", data.requirementId)
      .maybeSingle();

    if (error || !req) {
      return { ok: false, results: [], error: error?.message ?? "Requirement not found" };
    }
    const vendor = req.vendors as unknown as {
      id: string;
      vendor_name: string;
      contact_person: string | null;
      email: string | null;
      mobile: string | null;
      whatsapp: string | null;
    } | null;
    if (!vendor) return { ok: false, results: [], error: "No vendor assigned to this enquiry" };

    const dept = req.departments as unknown as { code: string; name: string } | null;
    const item = req.items as unknown as { item_code: string; item_name: string; specification: string | null } | null;

    const prNo = req.requirement_no;
    const line = `${item?.item_code ?? ""} — ${item?.item_name ?? ""}`;
    const details = [
      `Enquiry: ${prNo}`,
      `Department: ${dept?.code ?? "-"}`,
      `Item: ${line}`,
      `Quantity: ${req.quantity} ${req.unit}`,
      `Required by: ${req.required_date ?? "-"}`,
      req.remarks ? `Remarks: ${req.remarks}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const subject = `New Purchase Requirement – ${prNo}`;
    const html = `<div style="font-family:Arial,sans-serif;color:#1f2937">
      <h2 style="margin:0 0 12px">${subject}</h2>
      <p>Dear ${vendor.contact_person || vendor.vendor_name},</p>
      <p>You have been assigned a new purchase enquiry on easybidding.</p>
      <table cellpadding="6" style="border-collapse:collapse;font-size:14px">
        <tr><td><b>Enquiry No</b></td><td>${prNo}</td></tr>
        <tr><td><b>Department</b></td><td>${dept?.code ?? "-"}</td></tr>
        <tr><td><b>Item</b></td><td>${line}</td></tr>
        <tr><td><b>Specification</b></td><td>${item?.specification ?? "-"}</td></tr>
        <tr><td><b>Quantity</b></td><td>${req.quantity} ${req.unit}</td></tr>
        <tr><td><b>Required date</b></td><td>${req.required_date ?? "-"}</td></tr>
        <tr><td><b>Remarks</b></td><td>${req.remarks ?? "-"}</td></tr>
      </table>
      <p>Please log in to easybidding and submit your quotation.</p>
    </div>`;

    const whatsappBody = `*New Purchase Requirement – ${prNo}*\n\n${details}\n\nPlease submit your quotation on easybidding.`;
    const smsBody = `easybidding: New enquiry ${prNo} for ${item?.item_code ?? "item"} qty ${req.quantity} ${req.unit}. Please submit your quotation.`;

    const results: ChannelOutcome[] = [];

    for (const channel of channels) {
      const recipient =
        channel === "email"
          ? vendor.email ?? ""
          : channel === "whatsapp"
            ? vendor.whatsapp || vendor.mobile || ""
            : vendor.mobile || "";
      const message = channel === "email" ? subject : channel === "whatsapp" ? whatsappBody : smsBody;

      const outcome =
        channel === "email"
          ? await sendEmail(recipient, subject, html)
          : channel === "whatsapp"
            ? await sendWhatsApp(recipient, whatsappBody)
            : await sendSms(recipient, smsBody);

      const label =
        outcome.status === "Failed" && outcome.response.startsWith("Provider not configured")
          ? "Failed – Provider Not Configured"
          : outcome.status;

      results.push({ channel, status: outcome.status, recipient, response: outcome.response });

      await supabase.from("notification_log").insert({
        requirement_id: req.id,
        vendor_id: vendor.id,
        channel,
        recipient,
        message,
        status: label,
        provider_response: outcome.response,
        sent_at: outcome.status === "Sent" ? new Date().toISOString() : null,
      });

      const column =
        channel === "email" ? "email_status" : channel === "whatsapp" ? "whatsapp_status" : "sms_status";
      await supabase
        .from("purchase_requirements")
        .update({ [column]: label })
        .eq("id", req.id);
    }

    return { ok: results.some((r) => r.status === "Sent"), results };
  });
