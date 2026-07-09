import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import {
  Search,
  Star,
  MapPin,
  Clock,
  Ticket,
  Calendar,
  Loader2,
  CheckCircle2,
  Bell,
  X,
  ChevronRight,
} from "lucide-react";

type Doctor = {
  id: string;
  full_name: string;
  bio: string | null;
  rating: number;
  reviews_count: number;
  consultation_minutes: number;
  is_available: boolean;
  current_token: number;
  delay_minutes: number;
  specialty_id: string | null;
  hospital_id: string | null;
  specialties?: { name: string; icon: string | null } | null;
  hospitals?: { name: string; location: string } | null;
};
type Specialty = { id: string; name: string };
type Appointment = {
  id: string;
  doctor_id: string;
  patient_id: string;
  appointment_date: string;
  time_slot: string;
  token_number: number;
  status: string;
  created_at: string;
  doctors?: Doctor | null;
};

function statusTone(current: number, mine: number) {
  const ahead = Math.max(0, mine - current);
  if (ahead === 0) return { label: "You're up next", tone: "success" as const };
  if (ahead <= 2) return { label: `${ahead} ahead`, tone: "success" as const };
  if (ahead <= 5) return { label: `${ahead} ahead`, tone: "warning" as const };
  return { label: `${ahead} ahead`, tone: "destructive" as const };
}

