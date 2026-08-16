import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings | easybidding" },
      {
        name: "description",
        content: "Manage your easybidding profile, password and account access details.",
      },
      { property: "og:title", content: "Settings | easybidding" },
      { property: "og:description", content: "Profile and password settings for portal users." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, profile, roles, approval, vendorName, refresh, signOut } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [pw, setPw] = useState({ next: "", confirm: "" });
  const [savingPw, setSavingPw] = useState(false);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const display = name.trim();
    if (!display) {
      toast.error("Display name is required");
      return;
    }
    setSavingName(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: display, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    setSavingName(false);
    if (error) {
      console.error("[PROFILE] update failed:", error.message);
      toast.error(error.message);
      return;
    }
    await logAudit({ action: "Profile Updated", recordId: user.id, status: "Updated" });
    toast.success("Profile updated");
    await refresh();
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.next.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (pw.next !== pw.confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password: pw.next });
    setSavingPw(false);
    if (error) {
      console.error("[SETTINGS] password change failed:", error.message);
      toast.error(error.message);
      return;
    }
    await logAudit({ action: "Password Changed", recordId: user?.id ?? null, status: "Updated" });
    toast.success("Password updated");
    setPw({ next: "", confirm: "" });
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Your profile, security and account access details." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={saveProfile}>
              <div className="space-y-1.5">
                <Label htmlFor="display_name">Display name</Label>
                <Input
                  id="display_name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={profile?.email ?? user?.email ?? ""} disabled />
              </div>
              <Button type="submit" disabled={savingName}>
                {savingName ? "Saving…" : "Save profile"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Change password</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={savePassword}>
              <div className="space-y-1.5">
                <Label htmlFor="next_pw">New password</Label>
                <Input
                  id="next_pw"
                  type="password"
                  value={pw.next}
                  onChange={(e) => setPw({ ...pw, next: e.target.value })}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm_pw">Confirm new password</Label>
                <Input
                  id="confirm_pw"
                  type="password"
                  value={pw.confirm}
                  onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" disabled={savingPw}>
                {savingPw ? "Updating…" : "Update password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Account access</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Approval status</p>
              <div className="mt-1">
                <StatusPill status={approval?.status ?? "Pending"} />
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Roles</p>
              <p className="mt-1 text-sm font-medium">{roles.join(", ") || "No role assigned"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Vendor account</p>
              <p className="mt-1 text-sm font-medium">{vendorName ?? "Not linked"}</p>
            </div>
            <div className="sm:col-span-3">
              <Button variant="secondary" onClick={() => void signOut()}>
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
