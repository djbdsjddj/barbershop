"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Globe, MessageCircle, Play, Plus, Trash2, CheckCircle2, XCircle, Footprints } from "lucide-react";
import {
  addDays,
  formatPrice,
  fromMinutes,
  toDateKey,
  toMinutes,
  useBarberSync,
  type Appointment,
  type AppointmentStatus,
} from "@/lib/store";
import { Avatar, Modal, StatusBadge, cn, waLink } from "@/components/ui";
import type { ReservationPrefill } from "./ReservationModal";

const ROW = 56; // px per 30 minutes
const STEP = 30;

const CARD_TONE: Record<AppointmentStatus, string> = {
  confirmed: "border-status-confirmed bg-status-confirmed/10",
  "in-chair": "border-status-in-chair bg-status-in-chair/10",
  completed: "border-status-completed bg-status-completed/10",
  cancelled: "border-status-cancelled bg-status-cancelled/10",
  blocked: "border-status-blocked bg-[repeating-linear-gradient(135deg,rgba(239,68,68,0.08)_0_6px,transparent_6px_12px)]",
};

export function Timetable({ onBook }: { onBook: (prefill: ReservationPrefill) => void }) {
  const store = useBarberSync();
  const { profile, services } = store;
  const today = useMemo(() => new Date(), []);
  const [stripStart, setStripStart] = useState(0); // days from today
  const [date, setDate] = useState(toDateKey(today));
  const [barberFilter, setBarberFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeBarbers = store.barbers.filter((b) => b.active);
  const columns = barberFilter === "all" ? activeBarbers : activeBarbers.filter((b) => b.id === barberFilter);

  const open = toMinutes(profile.openTime);
  const close = toMinutes(profile.closeTime);
  const rows: string[] = [];
  for (let t = open; t < close; t += STEP) rows.push(fromMinutes(t));

  const dayApts = store.appointments.filter((a) => a.date === date && a.status !== "cancelled");
  const cancelledCount = store.appointments.filter((a) => a.date === date && a.status === "cancelled").length;
  const selected = store.appointments.find((a) => a.id === selectedId) ?? null;
  const serviceName = (id: string) => services.find((s) => s.id === id)?.name ?? "Service removed";

  const strip = Array.from({ length: 9 }, (_, i) => addDays(today, stripStart + i));

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button className="btn-ghost p-2" aria-label="Earlier days" onClick={() => setStripStart((s) => s - 7)}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex gap-1 overflow-x-auto">
            {strip.map((d) => {
              const key = toDateKey(d);
              const offset = Math.round((d.getTime() - today.getTime()) / 86400000);
              const label = offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "short" });
              const count = store.appointments.filter((a) => a.date === key && a.status !== "cancelled" && a.status !== "blocked").length;
              return (
                <button
                  key={key}
                  onClick={() => setDate(key)}
                  className={cn(
                    "flex min-w-[64px] flex-col items-center rounded-control border px-2.5 py-1.5 text-xs",
                    key === date ? "border-brass bg-brass/10 text-brass" : "border-line bg-surface text-ink-muted hover:text-ink"
                  )}
                >
                  <span>{label}</span>
                  <span className="font-mono text-sm font-semibold">{d.getDate()}</span>
                  <span className={cn("font-mono text-2xs", count ? "opacity-100" : "opacity-0")}>{count} bk</span>
                </button>
              );
            })}
          </div>
          <button className="btn-ghost p-2" aria-label="Later days" onClick={() => setStripStart((s) => s + 7)}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select className="input w-auto py-2" value={barberFilter} onChange={(e) => setBarberFilter(e.target.value)} aria-label="Filter by barber">
            <option value="all">All barbers</option>
            {activeBarbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button className="btn-primary" onClick={() => onBook({ date, barberId: columns[0]?.id })}>
            <Plus className="h-4 w-4" /> New walk-in / block
          </button>
        </div>
      </div>

      {columns.length === 0 ? (
        <div className="card p-10 text-center text-sm text-ink-muted">No active barbers. Add one under Services & barbers to open the timetable.</div>
      ) : (
        <div className="card overflow-x-auto">
          <div className="min-w-fit" style={{ display: "grid", gridTemplateColumns: `64px repeat(${columns.length}, minmax(200px, 1fr))` }}>
            {/* Header row */}
            <div className="sticky left-0 z-20 border-b border-line bg-surface" />
            {columns.map((b) => {
              const revenue = dayApts.filter((a) => a.barberId === b.id && a.status !== "blocked").reduce((s, a) => s + a.price, 0);
              return (
                <div key={b.id} className="flex items-center gap-3 border-b border-l border-line px-4 py-3">
                  <Avatar src={b.avatarUrl} name={b.name} className="h-9 w-9" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{b.name}</p>
                    <p className="truncate text-2xs text-ink-faint">{b.role}</p>
                  </div>
                  <span className="ml-auto font-mono text-xs text-brass">{formatPrice(revenue, profile.currency)}</span>
                </div>
              );
            })}

            {/* Time markers */}
            <div className="sticky left-0 z-10 bg-surface">
              {rows.map((t) => (
                <div key={t} style={{ height: ROW }} className="border-b border-line/60 pr-2 pt-1 text-right font-mono text-2xs text-ink-faint">
                  {t}
                </div>
              ))}
            </div>

            {/* Barber columns */}
            {columns.map((b) => (
              <div key={b.id} className="relative border-l border-line" style={{ height: rows.length * ROW }}>
                {rows.map((t) => {
                  const free = store.isSlotAvailable(b.id, date, t, STEP);
                  return (
                    <div key={t} style={{ height: ROW }} className="border-b border-line/60">
                      {free && (
                        <button
                          onClick={() => onBook({ barberId: b.id, date, time: t })}
                          className="group flex h-full w-full items-center justify-center text-xs text-transparent hover:bg-brass/5 hover:text-brass focus-visible:text-brass"
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" /> Book {t}
                        </button>
                      )}
                    </div>
                  );
                })}

                {dayApts
                  .filter((a) => a.barberId === b.id)
                  .map((a) => {
                    const top = ((toMinutes(a.time) - open) / STEP) * ROW;
                    const height = Math.max((a.durationMinutes / STEP) * ROW - 4, 26);
                    const compact = height < 70;
                    return (
                      <button
                        key={a.id}
                        onClick={() => setSelectedId(a.id)}
                        style={{ top: top + 2, height }}
                        className={cn(
                          "absolute inset-x-1.5 overflow-hidden rounded-[8px] border-l-[3px] px-2.5 py-1.5 text-left transition-colors hover:brightness-125",
                          CARD_TONE[a.status],
                          a.status === "in-chair" && "animate-[pulse_2.4s_ease-in-out_infinite]"
                        )}
                      >
                        {a.status === "blocked" ? (
                          <p className="truncate text-xs font-semibold text-status-blocked">{a.clientNotes || "Blocked"} · <span className="font-mono">{a.time}</span></p>
                        ) : (
                          <>
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-xs font-semibold">{a.clientName}</p>
                              <span className="shrink-0 font-mono text-2xs text-ink-muted">{a.time}</span>
                            </div>
                            {!compact && (
                              <>
                                <p className="truncate text-2xs text-ink-muted">{serviceName(a.serviceId)}</p>
                                <p className="truncate font-mono text-2xs text-ink-faint">{a.clientPhone}</p>
                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                  <StatusBadge status={a.status} />
                                  <span className="flex items-center gap-1 text-2xs text-ink-faint">
                                    {a.source === "online" ? <Globe className="h-3 w-3" /> : <Footprints className="h-3 w-3" />}
                                    {a.source === "online" ? "Online" : "Walk-in"}
                                  </span>
                                  <span className="ml-auto font-mono text-2xs text-ink">{formatPrice(a.price, profile.currency)}</span>
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      )}
      {cancelledCount > 0 && <p className="text-xs text-ink-faint">{cancelledCount} cancelled on this day, hidden from the grid. See them in each client&apos;s history.</p>}

      <AppointmentDrawer appointment={selected} serviceName={selected ? serviceName(selected.serviceId) : ""} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function AppointmentDrawer({ appointment: a, serviceName, onClose }: { appointment: Appointment | null; serviceName: string; onClose: () => void }) {
  const store = useBarberSync();
  if (!a) return null;
  const barber = store.barbers.find((b) => b.id === a.barberId);
  const end = fromMinutes(toMinutes(a.time) + a.durationMinutes);
  const isBlock = a.status === "blocked";

  return (
    <Modal open onClose={onClose} title={isBlock ? "Time block" : a.clientName} variant="drawer">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <StatusBadge status={a.status} />
          <span className="font-mono text-xs text-ink-faint">#{a.referenceCode}</span>
        </div>
        <dl className="divide-y divide-line text-sm">
          {[
            ["When", `${new Date(a.date + "T00:00").toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" })} · ${a.time}–${end}`],
            ["Barber", barber?.name ?? "Removed barber"],
            ...(isBlock
              ? [["Reason", a.clientNotes || "—"]]
              : [
                  ["Service", serviceName],
                  ["Phone", a.clientPhone],
                  ["Price", formatPrice(a.price, store.profile.currency)],
                  ["Payment", { venue: "At the venue", kaspi_qr: "Kaspi QR", card: "Card" }[a.paymentMethod]],
                  ["Source", a.source === "online" ? "Online booking" : "Walk-in / phone"],
                  ["Notes", a.clientNotes || "—"],
                ]),
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-6 py-2.5">
              <dt className="text-ink-muted">{k}</dt>
              <dd className={cn("text-right", (k === "Phone" || k === "Price" || k === "When") && "font-mono")}>{v}</dd>
            </div>
          ))}
        </dl>

        <div className="space-y-2">
          {a.status === "confirmed" && (
            <button className="btn-primary w-full" onClick={() => store.updateAppointmentStatus(a.id, "in-chair")}>
              <Play className="h-4 w-4" /> Start cut (in chair)
            </button>
          )}
          {a.status === "in-chair" && (
            <button className="btn w-full bg-status-completed text-canvas hover:brightness-110" onClick={() => store.updateAppointmentStatus(a.id, "completed")}>
              <CheckCircle2 className="h-4 w-4" /> Complete & mark paid
            </button>
          )}
          {(a.status === "confirmed" || a.status === "in-chair") && (
            <button className="btn-ghost w-full text-status-cancelled" onClick={() => { store.updateAppointmentStatus(a.id, "cancelled"); onClose(); }}>
              <XCircle className="h-4 w-4" /> Cancel appointment
            </button>
          )}
          {!isBlock && a.clientPhone && (
            <a
              className="btn-ghost w-full"
              target="_blank"
              rel="noreferrer"
              href={waLink(a.clientPhone, `Hi ${a.clientName.split(" ")[0]}, this is ${store.profile.salonName} about your ${a.time} appointment on ${a.date}.`)}
            >
              <MessageCircle className="h-4 w-4" /> Message on WhatsApp
            </a>
          )}
          <button
            className="btn w-full text-ink-faint hover:text-status-cancelled"
            onClick={() => {
              if (confirm(isBlock ? "Remove this time block?" : "Delete this appointment and free the slot? This can't be undone.")) {
                store.deleteAppointment(a.id);
                onClose();
              }
            }}
          >
            <Trash2 className="h-4 w-4" /> {isBlock ? "Remove block" : "Delete & free slot"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
