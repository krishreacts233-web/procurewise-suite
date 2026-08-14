import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "purchase" | "vendor";

export interface AccountApproval {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  status: string;
  isActive: boolean;
  correction_message: string | null;
  rejection_reason: string | null;
  last_updated: string;
}

export interface Profile {
  id: string;
  display_name: string;
  email: string;
  is_active: boolean;
  last_login: string | null;
}

interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  approval: AccountApproval | null;
  vendorId: string | null;
  vendorName: string | null;
  isSuperAdmin: boolean;
  isPurchase: boolean;
  isVendor: boolean;
  isStaff: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [approval, setApproval] = useState<AccountApproval | null>(null);
  const [vendor, setVendor] = useState<{ id: string; vendor_name: string } | null>(null);

  const loadContext = useCallback(async (uid: string | undefined) => {
    if (!uid) {
      setProfile(null);
      setRoles([]);
      setApproval(null);
      setVendor(null);
      return;
    }
    try {
      const [p, r, a, v] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.from("account_approval_requests").select("*").eq("userId", uid).maybeSingle(),
        supabase.from("vendors").select("id, vendor_name").eq("user_id", uid).maybeSingle(),
      ]);
      if (p.error) console.error("[AUTH] profile", p.error.message);
      if (r.error) console.error("[AUTH] roles", r.error.message);
      if (a.error) console.error("[APPROVAL] load", a.error.message);
      setProfile((p.data as Profile) ?? null);
      setRoles(((r.data ?? []) as { role: AppRole }[]).map((x) => x.role));
      setApproval((a.data as unknown as AccountApproval) ?? null);
      setVendor((v.data as { id: string; vendor_name: string } | null) ?? null);
    } catch (err) {
      console.error("[AUTH] context load failed", err);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await loadContext(data.session?.user.id);
      if (mounted) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      setSession(s);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setLoading(true);
        void loadContext(s?.user.id).then(() => mounted && setLoading(false));
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadContext]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    await loadContext(data.session?.user.id);
  }, [loadContext]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setRoles([]);
    setApproval(null);
    setVendor(null);
  }, []);

  const value = useMemo<AuthState>(() => {
    const isSuperAdmin = roles.includes("super_admin");
    const isPurchase = roles.includes("purchase");
    const isVendor = roles.includes("vendor");
    return {
      loading,
      session,
      user: session?.user ?? null,
      profile,
      roles,
      approval,
      vendorId: vendor?.id ?? null,
      vendorName: vendor?.vendor_name ?? null,
      isSuperAdmin,
      isPurchase,
      isVendor,
      isStaff: isSuperAdmin || isPurchase,
      refresh,
      signOut,
    };
  }, [loading, session, profile, roles, approval, vendor, refresh, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
