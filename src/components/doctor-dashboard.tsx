import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  PhoneCall,
  CheckCircle2,
  AlertTriangle,
  Play,
  Power,
  UserRound,
  Calendar,
  Clock,
} from "lucide-react";

type Doctor = {
  id: string;
  full_name: string;
  is_available: boolean;
  current_token: number;
  delay_minutes: number;
  consultation_minutes: number;
  specialties?: { name: string } | null;
  hospitals?: { name: string } | null;
};

type Appt = {
  id: string;
  patient_id: string;
  time_slot: string;
  token_number: number;
  status: string;
  profiles?: { full_name: string } | null;
};

export function DoctorDashboard({ userId, userName }: { userId: string; userName: string }) {
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const loadDoctor = async () => {
    const { data } = await supabase
      .from("doctors")
      .select("*, specialties(name), hospitals(name)")
      .eq("user_id", userId)
      .maybeSingle();
    setDoctor((data as unknown as Doctor) ?? null);
  };

  const loadAppts = async (docId: string) => {
    const { data } = await supabase
      .from("appointments")
      .select("*, profiles(full_name)")
      .eq("doctor_id", docId)
      .eq("appointment_date", today)
      .order("token_number");
    setAppts((data as unknown as Appt[]) ?? []);
  };

  const refresh = async () => {
    await loadDoctor();
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!doctor) return;
    loadAppts(doctor.id);
    const ch = supabase
      .channel("doctor-" + doctor.id)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `doctor_id=eq.${doctor.id}` },
        () => loadAppts(doctor.id),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "doctors", filter: `id=eq.${doctor.id}` },
        () => loadDoctor(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctor?.id]);

  const claimDoctor = async () => {
    setClaiming(true);
    // Find an unclaimed doctor record; if none, create one.
    const { data: unclaimed } = await supabase
      .from("doctors")
      .select("id")
      .is("user_id", null)
      .limit(1)
      .maybeSingle();
    if (unclaimed) {
      await supabase.from("doctors").update({ user_id: userId }).eq("id", unclaimed.id);
    } else {
      await supabase.from("doctors").insert({
        user_id: userId,
        full_name: userName || "New Doctor",
      });
    }
    await refresh();
    setClaiming(false);
  };

  if (loading)
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );

  if (!doctor)
    return (
      <div className="card-elev grid place-items-center gap-3 p-12 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-secondary-foreground">
          <UserRound className="h-6 w-6" />
        </span>
        <div>
          <h3 className="font-display text-lg font-bold">Link your doctor profile</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            You're not linked to a doctor record yet. Claim an existing profile from the seeded
            demo doctors — or create a new one.
          </p>
        </div>
        <button
          onClick={claimDoctor}
          disabled={claiming}
          className="mt-2 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {claiming && <Loader2 className="h-4 w-4 animate-spin" />}
          Link me to a doctor profile
        </button>
      </div>
    );

  const inProgress = appts.find((a) => a.status === "in_progress");
  const upcoming = appts.filter((a) => ["scheduled", "waiting"].includes(a.status));
  const completed = appts.filter((a) => a.status === "completed");

  const callNext = async () => {
    const next = upcoming[0];
    if (!next) return;
    // Complete any current in-progress and advance token
    if (inProgress) {
      await supabase
        .from("appointments")
        .update({ status: "completed" })
        .eq("id", inProgress.id);
    }
    await supabase
      .from("appointments")
      .update({ status: "in_progress" })
      .eq("id", next.id);
    await supabase
      .from("doctors")
      .update({ current_token: next.token_number })
      .eq("id", doctor.id);
    await supabase.from("notifications").insert({
      user_id: next.patient_id,
      title: "It's your turn!",
      message: `${doctor.full_name} is ready for you. Please head in.`,
      appointment_id: next.id,
    });
  };

  const completeCurrent = async () => {
    if (!inProgress) return;
    await supabase
      .from("appointments")
      .update({ status: "completed" })
      .eq("id", inProgress.id);
  };

  const addDelay = async (m: number) => {
    const newDelay = Math.max(0, (doctor.delay_minutes ?? 0) + m);
    await supabase.from("doctors").update({ delay_minutes: newDelay }).eq("id", doctor.id);
    // Notify next few waiting patients
    for (const a of upcoming.slice(0, 5)) {
      await supabase.from("notifications").insert({
        user_id: a.patient_id,
        title: m > 0 ? "Short delay update" : "Delay cleared",
        message:
          m > 0
            ? `${doctor.full_name} is running about ${newDelay} minutes late.`
            : `${doctor.full_name} is back on schedule.`,
        appointment_id: a.id,
      });
    }
  };

  const toggleAvailable = async () => {
    await supabase
      .from("doctors")
      .update({ is_available: !doctor.is_available })
      .eq("id", doctor.id);
  };

  return (
    <div>
      <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-black sm:text-3xl">
            {doctor.full_name}
          </h1>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {doctor.specialties?.name ?? "General"} · {doctor.hospitals?.name ?? "—"}
          </p>
        </div>
        <button
          onClick={toggleAvailable}
          className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
            doctor.is_available
              ? "bg-success/15 text-success"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <Power className="h-4 w-4" />
          {doctor.is_available ? "On duty" : "Off duty"}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.15fr_1fr]">
        {/* Current + controls */}
        <div className="card-elev p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Now serving
          </p>
          {inProgress ? (
            <div className="mt-2">
              <div className="flex items-baseline gap-3">
                <span className="font-display text-5xl font-black text-primary">
                  #{String(inProgress.token_number).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {inProgress.profiles?.full_name || "Patient"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Slot {inProgress.time_slot.slice(0, 5)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-2">
              <span className="font-display text-4xl font-black text-muted-foreground">
                #{String(doctor.current_token).padStart(2, "0")}
              </span>
              <p className="mt-1 text-sm text-muted-foreground">
                No patient in progress. Ready to call next.
              </p>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={callNext}
              disabled={upcoming.length === 0}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              <PhoneCall className="h-4 w-4" /> Call next patient
            </button>
            <button
              onClick={completeCurrent}
              disabled={!inProgress}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4 text-success" /> Complete
            </button>
            <button
              onClick={() => addDelay(5)}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted"
            >
              <AlertTriangle className="h-4 w-4 text-warning-foreground" /> +5m delay
            </button>
            {doctor.delay_minutes > 0 && (
              <button
                onClick={() => addDelay(-doctor.delay_minutes)}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted"
              >
                Clear delay ({doctor.delay_minutes}m)
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Waiting" value={upcoming.length} tone="warning" icon={Clock} />
          <StatCard label="Done" value={completed.length} tone="success" icon={CheckCircle2} />
          <StatCard
            label="Delay"
            value={`${doctor.delay_minutes}m`}
            tone={doctor.delay_minutes > 0 ? "destructive" : "muted"}
            icon={AlertTriangle}
          />
        </div>
      </div>

      <div className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
          <Calendar className="h-4.5 w-4.5 text-primary" /> Today's schedule
        </h2>
        {appts.length === 0 ? (
          <div className="card-elev p-8 text-center text-sm text-muted-foreground">
            No appointments today.
          </div>
        ) : (
          <div className="card-elev divide-y divide-border overflow-hidden">
            {appts.map((a) => (
              <ApptRow key={a.id} appt={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  tone: "success" | "warning" | "destructive" | "muted";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const toneClass = {
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    destructive: "bg-destructive/15 text-destructive",
    muted: "bg-muted text-muted-foreground",
  }[tone];
  return (
    <div className="card-elev p-4">
      <div className={`chip ${toneClass}`}>
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 font-display text-3xl font-black">{value}</div>
    </div>
  );
}

function ApptRow({ appt }: { appt: Appt }) {
  const statusMap: Record<string, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
    scheduled: { label: "Scheduled", cls: "bg-muted text-muted-foreground", icon: Clock },
    waiting: { label: "Waiting", cls: "bg-warning/20 text-warning-foreground", icon: Clock },
    in_progress: { label: "In progress", cls: "bg-primary/15 text-primary", icon: Play },
    completed: { label: "Completed", cls: "bg-success/15 text-success", icon: CheckCircle2 },
    cancelled: { label: "Cancelled", cls: "bg-destructive/10 text-destructive line-through", icon: AlertTriangle },
    no_show: { label: "No show", cls: "bg-destructive/10 text-destructive", icon: AlertTriangle },
  };
  const s = statusMap[appt.status] ?? statusMap.scheduled;
  return (
    <div className="flex items-center gap-4 p-3.5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 font-display text-sm font-bold text-primary">
        {String(appt.token_number).padStart(2, "0")}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{appt.profiles?.full_name || "Patient"}</p>
        <p className="text-xs text-muted-foreground">{appt.time_slot.slice(0, 5)}</p>
      </div>
      <span className={`chip ${s.cls}`}>
        <s.icon className="h-3 w-3" />
        {s.label}
      </span>
    </div>
  );
}
