"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarPlus,
  Check,
  Clock,
  CreditCard,
  MapPin,
  MessageCircle,
  Phone,
  QrCode,
  RotateCcw,
  Sparkles,
  Star,
  Store,
  Users,
  XCircle,
} from "lucide-react";
import {
  addDays,
  formatPrice,
  fromMinutes,
  normalizePhone,
  toDateKey,
  toMinutes,
  useBarberSync,
  type Appointment,
  type PaymentMethod,
  type ServiceCategory,
} from "@/lib/store";
import { Avatar, Field, Loading, cn, waLink } from "@/components/ui";

const CATEGORIES: ("All" | ServiceCategory)[] = ["All", "Haircuts", "Beard", "Combos", "VIP"];
const PERIODS = [
  { label: "Morning", test: (m: number) => m < 12 * 60 },
  { label: "Afternoon", test: (m: number) => m >= 12 * 60 && m < 17 * 60 },
  { label: "Evening", test: (m: number) => m >= 17 * 60 },
];
const PAYMENTS: { id: PaymentMethod; title: string; detail: string; icon: typeof Store }[] = [
  { id: "venue", title: "Pay at the barbershop", detail: "Cash, card or QR in person", icon: Store },
  { id: "kaspi_qr", title: "Kaspi QR / transfer", detail: "Scan to pay a deposit now", icon: QrCode },
  { id: "card", title: "Apple Pay / bank card", detail: "Pay online by card", icon: CreditCard },
];

const longDate = (key: string) => new Date(key + "T00:00").toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" });