export function PatientDashboard({ userId, userName }: { userId: string; userName: string }) {
  const [tab, setTab] = useState<"find" | "queue" | "notifications">("queue");
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black sm:text-3xl">
            Hi, {userName.split(" ")[0] || "there"} 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Book appointments and track your queue in real time.
          </p>
        </div>
        <div className="flex gap-1 rounded-full bg-muted p-1 text-sm font-semibold">
          {(
            [
              { v: "queue", label: "My queue" },
              { v: "find", label: "Find doctors" },
              { v: "notifications", label: "Alerts" },
            ] as const
          ).map((t) => (
            <button
              key={t.v}
              onClick={() => setTab(t.v)}
              className={`rounded-full px-3.5 py-1.5 transition ${
                tab === t.v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "queue" && <MyQueue userId={userId} />}
      {tab === "find" && <FindDoctors userId={userId} />}
      {tab === "notifications" && <Notifications userId={userId} />}
    </div>
  );
}

/* --------------------------- MY QUEUE --------------------------- */

function MyQueue({ userId }: { userId: string }) {
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [doctorMap, setDoctorMap] = useState<Record<string, Doctor>>({});

  const load = async () => {
    const { data } = await supabase
      .from("appointments")
      .select(
        "*, doctors!inner(*, specialties(name,icon), hospitals(name,location))",
      )
      .eq("patient_id", userId)
      .gte("appointment_date", new Date().toISOString().slice(0, 10))
      .in("status", ["scheduled", "waiting", "in_progress"])
      .order("appointment_date")
      .order("time_slot");
    const list = (data as unknown as Appointment[]) ?? [];
    setAppts(list);
    const map: Record<string, Doctor> = {};
    list.forEach((a) => a.doctors && (map[a.doctor_id] = a.doctors));
    setDoctorMap(map);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("patient-queue-" + userId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "doctors" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (loading)
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );

  if (appts.length === 0)
    return (
      <div className="card-elev grid place-items-center gap-3 p-12 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-secondary-foreground">
          <Calendar className="h-6 w-6" />
        </span>
        <div>
          <h3 className="font-display text-lg font-bold">No upcoming appointments</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Head to <b>Find doctors</b> to book one.
          </p>
        </div>
      </div>
    );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {appts.map((a) => (
        <QueueCard key={a.id} appt={a} doctor={doctorMap[a.doctor_id]} onCancel={load} />
      ))}
    </div>
  );
}

function QueueCard({
  appt,
  doctor,
  onCancel,
}: {
  appt: Appointment;
  doctor?: Doctor;
  onCancel: () => void;
}) {
  const [showQR, setShowQR] = useState(false);
  if (!doctor) return null;
  const s = statusTone(doctor.current_token, appt.token_number);
  const perPatient = doctor.consultation_minutes;
  const ahead = Math.max(0, appt.token_number - doctor.current_token);
  const waitMin = ahead * perPatient + (doctor.delay_minutes || 0);
  const progress = Math.min(
    100,
    Math.max(2, (doctor.current_token / Math.max(appt.token_number, 1)) * 100),
  );
  const toneClass =
    s.tone === "success"
      ? "bg-success/15 text-success"
      : s.tone === "warning"
        ? "bg-warning/20 text-warning-foreground"
        : "bg-destructive/15 text-destructive";

  const cancel = async () => {
    await supabase.from("appointments").update({ status: "cancelled" }).eq("id", appt.id);
    onCancel();
  };

  return (
    <div className="card-elev overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 font-display text-lg font-bold text-primary">
            {doctor.full_name
              .split(" ")
              .slice(-1)[0]
              .charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-base font-bold">{doctor.full_name}</h3>
            <p className="truncate text-xs text-muted-foreground">
              {doctor.specialties?.name ?? "General"} · {doctor.hospitals?.name}
            </p>
          </div>
          <span className={`chip ${toneClass}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" /> {s.label}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <Stat label="Your token" value={String(appt.token_number).padStart(2, "0")} />
          <Stat label="Now serving" value={String(doctor.current_token).padStart(2, "0")} />
          <Stat label="Wait" value={ahead === 0 ? "Now" : `~${waitMin}m`} />
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
            <span>
              Slot {appt.time_slot.slice(0, 5)}
              {doctor.delay_minutes > 0 && (
                <span className="text-warning-foreground"> · +{doctor.delay_minutes}m delay</span>
              )}
            </span>
            <span>Progress</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setShowQR(true)}
            className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            <Ticket className="h-3.5 w-3.5" /> Show token QR
          </button>
          <button
            onClick={cancel}
            className="flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
        </div>
      </div>

      {showQR && (
        <Modal onClose={() => setShowQR(false)}>
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Digital Token
            </p>
            <h3 className="mt-1 font-display text-3xl font-black">
              #{String(appt.token_number).padStart(3, "0")}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{doctor.full_name}</p>
            <div className="mt-6 grid place-items-center">
              <div className="rounded-2xl bg-white p-4">
                <QRCodeSVG value={`mediqueue://token/${appt.id}`} size={180} />
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Show this at reception for check-in.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/60 p-2.5 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 font-display text-xl font-black">{value}</div>
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card-elev w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/* --------------------------- FIND DOCTORS --------------------------- */

function FindDoctors({ userId }: { userId: string }) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [q, setQ] = useState("");
  const [specialty, setSpecialty] = useState<string>("all");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [selected, setSelected] = useState<Doctor | null>(null);

  useEffect(() => {
    supabase
      .from("doctors")
      .select("*, specialties(name,icon), hospitals(name,location)")
      .then(({ data }) => setDoctors((data as unknown as Doctor[]) ?? []));
    supabase
      .from("specialties")
      .select("id,name")
      .order("name")
      .then(({ data }) => setSpecialties(data ?? []));
  }, []);

  const filtered = useMemo(() => {
    return doctors
      .filter((d) => (specialty === "all" ? true : d.specialty_id === specialty))
      .filter((d) => (availableOnly ? d.is_available : true))
      .filter(
        (d) =>
          !q ||
          d.full_name.toLowerCase().includes(q.toLowerCase()) ||
          d.specialties?.name.toLowerCase().includes(q.toLowerCase()) ||
          d.hospitals?.name.toLowerCase().includes(q.toLowerCase()),
      )
      .sort((a, b) => b.rating - a.rating);
  }, [doctors, q, specialty, availableOnly]);

  return (
    <div>
      <div className="card-elev mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-muted px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search doctors, specialties, hospitals…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          className="rounded-full border border-border bg-card px-3 py-2 text-sm font-medium outline-none"
        >
          <option value="all">All specialties</option>
          {specialties.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(e) => setAvailableOnly(e.target.checked)}
            className="accent-primary"
          />
          Available
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="card-elev p-8 text-center text-sm text-muted-foreground">
          No doctors match your filters.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((d) => (
            <DoctorCard key={d.id} doctor={d} onSelect={() => setSelected(d)} />
          ))}
        </div>
      )}

      {selected && (
        <BookModal doctor={selected} userId={userId} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function DoctorCard({ doctor, onSelect }: { doctor: Doctor; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="card-elev group text-left transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 font-display text-lg font-bold text-primary">
            {doctor.full_name.split(" ").slice(-1)[0].charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-base font-bold">{doctor.full_name}</h3>
            <p className="truncate text-xs text-muted-foreground">
              {doctor.specialties?.name ?? "General"}
            </p>
          </div>
          <span
            className={`chip ${
              doctor.is_available
                ? "bg-success/15 text-success"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {doctor.is_available ? "Available" : "Off duty"}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-warning text-warning" />
            <b className="text-foreground">{doctor.rating.toFixed(1)}</b> ({doctor.reviews_count})
          </span>
          <span className="flex items-center gap-1 truncate">
            <MapPin className="h-3.5 w-3.5" /> {doctor.hospitals?.name}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {doctor.consultation_minutes}m slots
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Now serving <b className="text-foreground">#{doctor.current_token}</b>
          </span>
          <span className="flex items-center gap-1 font-semibold text-primary">
            Book <ChevronRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </button>
  );
}

function generateSlots(consultation: number): string[] {
  const slots: string[] = [];
  for (let h = 9; h < 17; h++) {
    for (let m = 0; m < 60; m += consultation) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
}

function BookModal({
  doctor,
  userId,
  onClose,
}: {
  doctor: Doctor;
  userId: string;
  onClose: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [takenSlots, setTakenSlots] = useState<Set<string>>(new Set());
  const [chosen, setChosen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<{ token: number; slot: string } | null>(null);
  const slots = useMemo(() => generateSlots(doctor.consultation_minutes), [doctor.consultation_minutes]);

  useEffect(() => {
    supabase
      .from("appointments")
      .select("time_slot")
      .eq("doctor_id", doctor.id)
      .eq("appointment_date", date)
      .not("status", "eq", "cancelled")
      .then(({ data }) => setTakenSlots(new Set((data ?? []).map((r) => r.time_slot.slice(0, 5)))));
  }, [doctor.id, date]);

  const alternatives = useMemo(() => {
    if (!chosen || !takenSlots.has(chosen)) return [];
    const idx = slots.indexOf(chosen);
    return slots
      .filter((s, i) => Math.abs(i - idx) <= 4 && !takenSlots.has(s))
      .slice(0, 3);
  }, [chosen, takenSlots, slots]);

  const book = async () => {
    if (!chosen) return;
    setBusy(true);
    const { count } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("doctor_id", doctor.id)
      .eq("appointment_date", date);
    const token = (count ?? 0) + 1;
    const { error } = await supabase.from("appointments").insert({
      doctor_id: doctor.id,
      patient_id: userId,
      appointment_date: date,
      time_slot: chosen + ":00",
      token_number: token,
      status: "scheduled",
    });
    if (!error) {
      await supabase.from("notifications").insert({
        user_id: userId,
        title: "Appointment confirmed",
        message: `Token #${token} with ${doctor.full_name} at ${chosen}.`,
      });
      setConfirmation({ token, slot: chosen });
    }
    setBusy(false);
  };

  return (
    <Modal onClose={onClose}>
      {confirmation ? (
        <div className="text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <h3 className="mt-4 font-display text-lg font-bold">Appointment confirmed</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Token <b>#{confirmation.token}</b> · {confirmation.slot}
          </p>
          <button
            onClick={onClose}
            className="mt-6 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Done
          </button>
        </div>
      ) : (
        <>
          <h3 className="font-display text-lg font-bold">Book with {doctor.full_name}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {doctor.specialties?.name} · {doctor.hospitals?.name}
          </p>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Date</span>
            <input
              type="date"
              min={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <div className="mt-4">
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Choose a slot</p>
            <div className="grid max-h-52 grid-cols-4 gap-1.5 overflow-y-auto">
              {slots.map((s) => {
                const taken = takenSlots.has(s);
                const active = chosen === s;
                return (
                  <button
                    key={s}
                    onClick={() => setChosen(s)}
                    disabled={taken}
                    className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : taken
                          ? "border-transparent bg-muted/50 text-muted-foreground/50 line-through"
                          : "border-border hover:border-primary/50 hover:bg-primary/5"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
          {alternatives.length > 0 && (
            <div className="mt-3 rounded-lg bg-warning/10 p-3 text-xs">
              <p className="font-semibold text-warning-foreground">That slot is taken. Try:</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {alternatives.map((a) => (
                  <button
                    key={a}
                    onClick={() => setChosen(a)}
                    className="rounded-full bg-card px-2.5 py-1 font-semibold text-primary"
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={book}
            disabled={!chosen || takenSlots.has(chosen) || busy}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm booking
          </button>
        </>
      )}
    </Modal>
  );
}

/* --------------------------- NOTIFICATIONS --------------------------- */

type Notif = {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

function Notifications({ userId }: { userId: string }) {
  const [notifs, setNotifs] = useState<Notif[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifs((data as Notif[]) ?? []);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("notif-" + userId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  };

  if (notifs.length === 0)
    return (
      <div className="card-elev grid place-items-center gap-3 p-12 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-accent-foreground">
          <Bell className="h-6 w-6" />
        </span>
        <p className="text-sm text-muted-foreground">No notifications yet.</p>
      </div>
    );

  return (
    <div className="grid gap-2">
      {notifs.map((n) => (
        <div
          key={n.id}
          className={`card-elev flex items-start gap-3 p-4 ${!n.is_read ? "ring-1 ring-primary/20" : ""}`}
        >
          <span
            className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
              n.is_read ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
            }`}
          >
            <Bell className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-semibold text-sm">{n.title}</p>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {new Date(n.created_at).toLocaleString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
          </div>
          {!n.is_read && (
            <button
              onClick={() => markRead(n.id)}
              className="rounded-full px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/10"
            >
              Mark read
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
