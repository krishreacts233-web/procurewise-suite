import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  Eye,
  EyeOff,
  FileText,
  GitCompare,
  LayoutDashboard,
  Loader2,
  Mail,
  Package,
  ShieldCheck,
  ShoppingCart,
  UserPlus,
  KeyRound,
} from "lucide-react";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in | easybidding secure procurement" },
      {
        name: "description",
        content:
          "Sign in to easybidding with your approved work-email login ID to manage procurement, vendors and quotations.",
      },
      { property: "og:title", content: "Sign in | easybidding" },
      {
        property: "og:description",
        content: "Secure account access for the easybidding procurement portal.",
      },
    ],
  }),
  component: LoginPage,
});

const PORTAL_LINKS = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Purchase", icon: ShoppingCart },
  { label: "Items", icon: Package },
  { label: "Quotations", icon: FileText },
  { label: "Comparison", icon: GitCompare },
  { label: "Status", icon: Activity },
];

type Mode = "signin" | "magic" | "request" | "reset";

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [otpEmail, setOtpEmail] = useState<string | null>(null);
  const [otp, setOtp] = useState("");

  useEffect(() => {
    if (!loading && session) void navigate({ to: "/dashboard", replace: true });
  }, [loading, session, navigate]);

  const redirectUrl = typeof window !== "undefined" ? window.location.origin : "";

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      console.error("[AUTH] sign-in failed:", error.message);
      toast.error(error.message);
      return;
    }
    await logAudit({ action: "Login", status: "Success", details: email });
    void navigate({ to: "/dashboard" });
  }

  async function handleRequestAccess(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl, data: { full_name: name } },
    });
    setBusy(false);
    if (error) {
      console.error("[AUTH] request access failed:", error.message);
      toast.error(error.message);
      return;
    }
    toast.success(
      "Your account access request has been submitted successfully. Please wait for Super Admin approval.",
    );
    setMode("signin");
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectUrl },
    });
    setBusy(false);
    if (error) {
      console.error("[AUTH] otp failed:", error.message);
      toast.error(error.message);
      return;
    }
    setOtpEmail(email);
    toast.success("We sent a sign-in link and a six-digit code to your email.");
  }

  async function handleVerifyOtp() {
    if (!otpEmail || otp.length !== 6) return;
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email: otpEmail, token: otp, type: "email" });
    setBusy(false);
    if (error) {
      console.error("[AUTH] verify code failed:", error.message);
      toast.error(error.message);
      return;
    }
    void navigate({ to: "/dashboard" });
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${redirectUrl}/settings`,
    });
    setBusy(false);
    if (error) {
      console.error("[AUTH] reset failed:", error.message);
      toast.error(error.message);
      return;
    }
    toast.success("Password reset email sent.");
  }

  async function handleGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: redirectUrl });
    if (result.error) {
      setBusy(false);
      console.error("[AUTH] google failed:", result.error);
      toast.error("Google sign-in failed. Please try again.");
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/70 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex items-center justify-between">
          <Brand />
          {import.meta.env.DEV && (
            <Badge variant="outline" className="hidden border-primary/40 text-primary sm:inline-flex">
              Development connection active
            </Badge>
          )}
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 p-4 md:grid-cols-[280px_1fr] md:p-8">
        <aside className="panel h-fit p-5">
          <p className="mb-4 text-[11px] uppercase tracking-widest text-muted-foreground">
            Portal Access
          </p>
          <ul className="space-y-1">
            {PORTAL_LINKS.map((l) => (
              <li
                key={l.label}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground/80"
              >
                <l.icon className="h-4 w-4 text-primary" />
                {l.label}
              </li>
            ))}
          </ul>
          <div className="mt-6 rounded-lg border border-border p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mb-1 h-4 w-4 text-primary" />
            All access is verified by the backend. Vendors only ever see their own assigned
            requirements.
          </div>
        </aside>

        <section className="panel p-6 md:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            Secure account access
          </p>
          <h1 className="mt-2 text-2xl font-bold md:text-3xl">Welcome to easybidding</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Sign in with your approved work-email login ID. First-time authorized administrators
            must request access, verify the six-digit email code, then sign in.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {(
              [
                ["signin", "Sign in"],
                ["magic", "Email link"],
                ["request", "Request access"],
                ["reset", "Reset password"],
              ] as [Mode, string][]
            ).map(([m, label]) => (
              <Button
                key={m}
                type="button"
                size="sm"
                variant={mode === m ? "default" : "outline"}
                onClick={() => setMode(m)}
              >
                {label}
              </Button>
            ))}
          </div>

          <div className="mt-6 max-w-md">
            {mode === "signin" && (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">USER ID (EMAIL)</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">PASSWORD</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Sign in
                </Button>
              </form>
            )}

            {mode === "magic" && (
              <form onSubmit={handleMagicLink} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="magic-email">USER ID (EMAIL)</Label>
                  <Input
                    id="magic-email"
                    type="email"
                    required
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  <Mail className="h-4 w-4" /> Send email link & code
                </Button>
                {otpEmail && (
                  <div className="space-y-3 rounded-lg border border-border p-3">
                    <Label>Six-digit verification code</Label>
                    <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                      <InputOTPGroup>
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                          <InputOTPSlot key={i} index={i} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                    <Button
                      type="button"
                      className="w-full"
                      onClick={handleVerifyOtp}
                      disabled={busy || otp.length !== 6}
                    >
                      Verify code
                    </Button>
                  </div>
                )}
              </form>
            )}

            {mode === "request" && (
              <form onSubmit={handleRequestAccess} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="req-name">FULL NAME</Label>
                  <Input
                    id="req-name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="req-email">USER ID (EMAIL)</Label>
                  <Input
                    id="req-email"
                    type="email"
                    required
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="req-pass">PASSWORD</Label>
                  <Input
                    id="req-pass"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  <UserPlus className="h-4 w-4" /> Request access
                </Button>
              </form>
            )}

            {mode === "reset" && (
              <form onSubmit={handleReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">USER ID (EMAIL)</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    required
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  <KeyRound className="h-4 w-4" /> Send reset link
                </Button>
              </form>
            )}

            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
            </div>

            <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={busy}>
              Connect with Google
            </Button>

            <button
              type="button"
              onClick={() => setMode("reset")}
              className="mt-4 block text-sm text-primary underline-offset-4 hover:underline"
            >
              Forgot your password?
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
