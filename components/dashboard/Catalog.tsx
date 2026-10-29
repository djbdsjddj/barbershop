"use client";

import { useState } from "react";
import { Pencil, Plus, Star, Trash2 } from "lucide-react";
import { formatPrice, useBarberSync, type Barber, type Service, type ServiceCategory } from "@/lib/store";
import { Avatar, Field, Modal, PORTRAIT_PRESETS, PhotoPicker, cn } from "@/components/ui";

const CATEGORIES: ServiceCategory[] = ["Haircuts", "Beard", "Combos", "VIP"];

export function Catalog() {
  const [tab, setTab] = useState<"services" | "team">("services");
  return (
    <div className="space-y-5">
      <div className="flex w-fit rounded-control border border-line bg-surface p-0.5 text-sm">
        {(["services", "team"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("rounded-[8px] px-4 py-1.5 font-medium", tab === t ? "bg-raised text-ink" : "text-ink-muted hover:text-ink")}>
            {t === "services" ? "Services" : "Barber team"}
          </button>
        ))}
      </div>
      {tab === "services" ? <Services /> : <Team />}
    </div>
  );
}

type ServiceDraft = Omit<Service, "id"> & { id?: string };

function Services() {
  const store = useBarberSync();
  const [draft, setDraft] = useState<ServiceDraft | null>(null);
  const [error, setError] = useState("");
  const activeIds = store.barbers.filter((b) => b.active).map((b) => b.id);

  const save = () => {
    if (!draft) return;
    if (!draft.name.trim()) return setError("Add a service name.");
    if (draft.price < 0) return setError("Price can't be negative.");
    if (draft.durationMinutes < 5) return setError("Duration must be at least 5 minutes.");
    if (!draft.barberIds.length) return setError("Pick at least one barber who offers this service.");
    const { id, ...fields } = draft;
    if (id) store.updateService(id, { ...fields, name: fields.name.trim() });
    else store.addService({ ...fields, name: fields.name.trim() });
    setDraft(null);
  };

  return (
    <>
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => { setError(""); setDraft({ name: "", category: "Haircuts", price: 5000, durationMinutes: 30, description: "", barberIds: activeIds }); }}>
          <Plus className="h-4 w-4" /> Add service
        </button>
      </div>
      {CATEGORIES.map((cat) => {
        const list = store.services.filter((s) => s.category === cat);
        if (!list.length) return null;
        return (
          <section key={cat}>
            <h3 className="mb-2 text-sm text-ink-muted">{cat}</h3>
            <ul className="card divide-y divide-line">
              {list.map((s) => (
                <li key={s.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{s.name}</p>
                    <p className="truncate text-xs text-ink-muted">{s.description || "No description"}</p>
                  </div>
                  <span className="font-mono text-xs text-ink-faint">{s.durationMinutes} min</span>
                  <span className="w-24 text-right font-mono text-sm">{formatPrice(s.price, store.profile.currency)}</span>
                  <button className="rounded-control p-2 text-ink-muted hover:bg-raised hover:text-ink" aria-label={`Edit ${s.name}`} onClick={() => { setError(""); setDraft({ ...s }); }}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button className="rounded-control p-2 text-ink-muted hover:bg-raised hover:text-status-cancelled" aria-label={`Delete ${s.name}`} onClick={() => confirm(`Delete "${s.name}"? Past bookings keep their price.`) && store.deleteService(s.id)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {store.services.length === 0 && <div className="card p-10 text-center text-sm text-ink-muted">No services yet. Add one so clients can book.</div>}

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? "Edit service" : "New service"}>
        {draft && (
          <div className="space-y-4">
            <Field label="Name"><input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Category">
                <select className="input" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as ServiceCategory })}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label={`Price (${store.profile.currency})`}><input className="input font-mono" type="number" min={0} value={draft.price} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} /></Field>
              <Field label="Minutes"><input className="input font-mono" type="number" min={5} step={5} value={draft.durationMinutes} onChange={(e) => setDraft({ ...draft, durationMinutes: Number(e.target.value) })} /></Field>
            </div>
            <Field label="Description"><textarea className="input min-h-[72px]" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field>
            <Field label="Offered by">
              <div className="flex flex-wrap gap-2">
                {store.barbers.map((b) => {
                  const on = draft.barberIds.includes(b.id);
                  return (
                    <button key={b.id} type="button" aria-pressed={on} onClick={() => setDraft({ ...draft, barberIds: on ? draft.barberIds.filter((x) => x !== b.id) : [...draft.barberIds, b.id] })} className={cn("flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs", on ? "border-brass bg-brass/10 text-brass" : "border-line text-ink-muted")}>
                      <Avatar src={b.avatarUrl} name={b.name} className="h-6 w-6" /> {b.name}
                    </button>
                  );
                })}
              </div>
            </Field>
            {error && <p className="text-sm text-status-cancelled" role="alert">{error}</p>}
            <button className="btn-primary w-full" onClick={save}>{draft.id ? "Save service" : "Add service"}</button>
          </div>
        )}
      </Modal>
    </>
  );
}

type BarberDraft = Omit<Barber, "id" | "specialties"> & { id?: string; specialties: string };

function Team() {
  const store = useBarberSync();
  const [draft, setDraft] = useState<BarberDraft | null>(null);
  const [error, setError] = useState("");

  const save = () => {
    if (!draft) return;
    if (!draft.name.trim()) return setError("Add the barber's name.");
    const { id, ...rest } = draft;
    const fields = { ...rest, name: rest.name.trim(), specialties: rest.specialties.split(",").map((s) => s.trim()).filter(Boolean) };
    if (id) store.updateBarber(id, fields);
    else {
      const created = store.addBarber(fields);
      // New barbers offer every service by default; untick in the service editor.
      store.services.forEach((s) => store.updateService(s.id, { barberIds: [...s.barberIds, created.id] }));
    }
    setDraft(null);
  };

  return (
    <>
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => { setError(""); setDraft({ name: "", role: "Barber", avatarUrl: PORTRAIT_PRESETS[3], rating: 5, specialties: "", active: true }); }}>
          <Plus className="h-4 w-4" /> Add barber
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {store.barbers.map((b) => (
          <article key={b.id} className={cn("card p-5", !b.active && "opacity-60")}>
            <div className="flex items-start gap-3">
              <Avatar src={b.avatarUrl} name={b.name} className="h-12 w-12" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{b.name}</p>
                <p className="text-xs text-ink-muted">{b.role}</p>
                <p className="mt-1 flex items-center gap-1 font-mono text-xs text-brass"><Star className="h-3 w-3 fill-current" />{b.rating.toFixed(2)}</p>
              </div>
              <span className={cn("badge", b.active ? "border-status-completed/30 text-status-completed" : "border-line text-ink-faint")}>{b.active ? "Active" : "Off"}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {b.specialties.map((s) => <span key={s} className="rounded-full bg-raised px-2 py-0.5 text-2xs text-ink-muted">{s}</span>)}
            </div>
            <div className="mt-4 flex gap-2">
              <button className="btn-ghost flex-1 py-2 text-xs" onClick={() => { setError(""); setDraft({ ...b, specialties: b.specialties.join(", ") }); }}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <button
                className="btn-ghost py-2 text-xs hover:text-status-cancelled"
                aria-label={`Remove ${b.name}`}
                onClick={() => confirm(`Remove ${b.name} from the team? Their past appointments stay in history.`) && store.deleteBarber(b.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </article>
        ))}
      </div>

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? "Edit barber" : "New barber"}>
        {draft && (
          <div className="space-y-4">
            <Field label="Photo"><PhotoPicker value={draft.avatarUrl} name={draft.name} onChange={(url) => setDraft({ ...draft, avatarUrl: url })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name"><input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
              <Field label="Role"><input className="input" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} /></Field>
            </div>
            <Field label="Specialties" hint="Separate with commas"><input className="input" value={draft.specialties} onChange={(e) => setDraft({ ...draft, specialties: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-brass" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
              Taking bookings
            </label>
            {error && <p className="text-sm text-status-cancelled" role="alert">{error}</p>}
            <button className="btn-primary w-full" onClick={save}>{draft.id ? "Save barber" : "Add barber"}</button>
          </div>
        )}
      </Modal>
    </>
  );
}
