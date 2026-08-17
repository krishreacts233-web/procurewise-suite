// Server-only notification providers. Never imported from client code.

export type ChannelResult = {
  status: "Sent" | "Failed";
  response: string;
};

function missing(vars: string[]): ChannelResult {
  return {
    status: "Failed",
    response: `Provider not configured — missing ${vars.join(", ")}`,
  };
}

/** Email via Resend HTTP API. */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<ChannelResult> {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["NOTIFY_EMAIL_FROM"];
  const need = [
    ...(!apiKey ? ["RESEND_API_KEY"] : []),
    ...(!from ? ["NOTIFY_EMAIL_FROM"] : []),
  ];
  if (need.length) return missing(need);
  if (!to) return { status: "Failed", response: "Vendor has no email address" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    const text = await res.text();
    if (!res.ok) return { status: "Failed", response: `Resend ${res.status}: ${text.slice(0, 400)}` };
    return { status: "Sent", response: text.slice(0, 400) };
  } catch (err) {
    return { status: "Failed", response: err instanceof Error ? err.message : "Email request failed" };
  }
}

async function twilioSend(
  to: string,
  from: string | undefined,
  body: string,
  fromVarName: string,
): Promise<ChannelResult> {
  const sid = process.env["TWILIO_ACCOUNT_SID"];
  const token = process.env["TWILIO_AUTH_TOKEN"];
  const need = [
    ...(!sid ? ["TWILIO_ACCOUNT_SID"] : []),
    ...(!token ? ["TWILIO_AUTH_TOKEN"] : []),
    ...(!from ? [fromVarName] : []),
  ];
  if (need.length) return missing(need);
  if (!to) return { status: "Failed", response: "Vendor has no number for this channel" };

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from!, Body: body }),
    });
    const text = await res.text();
    if (!res.ok) return { status: "Failed", response: `Twilio ${res.status}: ${text.slice(0, 400)}` };
    const parsed = JSON.parse(text) as { sid?: string; status?: string };
    return { status: "Sent", response: `sid=${parsed.sid ?? "?"} status=${parsed.status ?? "?"}` };
  } catch (err) {
    return { status: "Failed", response: err instanceof Error ? err.message : "Twilio request failed" };
  }
}

function normalizeNumber(raw: string | null | undefined): string {
  const n = (raw ?? "").replace(/[^\d+]/g, "");
  if (!n) return "";
  if (n.startsWith("+")) return n;
  if (n.length === 10) return `+91${n}`; // default country code for local numbers
  return `+${n}`;
}

export async function sendWhatsApp(to: string | null, body: string): Promise<ChannelResult> {
  const number = normalizeNumber(to);
  const from = process.env["TWILIO_WHATSAPP_FROM"];
  return twilioSend(
    number ? `whatsapp:${number}` : "",
    from ? (from.startsWith("whatsapp:") ? from : `whatsapp:${from}`) : undefined,
    body,
    "TWILIO_WHATSAPP_FROM",
  );
}

export async function sendSms(to: string | null, body: string): Promise<ChannelResult> {
  return twilioSend(
    normalizeNumber(to),
    process.env["TWILIO_SMS_FROM"],
    body,
    "TWILIO_SMS_FROM",
  );
}
