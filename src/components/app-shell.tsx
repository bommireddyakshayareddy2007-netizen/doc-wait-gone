import { Link, useNavigate } from "@tanstack/react-router";
import { Activity, LogOut, Bell } from "lucide-react";
import { signOut, type AppRole } from "@/lib/auth";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

const roleLabel: Record<AppRole, string> = {
  patient: "Patient",
  doctor: "Doctor",
  admin: "Admin",
};

export function AppShell({
  children,
  role,
  userName,
  userId,
}: {
  children: ReactNode;
  role: AppRole;
  userName: string;
  userId: string;
}) {
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false);
      if (mounted) setUnread(count ?? 0);
    };
    load();
    const ch = supabase
      .channel("notif-count-" + userId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [userId]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Activity className="h-5 w-5" strokeWidth={2.5} />
            </span>
            <span className="hidden font-display text-lg font-bold tracking-tight sm:inline">
              MediQueue
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <span className="chip bg-accent text-accent-foreground hidden sm:inline-flex">
              {roleLabel[role]}
            </span>
            <button
              className="relative grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Notifications"
            >
              <Bell className="h-4.5 w-4.5" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {unread}
                </span>
              )}
            </button>
            <div className="hidden truncate text-sm text-muted-foreground md:block max-w-[160px]">
              {userName}
            </div>
            <button
              onClick={async () => {
                await signOut();
                navigate({ to: "/auth" });
              }}
              className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Sign out"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
