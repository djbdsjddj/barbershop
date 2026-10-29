"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, Clock, LayoutDashboard, MapPin, Plus, Scissors, Star, Trash2 } from "lucide-react";
import { formatPrice, useBarberSync, type StudioProfile } from "@/lib/store";
import { CURRENCIES, Field, Loading, PhotoPicker, cn, slugify, timeOptions, Avatar } from "@/components/ui";

type DraftService = { id?: string; name: string; price: number; durationMinutes: number };
type Mode = "signin" | "register";

const STEPS = ["Identity & photo", "Hours & menu", "Review & launch"];

export default function HomePage() {
  const store = useBarberSync();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("register");
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<StudioProfile>(store.profile);
  const [services, setServices] = useState<DraftService[]>([]);
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState("");

  // Start the wizard from whatever the store holds once localStorage is loaded.
  useEffect(() => {
    if (!store.hydrated) return;
    setDraft(store.profile);
    setServices(store.services.map(({ id, name, price, durationMinutes }) => ({ id, name, price, durationMinutes })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.hydrated]);

  if (!store.hydrated) return <Loading />;

  const set = <K extends keyof StudioProfile>(key: K, value: StudioProfile[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const validateStep = () => {
    if (step === 0) {
      if (!draft.ownerName.trim() || !draft.salonName.trim()) return "Add your name and the studio name.";
      if (!draft.slug) return "Add a booking link.";
      if (draft.phone.replace(/\D/g, "").length < 7) return "Add a phone number clients can reach on WhatsApp.";
    }
    if (step === 1) {
      if (draft.openTime >= draft.closeTime) return "Closing time must be after opening time.";
      const valid = services.filter((s) => s.name.trim());
      if (!valid.length) return "Add at least one service.";
      if (valid.some((s) => s.price < 0 || s.durationMinutes < 5)) return "Each service needs a price and a duration of 5 minutes or more.";
    }
    return "";
  };

  const next = () => {
    const msg = validateStep();
    setError(msg);
    if (!msg) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const launch = () => {
    const oldOwner = store.profile.ownerName;
    store.updateStudioProfile({ ...draft, slug: slugify(draft.slug) || "studio" });

    const owner = store.barbers.find((b) => b.name === oldOwner);
    if (owner) store.updateBarber(owner.id, { name: draft.ownerName, avatarUrl: draft.avatarUrl || owner.avatarUrl });

    const kept = services.filter((s) => s.name.trim());
    const keptIds = new Set(kept.map((s) => s.id).filter(Boolean));
    store.services.filter((s) => !keptIds.has(s.id)).forEach((s) => store.deleteService(s.id));
    const activeIds = store.barbers.filter((b) => b.active).map((b) => b.id);
    kept.forEach((s) => {
      const fields = { name: s.name.trim(), price: Number(s.price) || 0, durationMinutes: Number(s.durationMinutes) || 30 };
      if (s.id) store.updateService(s.id, fields);
      else store.addService({ ...fields, category: "Haircuts", description: "", barberIds: activeIds });
    });
    router.push("/dashboard");
  };

  const previewServices = services.filter((s) => s.name.trim()).slice(0, 3);

  return (
    <div className="min-h-screen">
      <header className="glass-header">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-control bg-gradient-to-br from-brass-hover to-brass-deep text-brass-ink">
              <Scissors className="h-4 w-4" />
            </span>
            BarberSync
          </Link>
          <nav className="flex flex-1 flex-wrap items-center gap-1 text-sm text-ink-muted">
            <Link href="/dashboard" className="flex items-center gap-1.5 rounded-control px-3 py-1.5 hover:bg-raised hover:text-ink">
              <LayoutDashboard className="h-4 w-4" /> Live demo dashboard
            </Link>
            <Link href={`/book/${store.profile.slug}`} className="flex items-center gap-1.5 rounded-control px-3 py-1.5 hover:bg-raised hover:text-ink">
              <CalendarClock className="h-4 w-4" /> Live client booking page
            </Link>
          </nav>
          <div className="flex rounded-control border border-line bg-surface p-0.5 text-sm" role="tablist">
            {(["signin", "register"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => { setMode(m); setError(""); }}
                className={cn("rounded-[8px] px-3.5 py-1.5 font-medium", mode === m ? "bg-raised text-ink" : "text-ink-muted hover:text-ink")}
              >
                {m === "signin" ? "Sign in" : "Create studio"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:py-16">
        {/* Left: editorial + live preview */}
        <section className="space-y-10">
          <div className="space-y-6">
            <h1 className="max-w-xl text-4xl font-bold leading-[1.05] tracking-[-0.035em] sm:text-display">
              Every chair booked, every client remembered.
            </h1>
            <p className="max-w-md text-base leading-relaxed text-ink-muted">
              Online booking, a live timetable for the whole team, client cut notes and revenue in one place. Built for barbershops that run on WhatsApp and walk-ins.
            </p>
          </div>

          <dl className="grid max-w-xl grid-cols-3 border-y border-line">
            {[
              ["0%", "commission on bookings"],
              ["30s", "client checkout"],
              ["Live", "multi-chair timetable & CRM"],
            ].map(([value, label], i) => (
              <div key={label} className={cn("py-5 pr-4", i > 0 && "border-l border-line pl-4")}>
                <dt className="font-mono text-2xl font-semibold text-brass">{value}</dt>
                <dd className="mt-1 text-xs leading-snug text-ink-muted">{label}</dd>
              </div>
            ))}
          </dl>

          {/* Live studio card */}
          <div className="max-w-xl">
            <p className="mb-3 text-xs text-ink-faint">What clients see, updating as you type</p>
            <article className="card overflow-hidden shadow-card">
              <div className="flex items-start gap-4 p-5">
                <Avatar src={draft.avatarUrl} name={draft.salonName || "Studio"} className="h-16 w-16 rounded-card ring-1 ring-line" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="truncate text-lg">{draft.salonName || "Your studio"}</h2>
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-raised px-2 py-0.5 font-mono text-xs text-brass">
                      <Star className="h-3 w-3 fill-current" /> {draft.rating.toFixed(2)}
                    </span>
                  </div>
                  <p className="mt-1 truncate font-mono text-xs text-ink-muted">barbersync.app/book/{slugify(draft.slug) || "…"}</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                    <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{[draft.address, draft.city].filter(Boolean).join(", ") || "Address"}</span>
                    <span className="flex items-center gap-1.5 font-mono"><Clock className="h-3.5 w-3.5" />{draft.openTime}–{draft.closeTime}</span>
                  </div>
                </div>
              </div>
              {draft.bio && <p className="border-t border-line px-5 py-3 text-sm leading-relaxed text-ink-muted line-clamp-2">{draft.bio}</p>}
              <ul className="divide-y divide-line border-t border-line">
                {previewServices.length === 0 && <li className="px-5 py-3 text-sm text-ink-faint">Add services in step 2</li>}
                {previewServices.map((s, i) => (
                  <li key={s.id ?? i} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span>{s.name}</span>
                    <span className="flex items-center gap-4 font-mono text-xs">
                      <span className="text-ink-faint">{s.durationMinutes} min</span>
                      <span className="text-ink">{formatPrice(Number(s.price) || 0, draft.currency)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        {/* Right: auth / wizard */}
        <section className="lg:pt-2">
          <div className="card p-6 sm:p-8">
            {mode === "signin" ? (
              <SignIn onDone={() => router.push("/dashboard")} defaultEmail={store.profile.email} />
            ) : (
              <>
                <ol className="mb-8 flex gap-2">
                  {STEPS.map((label, i) => (
                    <li key={label} className="flex-1">
                      <div className={cn("h-1 rounded-full", i <= step ? "bg-brass" : "bg-line")} />
                      <p className={cn("mt-2 text-xs", i === step ? "text-ink" : "text-ink-faint")}>
                        <span className="font-mono">{i + 1}</span> {label}
                      </p>
                    </li>
                  ))}
                </ol>

                {step === 0 && (
                  <div className="space-y-5">
                    <Field label="Studio or master photo">
                      <PhotoPicker value={draft.avatarUrl} name={draft.salonName} onChange={(url) => set("avatarUrl", url)} />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Your name">
                        <input className="input" value={draft.ownerName} onChange={(e) => set("ownerName", e.target.value)} />
                      </Field>
                      <Field label="Studio name">
                        <input
                          className="input"
                          value={draft.salonName}
                          onChange={(e) => {
                            set("salonName", e.target.value);
                            if (!slugTouched) set("slug", slugify(e.target.value));
                          }}
                        />
                      </Field>
                    </div>
                    <Field label="Booking link">
                      <div className="flex items-center rounded-control border border-line bg-raised focus-within:border-brass">
                        <span className="pl-3.5 font-mono text-xs text-ink-faint">barbersync.app/book/</span>
                        <input
                          className="w-full bg-transparent py-2.5 pr-3.5 font-mono text-sm outline-none"
                          value={draft.slug}
                          onChange={(e) => { setSlugTouched(true); set("slug", slugify(e.target.value)); }}
                        />
                      </div>
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Phone / WhatsApp">
                        <input className="input font-mono" type="tel" value={draft.phone} onChange={(e) => set("phone", e.target.value)} />
                      </Field>
                      <Field label="Currency">
                        <select className="input" value={draft.currency} onChange={(e) => set("currency", e.target.value as StudioProfile["currency"])}>
                          {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      </Field>
                      <Field label="City">
                        <input className="input" value={draft.city} onChange={(e) => set("city", e.target.value)} />
                      </Field>
                      <Field label="Street address">
                        <input className="input" value={draft.address} onChange={(e) => set("address", e.target.value)} />
                      </Field>
                    </div>
                    <Field label="Short bio">
                      <textarea className="input min-h-[80px] resize-y" maxLength={240} value={draft.bio} onChange={(e) => set("bio", e.target.value)} />
                    </Field>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Opens">
                        <select className="input font-mono" value={draft.openTime} onChange={(e) => set("openTime", e.target.value)}>
                          {timeOptions().map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </Field>
                      <Field label="Closes">
                        <select className="input font-mono" value={draft.closeTime} onChange={(e) => set("closeTime", e.target.value)}>
                          {timeOptions().map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </Field>
                    </div>
                    <div>
                      <div className="mb-2 grid grid-cols-[1fr_96px_80px_32px] gap-2 text-xs text-ink-muted">
                        <span>Service</span><span>Price</span><span>Minutes</span><span />
                      </div>
                      <div className="space-y-2">
                        {services.map((s, i) => (
                          <div key={s.id ?? `new-${i}`} className="grid grid-cols-[1fr_96px_80px_32px] gap-2">
                            <input className="input" aria-label="Service name" value={s.name} onChange={(e) => setServices((list) => list.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                            <input className="input font-mono" aria-label="Price" type="number" min={0} value={s.price} onChange={(e) => setServices((list) => list.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) } : x)))} />
                            <input className="input font-mono" aria-label="Duration in minutes" type="number" min={5} step={5} value={s.durationMinutes} onChange={(e) => setServices((list) => list.map((x, j) => (j === i ? { ...x, durationMinutes: Number(e.target.value) } : x)))} />
                            <button type="button" aria-label={`Remove ${s.name || "service"}`} onClick={() => setServices((list) => list.filter((_, j) => j !== i))} className="flex items-center justify-center rounded-control text-ink-faint hover:bg-raised hover:text-status-cancelled">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={() => setServices((list) => [...list, { name: "", price: 5000, durationMinutes: 30 }])} className="btn-ghost mt-3 w-full py-2 text-xs">
                        <Plus className="h-3.5 w-3.5" /> Add service
                      </button>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <dl className="divide-y divide-line text-sm">
                    {[
                      ["Studio", draft.salonName],
                      ["Master", draft.ownerName],
                      ["Booking link", `barbersync.app/book/${slugify(draft.slug)}`],
                      ["Phone", draft.phone],
                      ["Address", [draft.address, draft.city].filter(Boolean).join(", ")],
                      ["Hours", `${draft.openTime}–${draft.closeTime}`],
                      ["Services", `${services.filter((s) => s.name.trim()).length} on the menu`],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-4 py-3">
                        <dt className="text-ink-muted">{k}</dt>
                        <dd className="text-right">{v || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                {error && <p className="mt-5 text-sm text-status-cancelled" role="alert">{error}</p>}

                <div className="mt-8 flex gap-3">
                  {step > 0 && (
                    <button type="button" className="btn-ghost" onClick={() => { setError(""); setStep((s) => s - 1); }}>
                      <ArrowLeft className="h-4 w-4" /> Back
                    </button>
                  )}
                  {step < STEPS.length - 1 ? (
                    <button type="button" className="btn-primary flex-1" onClick={next}>Continue</button>
                  ) : (
                    <button type="button" className="btn-primary flex-1" onClick={launch}>Launch studio</button>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function SignIn({ onDone, defaultEmail }: { onDone: () => void; defaultEmail: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid email address.");
        if (password.length < 4) return setError("Password must be at least 4 characters.");
        onDone();
      }}
    >
      <div>
        <h2 className="text-2xl">Sign in to your studio</h2>
        <p className="mt-1 text-sm text-ink-muted">Demo mode: any password with 4+ characters opens the dashboard.</p>
      </div>
      <Field label="Email">
        <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Password">
        <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {error && <p className="text-sm text-status-cancelled" role="alert">{error}</p>}
      <button type="submit" className="btn-primary w-full">Sign in</button>
    </form>
  );
}
