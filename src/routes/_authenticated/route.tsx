import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2, ShieldAlert, Clock, XCircle, PencilLine } from "lucide-react";
import { PortalLayout } from "@/components/PortalLayout";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/Brand";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">{error.message}</div>
  ),
});

function Gate({
  icon: Icon,
  title,
  message,
}: {
  icon: typeof Clock;
  title: string;
  message: string;
}) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="panel max-w-md p-8 text-center">
        <div className="mb-4 flex justify-center">
          <Brand />
        </div>
        <Icon className="mx-auto mb-3 h-10 w-10 text-primary" />
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <Button
          className="mt-6"
          variant="secondary"
          onClick={async () => {
            await signOut();
            void navigate({ to: "/", replace: true });
          }}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}

function AuthenticatedLayout() {
  const { loading, session, approval } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/", replace: true });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const status = approval?.status ?? "Pending";

  if (status === "Pending") {
    return (
      <Gate
        icon={Clock}
        title="Awaiting Super Admin approval"
        message="Your account access request has been submitted successfully. Please wait for Super Admin approval."
      />
    );
  }
  if (status === "Rejected") {
    return (
      <Gate
        icon={XCircle}
        title="Access denied"
        message={approval?.rejection_reason || "Your access request was rejected by the Super Admin."}
      />
    );
  }
  if (status === "Correction Required") {
    return (
      <Gate
        icon={PencilLine}
        title="Correction required"
        message={
          approval?.correction_message ||
          "The Super Admin has requested a correction to your access request."
        }
      />
    );
  }
  if (approval && approval.isActive === false) {
    return (
      <Gate
        icon={ShieldAlert}
        title="Account disabled"
        message="Your account has been disabled. Please contact the Super Admin."
      />
    );
  }

  return (
    <PortalLayout>
      <Outlet />
    </PortalLayout>
  );
}
