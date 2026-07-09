import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  Users,
  Clock,
  TrendingUp,
  Activity,
  Plus,
  Trash2,
  Pencil,
  Save,
  X,
} from "lucide-react";

type Doctor = {
  id: string;
  full_name: string;
  bio: string | null;
  specialty_id: string | null;
  hospital_id: string | null;
  rating: number;
  consultation_minutes: number;
  is_available: boolean;
  current_token: number;
};
type Specialty = { id: string; name: string };
type Hospital = { id: string; name: string; location: string };
type Appt = {
  id: string;
  doctor_id: string;
  status: string;
  time_slot: string;
  created_at: string;
  updated_at: string;
  appointment_date: string;
};

export function AdminDashboard() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const [d, s, h, a] = await Promise.all([
      supabase.from("doctors").select("*").order("full_name"),
      supabase.from("specialties").select("*").order("name"),
      supabase.from("hospitals").select("*").order("name"),
      supabase
        .from("appointments")
        .select("id,doctor_id,status,time_slot,created_at,updated_at,appointment_date")
        .gte(
          "appointment_date",
          new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10),
        ),
    ]);
    setDoctors((d.data as Doctor[]) ?? []);
    setSpecialties((s.data as Specialty[]) ?? []);
    setHospitals((h.data as Hospital[]) ?? []);
    setAppts((a.data as Appt[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const analytics = useMemo(() => {
    const total = appts.length;
    const completed = appts.filter((a) => a.status === "completed");
    const avgWaitMin =
      completed.length > 0
        ? Math.round(
            completed.reduce(
              (acc, a) =>
                acc + (new Date(a.updated_at).getTime() - new Date(a.created_at).getTime()) / 60000,
              0,
            ) / completed.length,
          )
        : 0;
    const hourBuckets = new Array(24).fill(0);
    appts.forEach((a) => {
      const h = parseInt(a.time_slot.slice(0, 2), 10);
      hourBuckets[h]++;
    });
    const peakHour = hourBuckets.indexOf(Math.max(...hourBuckets));
    const utilization =
      doctors.length > 0
        ? Math.round((completed.length / Math.max(doctors.length * 8, 1)) * 100)
        : 0;
    return { total, avgWaitMin, peakHour, utilization, hourBuckets };
  }, [appts, doctors]);

  if (loading)
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-black sm:text-3xl">Admin overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Last 7 days of activity across all doctors and hospitals.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Appointments"
          value={analytics.total}
          hint="Last 7 days"
          icon={Activity}
          tone="primary"
        />
        <Metric
          label="Avg. wait time"
          value={`${analytics.avgWaitMin}m`}
          hint="From booking to complete"
          icon={Clock}
          tone={analytics.avgWaitMin < 20 ? "success" : analytics.avgWaitMin < 45 ? "warning" : "destructive"}
        />
        <Metric
          label="Peak hour"
          value={`${String(analytics.peakHour).padStart(2, "0")}:00`}
          hint="Busiest time of day"
          icon={TrendingUp}
          tone="info"
        />
        <Metric
          label="Utilization"
          value={`${analytics.utilization}%`}
          hint="Doctor capacity used"
          icon={Users}
          tone={analytics.utilization > 60 ? "success" : "muted"}
        />
      </div>

      {/* Peak hours chart */}
      <div className="card-elev mt-6 p-5">
        <h2 className="font-display text-base font-bold">Traffic by hour</h2>
        <div className="mt-4 flex h-32 items-end gap-1">
          {analytics.hourBuckets.slice(7, 21).map((v, i) => {
            const max = Math.max(...analytics.hourBuckets);
            const h = max > 0 ? (v / max) * 100 : 0;
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-primary/80 transition-all"
                  style={{ height: `${Math.max(4, h)}%` }}
                  title={`${v} appts`}
                />
                <span className="text-[10px] text-muted-foreground">{i + 7}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Doctor management */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Doctors</h2>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Add doctor
          </button>
        </div>

        <div className="card-elev overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_auto] items-center gap-3 border-b border-border bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>Name</span>
            <span>Specialty</span>
            <span>Hospital</span>
            <span className="text-right">Actions</span>
          </div>
          {doctors.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No doctors yet.</div>
          ) : (
            doctors.map((d) => (
              <div
                key={d.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3 last:border-0 md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_auto]"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{d.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground md:hidden">
                    {specialties.find((s) => s.id === d.specialty_id)?.name ?? "—"} ·{" "}
                    {hospitals.find((h) => h.id === d.hospital_id)?.name ?? "—"}
                  </p>
                </div>
                <p className="hidden truncate text-sm md:block">
                  {specialties.find((s) => s.id === d.specialty_id)?.name ?? "—"}
                </p>
                <p className="hidden truncate text-sm md:block">
                  {hospitals.find((h) => h.id === d.hospital_id)?.name ?? "—"}
                </p>
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => setEditing(d)}
                    className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete ${d.full_name}?`)) return;
                      await supabase.from("doctors").delete().eq("id", d.id);
                      load();
                    }}
                    className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {(editing || creating) && (
        <DoctorEditor
          doctor={editing}
          specialties={specialties}
          hospitals={hospitals}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={() => {
            setEditing(null);
            setCreating(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "success" | "warning" | "destructive" | "info" | "muted";
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    destructive: "bg-destructive/15 text-destructive",
    info: "bg-info/15 text-info",
    muted: "bg-muted text-muted-foreground",
  }[tone];
  return (
    <div className="card-elev p-4">
      <div className="flex items-center justify-between">
        <span className={`chip ${toneClass}`}>
          <Icon className="h-3.5 w-3.5" /> {label}
        </span>
      </div>
      <div className="mt-3 font-display text-3xl font-black">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function DoctorEditor({
  doctor,
  specialties,
  hospitals,
  onClose,
  onSaved,
}: {
  doctor: Doctor | null;
  specialties: Specialty[];
  hospitals: Hospital[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    full_name: doctor?.full_name ?? "",
    bio: doctor?.bio ?? "",
    specialty_id: doctor?.specialty_id ?? specialties[0]?.id ?? "",
    hospital_id: doctor?.hospital_id ?? hospitals[0]?.id ?? "",
    consultation_minutes: doctor?.consultation_minutes ?? 15,
    is_available: doctor?.is_available ?? true,
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    if (doctor) {
      await supabase.from("doctors").update(form).eq("id", doctor.id);
    } else {
      await supabase.from("doctors").insert({ ...form });
    }
    setBusy(false);
    onSaved();
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="card-elev w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">
            {doctor ? "Edit doctor" : "Add doctor"}
          </h3>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-3">
          <Field label="Full name">
            <input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Specialty">
              <select
                value={form.specialty_id}
                onChange={(e) => setForm({ ...form, specialty_id: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              >
                {specialties.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Hospital">
              <select
                value={form.hospital_id}
                onChange={(e) => setForm({ ...form, hospital_id: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              >
                {hospitals.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Slot (minutes)">
              <input
                type="number"
                min={5}
                max={90}
                value={form.consultation_minutes}
                onChange={(e) =>
                  setForm({ ...form, consultation_minutes: parseInt(e.target.value, 10) })
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </Field>
            <Field label="Available">
              <label className="flex h-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_available}
                  onChange={(e) => setForm({ ...form, is_available: e.target.checked })}
                  className="accent-primary"
                />
                On duty
              </label>
            </Field>
          </div>
          <Field label="Bio">
            <textarea
              rows={3}
              value={form.bio ?? ""}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy || !form.full_name.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
