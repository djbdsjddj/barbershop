"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { useBarberSync, type StudioProfile } from "@/lib/store";
import { CURRENCIES, Field, PhotoPicker, slugify, timeOptions } from "@/components/ui";

export function Settings() {
  const store = useBarberSync();
  const p = store.profile;
  const [hoursError, setHoursError] = useState("");
  // Every edit saves straight to the store (and other tabs).
  const set = <K extends keyof StudioProfile>(key: K, value: StudioProfile[K]) => store.updateStudioProfile({ [key]: value } as Partial<StudioProfile>);

  const setHours = (key: "openTime" | "closeTime", value: string) => {
    const next = { openTime: p.openTime, closeTime: p.closeTime, [key]: value };
    if (next.openTime >= next.closeTime) return setHoursError("Closing time must be after opening time.");
    setHoursError("");
    set(key, value);
  };

  return (
    <div className="max-w-3xl space-y-5">
      <p className="text-sm text-ink-muted">Changes save as you type and show on your booking page right away.</p>
      <section className="card space-y-5 p-6">
        <Field label="Studio photo">
          <PhotoPicker value={p.avatarUrl} name={p.salonName} onChange={(url) => set("avatarUrl", url)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Studio name"><input className="input" value={p.salonName} onChange={(e) => set("salonName", e.target.value)} /></Field>
          <Field label="Owner name"><input className="input" value={p.ownerName} onChange={(e) => set("ownerName", e.target.value)} /></Field>
        </div>
        <Field label="Booking link" hint="Changing this breaks links you've already shared.">
          <div className="flex items-center rounded-control border border-line bg-raised focus-within:border-brass">
            <span className="pl-3.5 font-mono text-xs text-ink-faint">barbersync.app/book/</span>
            <input className="w-full bg-transparent py-2.5 pr-3.5 font-mono text-sm outline-none" value={p.slug} onChange={(e) => set("slug", slugify(e.target.value))} onBlur={() => !p.slug && set("slug", "studio")} />
          </div>
        </Field>
        <Field label="Bio"><textarea className="input min-h-[80px]" maxLength={240} value={p.bio} onChange={(e) => set("bio", e.target.value)} /></Field>
      </section>

      <section className="card grid gap-4 p-6 sm:grid-cols-2">
        <Field label="Phone / WhatsApp"><input className="input font-mono" type="tel" value={p.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="Email"><input className="input" type="email" value={p.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="City"><input className="input" value={p.city} onChange={(e) => set("city", e.target.value)} /></Field>
        <Field label="Street address"><input className="input" value={p.address} onChange={(e) => set("address", e.target.value)} /></Field>
      </section>

      <section className="card grid gap-4 p-6 sm:grid-cols-4">
        <Field label="Currency">
          <select className="input" value={p.currency} onChange={(e) => set("currency", e.target.value as StudioProfile["currency"])}>
            {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Opens">
          <select className="input font-mono" value={p.openTime} onChange={(e) => setHours("openTime", e.target.value)}>
            {timeOptions().map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Closes">
          <select className="input font-mono" value={p.closeTime} onChange={(e) => setHours("closeTime", e.target.value)}>
            {timeOptions().map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Slot step">
          <select className="input font-mono" value={p.slotInterval} onChange={(e) => set("slotInterval", Number(e.target.value))}>
            {[15, 30, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
          </select>
        </Field>
        {hoursError && <p className="text-sm text-status-cancelled sm:col-span-4" role="alert">{hoursError}</p>}
      </section>

      <section className="card flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h3 className="text-sm">Reset demo data</h3>
          <p className="text-xs text-ink-muted">Restores the sample studio, team, services and bookings in every open tab.</p>
        </div>
        <button className="btn-ghost text-status-cancelled" onClick={() => confirm("Replace everything with the demo data? Your changes will be lost.") && store.resetDemoData()}>
          <RotateCcw className="h-4 w-4" /> Reset
        </button>
      </section>
    </div>
  );
}