export default function BookingPage({ params }: { params: { slug: string } }) {
  const store = useBarberSync();
  const { profile, barbers, services } = store;

  const [barberId, setBarberId] = useState<string>("any");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(() => toDateKey(new Date()));
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("venue");
  const [error, setError] = useState("");
  const [bookedId, setBookedId] = useState<string | null>(null);

  const activeBarbers = barbers.filter((b) => b.active);
  const service = services.find((s) => s.id === serviceId);
  const visibleServices = services.filter(
    (s) => (category === "All" || s.category === category) && (barberId === "any" ? s.barberIds.some((id) => activeBarbers.some((b) => b.id === id)) : s.barberIds.includes(barberId))
  );

  const slots = useMemo(() => {
    if (!service) return [];
    return store.getAvailableSlots(barberId, date, service.durationMinutes).map((slot) => {
      // "Any" only counts barbers who actually do this service.
      const freeBarberIds = slot.freeBarberIds.filter((id) => service.barberIds.includes(id));
      return { ...slot, freeBarberIds, available: freeBarberIds.length > 0 };
    });
  }, [store, barberId, date, service]);

  // If another tab books the chosen slot, drop it.
  useEffect(() => {
    if (time && !slots.find((s) => s.time === time)?.available) setTime("");
  }, [slots, time]);

  if (!store.hydrated) return <Loading />;

  if (params.slug !== profile.slug) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl">This booking link doesn&apos;t exist</h1>
        <p className="max-w-sm text-sm text-ink-muted">The studio may have changed its link. The current one is below.</p>
        <Link href={`/book/${profile.slug}`} className="btn-primary">Open {profile.salonName}</Link>
      </div>
    );
  }

  const booked = bookedId ? store.appointments.find((a) => a.id === bookedId) ?? null : null;
  if (booked) {
    return (
      <Confirmation
        appointment={booked}
        onBookAnother={() => { setBookedId(null); setTime(""); setNote(""); }}
        onReschedule={() => { store.updateAppointmentStatus(booked.id, "cancelled"); setBookedId(null); setTime(""); }}
      />
    );
  }

  const chosenSlot = slots.find((s) => s.time === time);
  const assignedBarberId = barberId === "any" ? chosenSlot?.freeBarberIds[0] : barberId;
  const assignedBarber = barbers.find((b) => b.id === assignedBarberId);
  const phoneOk = normalizePhone(phone).length >= 10;
  const missing = !service ? "Choose a service" : !time ? "Pick a time" : !name.trim() ? "Add your name" : !phoneOk ? "Add your WhatsApp number" : "";

  const confirm = () => {
    if (missing || !service || !assignedBarberId) return setError(missing || "Pick a time");
    if (!store.isSlotAvailable(assignedBarberId, date, time, service.durationMinutes)) {
      setTime("");
      return setError("Someone just took that time. Pick another slot.");
    }
    const apt = store.addAppointment({
      clientName: name.trim(),
      clientPhone: phone.trim(),
      clientNotes: note.trim(),
      barberId: assignedBarberId,
      serviceId: service.id,
      date,
      time,
      durationMinutes: service.durationMinutes,
      price: service.price,
      paymentMethod: payment,
      status: "confirmed",
      source: "online",
    });
    setError("");
    setBookedId(apt.id);
    window.scrollTo({ top: 0 });
  };

  const days = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i));

  return (
    <div className="min-h-screen pb-40">
      {/* Studio banner */}
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-3xl px-4 pb-6 pt-4 sm:px-6">
          <div className="flex justify-end">
            <Link href="/dashboard" className="text-xs text-ink-faint hover:text-ink">Barber admin</Link>
          </div>
          <div className="mt-2 flex flex-col gap-5 sm:flex-row sm:items-center">
            <Avatar src={profile.avatarUrl} name={profile.salonName} className="h-20 w-20 rounded-card ring-1 ring-line" />
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-bold tracking-[-0.03em]">{profile.salonName}</h1>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink-muted">
                <span className="flex items-center gap-1.5 font-mono text-brass"><Star className="h-3.5 w-3.5 fill-current" />{profile.rating.toFixed(2)} <span className="text-ink-faint">({profile.reviewCount})</span></span>
                <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{[profile.address, profile.city].filter(Boolean).join(", ")}</span>
                <span className="flex items-center gap-1.5 font-mono"><Clock className="h-3.5 w-3.5" />{profile.openTime}–{profile.closeTime}</span>
              </div>
            </div>
          </div>
          {profile.bio && <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-muted">{profile.bio}</p>}
          <div className="mt-4 flex gap-2">
            <a href={`tel:${profile.phone.replace(/[^\d+]/g, "")}`} className="btn-ghost py-2 text-xs"><Phone className="h-3.5 w-3.5" /> Call</a>
            <a href={waLink(profile.phone)} target="_blank" rel="noreferrer" className="btn-ghost py-2 text-xs"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-10 px-4 py-8 sm:px-6">
        {/* 1. Master */}
        <Section n={1} title="Choose your barber">
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            <button
              onClick={() => { setBarberId("any"); setTime(""); }}
              className={cn("flex w-44 shrink-0 snap-start flex-col items-start gap-3 rounded-card border p-4 text-left", barberId === "any" ? "border-brass bg-brass/5" : "border-line bg-surface hover:border-line-strong")}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-raised text-brass"><Users className="h-5 w-5" /></span>
              <span>
                <span className="block text-sm font-semibold">Any available</span>
                <span className="block text-xs text-ink-muted">Most free times</span>
              </span>
            </button>
            {activeBarbers.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  setBarberId(b.id);
                  setTime("");
                  if (service && !service.barberIds.includes(b.id)) setServiceId("");
                }}
                className={cn("flex w-52 shrink-0 snap-start flex-col items-start gap-3 rounded-card border p-4 text-left", barberId === b.id ? "border-brass bg-brass/5" : "border-line bg-surface hover:border-line-strong")}
              >
                <div className="flex w-full items-start justify-between">
                  <Avatar src={b.avatarUrl} name={b.name} className="h-12 w-12" />
                  <span className="flex items-center gap-1 font-mono text-xs text-brass"><Star className="h-3 w-3 fill-current" />{b.rating.toFixed(2)}</span>
                </div>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{b.name}</span>
                  <span className="block text-xs text-ink-muted">{b.role}</span>
                </span>
                <span className="line-clamp-2 text-2xs text-ink-faint">{b.specialties.join(", ")}</span>
              </button>
            ))}
          </div>
        </Section>

        {/* 2. Service */}
        <Section n={2} title="Pick a service">
          <div className="mb-4 flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCategory(c)} className={cn("rounded-full border px-3.5 py-1 text-xs font-medium", category === c ? "border-brass bg-brass text-brass-ink" : "border-line text-ink-muted hover:text-ink")}>
                {c}
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {visibleServices.map((s) => (
              <button
                key={s.id}
                onClick={() => { setServiceId(s.id); setTime(""); }}
                aria-pressed={serviceId === s.id}
                className={cn("flex flex-col gap-2 rounded-card border p-4 text-left", serviceId === s.id ? "border-brass bg-brass/5" : "border-line bg-surface hover:border-line-strong")}
              >
                <div className="flex w-full items-start justify-between gap-3">
                  <span className="font-semibold">{s.name}</span>
                  <span className="shrink-0 font-mono text-sm">{formatPrice(s.price, profile.currency)}</span>
                </div>
                <span className="text-xs leading-relaxed text-ink-muted">{s.description}</span>
                <span className="w-fit rounded-full bg-raised px-2 py-0.5 font-mono text-2xs text-ink-muted">{s.durationMinutes} min</span>
              </button>
            ))}
            {visibleServices.length === 0 && <p className="text-sm text-ink-muted">No services in this category for the chosen barber.</p>}
          </div>
        </Section>

        {/* 3. Date & time */}
        <Section n={3} title="Choose a date and time">
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {days.map((d) => {
              const key = toDateKey(d);
              return (
                <button
                  key={key}
                  onClick={() => { setDate(key); setTime(""); }}
                  className={cn("flex w-16 shrink-0 flex-col items-center rounded-control border py-2", key === date ? "border-brass bg-brass text-brass-ink" : "border-line bg-surface text-ink-muted hover:text-ink")}
                >
                  <span className="text-2xs">{d.toLocaleDateString("en-US", { weekday: "short" })}</span>
                  <span className="font-mono text-lg font-semibold leading-tight">{d.getDate()}</span>
                  <span className="text-2xs">{d.toLocaleDateString("en-US", { month: "short" })}</span>
                </button>
              );
            })}
          </div>
          {!service ? (
            <p className="mt-4 text-sm text-ink-muted">Pick a service to see free times.</p>
          ) : slots.every((s) => !s.available) ? (
            <p className="mt-4 text-sm text-ink-muted">No free times on {longDate(date)}. Try another day{barberId !== "any" ? " or any available barber" : ""}.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {PERIODS.map((p) => {
                const list = slots.filter((s) => p.test(toMinutes(s.time)));
                if (!list.length) return null;
                return (
                  <div key={p.label}>
                    <p className="mb-2 text-xs text-ink-faint">{p.label}</p>
                    <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                      {list.map((s) => (
                        <button
                          key={s.time}
                          disabled={!s.available}
                          onClick={() => setTime(s.time)}
                          aria-label={s.available ? `Book ${s.time}` : `${s.time} booked`}
                          className={cn(
                            "rounded-control border py-2 font-mono text-sm",
                            time === s.time ? "border-brass bg-brass text-brass-ink" : s.available ? "border-line bg-surface hover:border-brass" : "cursor-not-allowed border-transparent bg-canvas text-ink-faint/60 line-through"
                          )}
                        >
                          {s.time}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* 4. Details & payment */}
        <Section n={4} title="Your details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name"><input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="WhatsApp number"><input className="input font-mono" type="tel" autoComplete="tel" placeholder="+7 7__ ___ __ __" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
            <Field label="Cut request (optional)" className="sm:col-span-2">
              <input className="input" placeholder="Low fade, keep length on top" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>

          <p className="mb-2 mt-6 text-xs font-medium text-ink-muted">Payment</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {PAYMENTS.map(({ id, title, detail, icon: Icon }) => (
              <button key={id} onClick={() => setPayment(id)} aria-pressed={payment === id} className={cn("flex flex-col gap-2 rounded-card border p-4 text-left", payment === id ? "border-brass bg-brass/5" : "border-line bg-surface hover:border-line-strong")}>
                <Icon className={cn("h-5 w-5", payment === id ? "text-brass" : "text-ink-muted")} />
                <span className="text-sm font-semibold">{title}</span>
                <span className="text-xs text-ink-muted">{detail}</span>
              </button>
            ))}
          </div>
          {payment === "kaspi_qr" && <KaspiPreview amount={service?.price ?? 0} />}
          {payment === "card" && <CardPreview amount={service?.price ?? 0} />}
        </Section>
      </main>

      {/* Sticky checkout */}
      <div className="glass-header fixed inset-x-0 bottom-0 top-auto border-b-0 border-t">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate font-semibold">{service?.name ?? "No service yet"}</p>
            <p className="truncate text-xs text-ink-muted">
              {barberId === "any" ? (assignedBarber ? `${assignedBarber.name} (assigned)` : "Any barber") : assignedBarber?.name}
              {" · "}
              <span className="font-mono">{new Date(date + "T00:00").toLocaleDateString("en-US", { day: "numeric", month: "short" })}{time && `, ${time}`}</span>
            </p>
          </div>
          <span className="font-mono text-lg font-semibold">{formatPrice(service?.price ?? 0, profile.currency)}</span>
          <button onClick={confirm} disabled={!!missing} className="btn-primary px-6 py-3 shadow-brass disabled:shadow-none">
            {missing || "Confirm booking"}
          </button>
          {error && <p className="w-full text-sm text-status-cancelled" role="alert">{error}</p>}
        </div>
      </div>
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 flex items-baseline gap-3 text-lg">
        <span className="font-mono text-sm text-brass">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function KaspiPreview({ amount }: { amount: number }) {
  const { profile } = useBarberSync();
  return (
    <div className="mt-3 flex items-center gap-5 rounded-card border border-line bg-raised p-4">
      <div className="rounded-control bg-white p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=${encodeURIComponent(`BarberSync deposit · ${profile.salonName} · ${amount}`)}`} alt="Kaspi deposit QR code" width={88} height={88} />
      </div>
      <div className="text-sm">
        <p className="font-semibold">Scan with the Kaspi app</p>
        <p className="mt-1 text-xs text-ink-muted">Pay to {profile.salonName}. Your booking is confirmed either way; the barber checks the transfer at the chair.</p>
        <p className="mt-2 font-mono text-brass">{formatPrice(amount, profile.currency)}</p>
      </div>
    </div>
  );
}

function CardPreview({ amount }: { amount: number }) {
  const { profile } = useBarberSync();
  const [num, setNum] = useState("");
  const [exp, setExp] = useState("");
  const formatted = num.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  return (
    <div className="mt-3 grid gap-4 rounded-card border border-line bg-raised p-4 sm:grid-cols-[240px_1fr]">
      <div className="flex aspect-[1.586] flex-col justify-between rounded-card bg-gradient-to-br from-[#2a2d36] to-[#111216] p-4 ring-1 ring-line-strong">
        <div className="flex justify-between text-xs text-ink-muted"><span>{profile.salonName}</span><Sparkles className="h-4 w-4 text-brass" /></div>
        <p className="font-mono text-sm tracking-widest">{formatted || "•••• •••• •••• ••••"}</p>
        <div className="flex justify-between font-mono text-2xs text-ink-muted"><span>{exp || "MM/YY"}</span><span>{formatPrice(amount, profile.currency)}</span></div>
      </div>
      <div className="space-y-3">
        <Field label="Card number"><input className="input font-mono" inputMode="numeric" autoComplete="off" value={formatted} onChange={(e) => setNum(e.target.value)} /></Field>
        <Field label="Expiry"><input className="input font-mono" placeholder="MM/YY" maxLength={5} autoComplete="off" value={exp} onChange={(e) => setExp(e.target.value)} /></Field>
        <p className="text-2xs text-ink-faint">Demo preview: card details stay on this screen and nothing is charged.</p>
      </div>
    </div>
  );
}

// ───────── Confirmation ─────────

const icsEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");
const icsLocal = (date: string, hhmm: string) => `${date.replace(/-/g, "")}T${hhmm.replace(":", "")}00`;

function Confirmation({ appointment: a, onBookAnother, onReschedule }: { appointment: Appointment; onBookAnother: () => void; onReschedule: () => void }) {
  const store = useBarberSync();
  const { profile } = store;
  const barber = store.barbers.find((b) => b.id === a.barberId);
  const service = store.services.find((s) => s.id === a.serviceId);
  const end = fromMinutes(toMinutes(a.time) + a.durationMinutes);
  const venue = [profile.address, profile.city].filter(Boolean).join(", ");
  const cancelled = a.status === "cancelled";
  const [askCancel, setAskCancel] = useState(false);

  const downloadIcs = () => {
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//BarberSync//Booking//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${a.id}@barbersync.app`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsLocal(a.date, a.time)}`,
      `DTEND:${icsLocal(a.date, end)}`,
      `SUMMARY:${icsEscape(`${service?.name ?? "Appointment"} at ${profile.salonName}`)}`,
      `LOCATION:${icsEscape(venue)}`,
      `DESCRIPTION:${icsEscape(`Booking ${a.referenceCode} with ${barber?.name ?? "your barber"}. Call ${profile.phone} to change it.`)}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT1H",
      "ACTION:DISPLAY",
      "DESCRIPTION:Haircut in 1 hour",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${a.referenceCode}.ics`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const receipt = [
    `${profile.salonName}: booking ${a.referenceCode}`,
    `${service?.name ?? "Appointment"} with ${barber?.name ?? "your barber"}`,
    `${longDate(a.date)}, ${a.time}–${end}`,
    `${formatPrice(a.price, profile.currency)}`,
    venue,
  ].join("\n");

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-10">
      <div className="mb-6 flex items-center gap-2 text-sm">
        {cancelled ? (
          <span className="flex items-center gap-2 text-status-cancelled"><XCircle className="h-4 w-4" /> Booking cancelled. The time is free again.</span>
        ) : (
          <span className="flex items-center gap-2 text-status-completed"><Check className="h-4 w-4" /> You&apos;re booked. See you in the chair.</span>
        )}
      </div>

      {/* Boarding pass */}
      <article className={cn("w-full max-w-md overflow-hidden rounded-[20px] border border-line bg-surface shadow-card", cancelled && "opacity-60")}>
        <div className="flex items-center justify-between bg-gradient-to-r from-brass-deep via-brass to-brass-hover px-6 py-4 text-brass-ink">
          <span className="font-bold tracking-tight">{profile.salonName}</span>
          <span className="font-mono text-sm font-semibold">#{a.referenceCode}</span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-6 pt-6">
          <div>
            <p className="text-2xs text-ink-faint">Starts</p>
            <p className="font-mono text-4xl font-semibold tracking-tight">{a.time}</p>
          </div>
          <Clock className="h-5 w-5 text-ink-faint" />
          <div className="text-right">
            <p className="text-2xs text-ink-faint">Ends</p>
            <p className="font-mono text-4xl font-semibold tracking-tight text-ink-muted">{end}</p>
          </div>
        </div>
        <p className="px-6 pt-2 text-sm text-ink-muted">{longDate(a.date)}</p>

        <div className="mx-6 my-5 flex items-center gap-3 rounded-card bg-raised p-3">
          <Avatar src={barber?.avatarUrl} name={barber?.name ?? "Barber"} className="h-11 w-11" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{barber?.name ?? "Your barber"}</p>
            <p className="truncate text-xs text-ink-muted">{service?.name}</p>
          </div>
          <span className="ml-auto font-mono text-sm">{formatPrice(a.price, profile.currency)}</span>
        </div>

        {/* Perforation */}
        <div className="relative flex items-center">
          <span className="-ml-3 h-6 w-6 rounded-full border border-line bg-canvas" />
          <span className="flex-1 border-t border-dashed border-line-strong" />
          <span className="-mr-3 h-6 w-6 rounded-full border border-line bg-canvas" />
        </div>

        <dl className="grid grid-cols-2 gap-4 px-6 py-5 text-sm">
          <div className="col-span-2">
            <dt className="text-2xs text-ink-faint">Venue</dt>
            <dd>{venue}</dd>
          </div>
          <div>
            <dt className="text-2xs text-ink-faint">Client</dt>
            <dd className="truncate">{a.clientName}</dd>
          </div>
          <div>
            <dt className="text-2xs text-ink-faint">Payment</dt>
            <dd>{PAYMENTS.find((p) => p.id === a.paymentMethod)?.title}</dd>
          </div>
        </dl>
      </article>

      <div className="mt-6 grid w-full max-w-md gap-2">
        {!cancelled && (
          <>
            <button className="btn-primary" onClick={downloadIcs}><CalendarPlus className="h-4 w-4" /> Add to calendar (.ics)</button>
            <a className="btn-ghost" href={`https://wa.me/?text=${encodeURIComponent(receipt)}`} target="_blank" rel="noreferrer">
              <MessageCircle className="h-4 w-4" /> Send receipt to WhatsApp
            </a>
            {askCancel ? (
              <div className="grid grid-cols-2 gap-2 rounded-card border border-line p-2">
                <button className="btn-ghost text-status-cancelled" onClick={() => store.updateAppointmentStatus(a.id, "cancelled")}>Cancel booking</button>
                <button className="btn-ghost" onClick={onReschedule}><RotateCcw className="h-4 w-4" /> Pick a new time</button>
              </div>
            ) : (
              <button className="btn text-ink-muted hover:text-ink" onClick={() => setAskCancel(true)}>Cancel or reschedule</button>
            )}
          </>
        )}
        <button className={cn(cancelled ? "btn-primary" : "btn text-ink-muted hover:text-ink")} onClick={onBookAnother}>Book another appointment</button>
      </div>
    </div>
  );
}
