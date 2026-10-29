"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, MessageCircle, Search } from "lucide-react";
import { formatPrice, normalizePhone, useBarberSync, type DerivedClient } from "@/lib/store";
import { Field, Modal, StatusBadge, cn, waLink } from "@/components/ui";
import type { ReservationPrefill } from "./ReservationModal";

const TOGGLE_TAGS = ["VIP", "Regular"];

/** Stored tags, plus "New" for anyone with at most one visit and no manual tag. */
export const displayTags = (c: DerivedClient) => (c.tags.length ? c.tags : c.appointments.filter((a) => a.status !== "cancelled").length <= 1 ? ["New"] : []);

const TAG_TONE: Record<string, string> = {
  VIP: "border-brass/40 bg-brass/10 text-brass",
  Regular: "border-status-confirmed/30 bg-status-confirmed/10 text-status-confirmed",
  New: "border-status-completed/30 bg-status-completed/10 text-status-completed",
};

export function Clients({ onBook }: { onBook: (prefill: ReservationPrefill) => void }) {
  const store = useBarberSync();
  const clients = useMemo(() => store.getDerivedClients(), [store]);
  const [query, setQuery] = useState("");
  const [openPhone, setOpenPhone] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? clients.filter((c) => c.name.toLowerCase().includes(q) || normalizePhone(c.phone).includes(normalizePhone(q) || "\u0000") || displayTags(c).some((t) => t.toLowerCase().includes(q)))
    : clients;

  const vipRepeat = clients.filter((c) => c.tags.includes("VIP") || c.totalVisits >= 2).length;
  const paying = clients.filter((c) => c.totalSpend > 0);
  const avgLtv = paying.length ? Math.round(paying.reduce((s, c) => s + c.totalSpend, 0) / paying.length) : 0;
  const current = clients.find((c) => normalizePhone(c.phone) === openPhone) ?? null;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Total clients", String(clients.length)],
          ["VIP & repeat clients", String(vipRepeat)],
          ["Average lifetime value", formatPrice(avgLtv, store.profile.currency)],
        ].map(([label, value]) => (
          <div key={label} className="card px-5 py-4">
            <p className="text-xs text-ink-muted">{label}</p>
            <p className="mt-1 font-mono text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <input className="input pl-9" placeholder="Search by name, phone or tag" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-line text-left text-xs text-ink-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Client</th>
              <th className="px-3 py-3 font-medium">Phone</th>
              <th className="px-3 py-3 text-right font-medium">Visits</th>
              <th className="px-3 py-3 text-right font-medium">Lifetime spend</th>
              <th className="px-3 py-3 font-medium">Last visit</th>
              <th className="px-3 py-3 font-medium">Tags</th>
              <th className="px-5 py-3 font-medium">Cut formula</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.map((c) => (
              <tr key={c.phone} onClick={() => setOpenPhone(normalizePhone(c.phone))} className="cursor-pointer hover:bg-raised/60">
                <td className="px-5 py-3 font-medium">
                  <button className="text-left hover:text-brass" onClick={() => setOpenPhone(normalizePhone(c.phone))}>{c.name}</button>
                </td>
                <td className="px-3 py-3 font-mono text-xs text-ink-muted">{c.phone}</td>
                <td className="px-3 py-3 text-right font-mono">{c.totalVisits}</td>
                <td className="px-3 py-3 text-right font-mono">{formatPrice(c.totalSpend, store.profile.currency)}</td>
                <td className="px-3 py-3 font-mono text-xs text-ink-muted">{c.lastVisit ?? "—"}</td>
                <td className="px-3 py-3">
                  <div className="flex gap-1">
                    {displayTags(c).map((t) => <span key={t} className={cn("badge", TAG_TONE[t] ?? "border-line text-ink-muted")}>{t}</span>)}
                  </div>
                </td>
                <td className="max-w-[240px] truncate px-5 py-3 text-xs text-ink-muted">{c.notes || "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-ink-muted">
                  {clients.length ? `No clients match "${query}".` : "Clients appear here after their first booking."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ClientDrawer client={current} onClose={() => setOpenPhone(null)} onBook={onBook} />
    </div>
  );
}

function ClientDrawer({ client, onClose, onBook }: { client: DerivedClient | null; onClose: () => void; onBook: (p: ReservationPrefill) => void }) {
  const store = useBarberSync();
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setNotes(client?.notes ?? "");
    setSaved(false);
  }, [client?.phone, client?.notes]);

  if (!client) return null;
  const history = [...client.appointments].reverse();
  const toggleTag = (tag: string) => {
    const tags = client.tags.includes(tag) ? client.tags.filter((t) => t !== tag) : [...client.tags, tag];
    store.updateClientNotes(client.phone, notes, tags);
  };

  return (
    <Modal open onClose={onClose} title={client.name} variant="drawer">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm text-ink-muted">{client.phone}</span>
          <a href={waLink(client.phone)} target="_blank" rel="noreferrer" className="btn-ghost py-1.5 text-xs">
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </a>
        </div>
        <div className="grid grid-cols-3 divide-x divide-line rounded-card border border-line text-center">
          {[
            ["Visits", String(client.totalVisits)],
            ["Spent", formatPrice(client.totalSpend, store.profile.currency)],
            ["Last visit", client.lastVisit ?? "—"],
          ].map(([k, v]) => (
            <div key={k} className="px-2 py-3">
              <p className="text-2xs text-ink-faint">{k}</p>
              <p className="mt-0.5 font-mono text-sm">{v}</p>
            </div>
          ))}
        </div>

        <Field label="Tags">
          <div className="flex gap-2">
            {TOGGLE_TAGS.map((t) => (
              <button key={t} type="button" aria-pressed={client.tags.includes(t)} onClick={() => toggleTag(t)} className={cn("badge px-3 py-1", client.tags.includes(t) ? TAG_TONE[t] : "border-line text-ink-faint hover:text-ink")}>
                {t}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Private cut notes" hint="Only your team sees these.">
          <textarea
            className="input min-h-[96px] resize-y"
            placeholder="#0.5 mid drop fade, keep crown longer"
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setSaved(false); }}
          />
        </Field>
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={() => { store.updateClientNotes(client.phone, notes, client.tags); setSaved(true); }}>
            {saved ? "Notes saved" : "Save notes"}
          </button>
          <button className="btn-primary flex-1" onClick={() => { onClose(); onBook({ clientName: client.name, clientPhone: client.phone }); }}>
            <CalendarPlus className="h-4 w-4" /> Book next visit
          </button>
        </div>

        <div>
          <h3 className="mb-2 text-sm">History</h3>
          <ul className="divide-y divide-line rounded-card border border-line">
            {history.length === 0 && <li className="px-4 py-3 text-sm text-ink-faint">No appointments yet.</li>}
            {history.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate">{store.services.find((s) => s.id === a.serviceId)?.name ?? "Service removed"}</p>
                  <p className="font-mono text-2xs text-ink-faint">
                    {a.date} {a.time} · {store.barbers.find((b) => b.id === a.barberId)?.name ?? "—"}
                  </p>
                </div>
                <span className="font-mono text-xs">{formatPrice(a.price, store.profile.currency)}</span>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
