import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ShieldCheck, Clock, QrCode, Users, Stethoscope } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MediQueue — Smart Hospital Appointments & Live Queue" },
      {
        name: "description",
        content:
          "Book doctor appointments, track your live queue in real time, and skip the hospital wait with MediQueue.",
      },
      { property: "og:title", content: "MediQueue — Smart Hospital Appointments" },
      {
        property: "og:description",
        content:
          "Transparent queue tracking, digital tokens, and real-time updates for patients, doctors, and hospitals.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-5 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Activity className="h-5.5 w-5.5" strokeWidth={2.5} />
          </span>
          <span className="font-display text-xl font-bold tracking-tight">MediQueue</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/auth"
            className="rounded-full px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
          >
            Sign in
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
          >
            Get started
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 pt-8 pb-20 sm:px-6 sm:pt-16">
        <div className="grid gap-12 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div>
            <span className="chip bg-secondary text-secondary-foreground">
              <span className="relative inline-block h-2 w-2 rounded-full bg-current pulse-dot" />
              Live queue tracking
            </span>
            <h1 className="mt-5 font-display text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
              Skip the wait.
              <br />
              <span className="text-primary">See your queue,</span>
              <br />
              in real time.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Book doctor appointments, get a secure digital token, and know exactly when it's your
              turn — no more waiting rooms without answers.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
              >
                Create a free account
              </Link>
              <Link
                to="/auth"
                className="rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-muted"
              >
                I already have one
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-success" /> HIPAA-minded design
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-primary" /> Live wait estimates
              </span>
              <span className="flex items-center gap-1.5">
                <QrCode className="h-4 w-4 text-info" /> QR digital tokens
              </span>
            </div>
          </div>

          {/* Live-queue mockup */}
          <div className="card-elev relative p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Your appointment
                </p>
                <p className="mt-1 font-display text-lg font-bold">Dr. Aisha Khan · Cardiology</p>
              </div>
              <span className="chip bg-success/15 text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-current" /> On track
              </span>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                { label: "Your token", v: "07" },
                { label: "Now serving", v: "04" },
                { label: "Est. wait", v: "22m" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-muted/60 p-3 text-center">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {s.label}
                  </div>
                  <div className="mt-1 font-display text-2xl font-black">{s.v}</div>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                <span>3 ahead of you</span>
                <span>Progress</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: "58%" }}
                />
              </div>
            </div>
            <div className="mt-6 flex items-center gap-3 rounded-xl bg-info/10 p-3 text-sm text-info-foreground">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-info/20 text-info">
                <Clock className="h-4 w-4" />
              </span>
              <p>
                <span className="font-semibold">Heads up —</span> Dr. Khan is running about 5 mins
                late.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">Built for everyone in the room</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Users,
              title: "For patients",
              body: "Find doctors, book slots, and track your queue live from your phone.",
            },
            {
              icon: Stethoscope,
              title: "For doctors",
              body: "See today's schedule, call the next patient, and signal delays instantly.",
            },
            {
              icon: Activity,
              title: "For admins",
              body: "Monitor wait times, peak hours, and manage doctors from one dashboard.",
            },
          ].map((f) => (
            <div key={f.title} className="card-elev p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-lg font-bold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} MediQueue — a modern hospital experience.
      </footer>
    </div>
  );
}
