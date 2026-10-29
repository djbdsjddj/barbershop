"use client";

import { useEffect, useMemo, useState } from "react";
import { Coffee, UserRound } from "lucide-react";
import {
  formatPrice,
  fromMinutes,
  normalizePhone,
  toDateKey,
  toMinutes,
  useBarberSync,
  type PaymentMethod,
} from "@/lib/store";
import { Field, Modal, cn } from "@/components/ui";

export interface ReservationPrefill {
  barberId?: string;
  date?: string;
  time?: string;
  clientName?: string;
  clientPhone?: string;
}

const BLOCK_DURATIONS = [30, 60, 90, 120, 180];
const PAYMENT_LABEL: Record<PaymentMethod, string> = { venue: "At the venue", kaspi_qr: "Kaspi QR", card: "Card" };

export function ReservationModal({ prefill, onClose }: { prefill: ReservationPrefill | null; onClose: () => void }) {
  const store = useBarberSync();
  const activeBarbers = store.barbers.filter((b) => b.active);

  const [kind, setKind] = useState<"client" | "block">("client");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [barberId, setBarberId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(toDateKey(new Date()));
  const [time, setTime] = useState("");
  const [blockMinutes, setBlockMinutes] = useState(60);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("venue");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  // Reset the form every time the modal opens.
  useEffect(() => {
    if (!prefill) return;
    const barber = prefill.barberId ?? activeBarbers[0]?.id ?? "";
    setKind("client");
    setClientName(prefill.clientName ?? "");
    setClientPhone(prefill.clientPhone ?? "");
    setBarberId(barber);
    setServiceId(store.services.find((s) => s.barberIds.includes(barber))?.id ?? "");
    setDate(prefill.date ?? toDateKey(new Date()));
    setTime(prefill.time ?? "");
    setBlockMinutes(60);
    setPaymentMethod("venue");
    setNotes("");
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  const barberServices = store.services.filter((s) => s.barberIds.includes(barberId));
  const service = store.services.find((s) => s.id === serviceId);
  const duration = kind === "block" ? blockMinutes : service?.durationMinutes ?? 30;

  // Staff can book any free time, including earlier today, unlike the public page.
  const slots = useMemo(() => {
    const out: { time: string; free: boolean }[] = [];
    const open = toMinutes(store.profile.openTime);
    const close = toMinutes(store.profile.closeTime);
    for (let t = open; t + duration <= close; t += store.profile.slotInterval || 30) {
      const hhmm = fromMinutes(t);
      out.push({ time: hhmm, free: !!barberId && store.isSlotAvailable(barberId, date, hhmm, duration) });
    }
    return out;
  }, [store, barberId, date, duration]);

  const clients = useMemo(() => store.getDerivedClients(), [store]);

  const save = () => {
    if (!barberId) return setError("Choose a barber.");
    if (!time) return setError("Choose a time.");
    if (!store.isSlotAvailable(barberId, date, time, duration)) return setError("That time overlaps another booking. Pick a free slot.");
    if (kind === "client") {
      if (!clientName.trim()) return setError("Add the client's name.");
      if (normalizePhone(clientPhone).length < 7) return setError("Add a phone number with at least 7 digits.");
      if (!service) return setError("Choose a service.");
    }
    store.addAppointment({
      clientName: kind === "block" ? "Blocked" : clientName.trim(),
      clientPhone: kind === "block" ? "" : clientPhone.trim(),
      clientNotes: notes.trim() || (kind === "block" ? "Break" : ""),
      barberId,
      serviceId: kind === "block" ? "" : service!.id,
      date,
      time,
      durationMinutes: duration,
      price: kind === "block" ? 0 : service!.price,
      paymentMethod,
      status: kind === "block" ? "blocked" : "confirmed",
      source: "walk-in",
    });
    onClose();
  };

  return (
    <Modal open={!!prefill} onClose={onClose} title="New walk-in or time block" variant="drawer">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-1 rounded-control border border-line bg-canvas p-1 text-sm">
          {([
            ["client", "Walk-in / phone booking", UserRound],
            ["block", "Time block", Coffee],
          ] as const).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              onClick={() => { setKind(value); setTime(""); }}
              className={cn("flex items-center justify-center gap-2 rounded-[8px] px-2 py-2 font-medium", kind === value ? "bg-raised text-ink" : "text-ink-muted hover:text-ink")}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        {kind === "client" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client name" hint="Start typing to pick an existing client">
              <input
                className="input"
                list="crm-clients"
                value={clientName}
                onChange={(e) => {
                  setClientName(e.target.value);
                  const match = clients.find((c) => c.name === e.target.value);
                  if (match) setClientPhone(match.phone);
                }}
              />
              <datalist id="crm-clients">
                {clients.map((c) => <option key={c.phone} value={c.name}>{c.phone}</option>)}
              </datalist>
            </Field>
            <Field label="Phone / WhatsApp">
              <input className="input font-mono" type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
            </Field>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Barber">
            <select
              className="input"
              value={barberId}
              onChange={(e) => {
                setBarberId(e.target.value);
                setTime("");
                if (!store.services.find((s) => s.id === serviceId)?.barberIds.includes(e.target.value)) {
                  setServiceId(store.services.find((s) => s.barberIds.includes(e.target.value))?.id ?? "");
                }
              }}
            >
              {activeBarbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Date">
            <input className="input font-mono" type="date" value={date} onChange={(e) => { setDate(e.target.value); setTime(""); }} />
          </Field>
          {kind === "client" ? (
            <Field label="Service" className="sm:col-span-2">
              <select className="input" value={serviceId} onChange={(e) => { setServiceId(e.target.value); setTime(""); }}>
                {barberServices.length === 0 && <option value="">This barber has no services</option>}
                {barberServices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.durationMinutes} min · {formatPrice(s.price, store.profile.currency)}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Length" className="sm:col-span-2">
              <div className="flex flex-wrap gap-2">
                {BLOCK_DURATIONS.map((m) => (
                  <button key={m} type="button" onClick={() => { setBlockMinutes(m); setTime(""); }} className={cn("rounded-control border px-3 py-1.5 font-mono text-xs", blockMinutes === m ? "border-brass bg-brass/10 text-brass" : "border-line text-ink-muted hover:text-ink")}>
                    {m} min
                  </button>
                ))}
              </div>
            </Field>
          )}
        </div>

        <Field label={`Start time · ${duration} min`}>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {slots.map((s) => (
              <button
                key={s.time}
                type="button"
                disabled={!s.free}
                onClick={() => setTime(s.time)}
                className={cn(
                  "rounded-control border py-1.5 font-mono text-xs",
                  time === s.time ? "border-brass bg-brass text-brass-ink" : s.free ? "border-line text-ink hover:border-brass" : "cursor-not-allowed border-transparent bg-canvas text-ink-faint line-through"
                )}
              >
                {s.time}
              </button>
            ))}
          </div>
        </Field>

        {kind === "client" && (
          <Field label="Payment">
            <div className="flex gap-2">
              {(Object.keys(PAYMENT_LABEL) as PaymentMethod[]).map((p) => (
                <button key={p} type="button" onClick={() => setPaymentMethod(p)} className={cn("flex-1 rounded-control border px-2 py-2 text-xs font-medium", paymentMethod === p ? "border-brass bg-brass/10 text-brass" : "border-line text-ink-muted hover:text-ink")}>
                  {PAYMENT_LABEL[p]}
                </button>
              ))}
            </div>
          </Field>
        )}

        <Field label={kind === "block" ? "Reason" : "Notes"}>
          <input className="input" placeholder={kind === "block" ? "Lunch, school run, training…" : "Cut request, allergies…"} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {error && <p className="text-sm text-status-cancelled" role="alert">{error}</p>}

        <button type="button" className="btn-primary w-full" onClick={save}>
          {kind === "block" ? "Block time" : "Save booking"}
        </button>
      </div>
    </Modal>
  );
}
