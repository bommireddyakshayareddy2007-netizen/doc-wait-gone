import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useRole } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { PatientDashboard } from "@/components/patient-dashboard";
import { DoctorDashboard } from "@/components/doctor-dashboard";
import { AdminDashboard } from "@/components/admin-dashboard";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/app")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dashboard — MediQueue" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AppDispatcher,
});

function AppDispatcher() {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useRole(user?.id);
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setFullName(data?.full_name || user.email || ""));
  }, [user]);

  if (authLoading || !user || roleLoading || !role) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppShell role={role} userName={fullName} userId={user.id}>
      {role === "patient" && <PatientDashboard userId={user.id} userName={fullName} />}
      {role === "doctor" && <DoctorDashboard userId={user.id} userName={fullName} />}
      {role === "admin" && <AdminDashboard />}
    </AppShell>
  );
}
