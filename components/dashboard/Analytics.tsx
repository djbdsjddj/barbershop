"use client";

import { useMemo, useState } from "react";
import { addDays, formatPrice, toDateKey, toMinutes, useBarberSync, type ServiceCategory } from "@/lib/store";
import { Avatar, cn } from "@/components/ui";

const CATEGORIES: ServiceCategory[] = ["Haircuts", "Beard", "Combos", "VIP"];

export function Analytics() {
  const store = useBarberSync();
  const { profile, barbers, services, appointments } = store;
  const fmt = (n: number) => formatPrice(n, profile.currency);
  const [hover, setHover] = useState<number | null>(null);

  const data = useMemo(() => {
    // Week window centred on today: 3 days back, 3 days ahead.
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, i) => toDateKey(addDays(today, i - 3)));
    const inWindow = appointments.filter((a) => days.includes(a.date) && a.status !== "cancelled" && a.status !== "blocked");

    const completed = inWindow.filter((a) => a.status === "completed").reduce((s, a) => s + a.price, 0);
    const pending = inWindow.filter((a) => a.status !== "completed").reduce((s, a) => s + a.price, 0);

    const activeBarbers = barbers.filter((b) => b.active);
    const openMinutes = Math.max(0, toMinutes(profile.closeTime) - toMinutes(profile.openTime));
    const capacity = activeBarbers.length * openMinutes * days.length;
    const bookedMinutes = inWindow.reduce((s, a) => s + a.durationMinutes, 0);
    const utilization = capacity ? (bookedMinutes / capacity) * 100 : 0;

    const clients = store.getDerivedClients();
    const repeat = clients.filter((c) => c.appointments.filter((a) => a.status !== "cancelled").length >= 2).length;
    const retention = clients.length ? (repeat / clients.length) * 100 : 0;

    const daily = days.map((d) => {
      const list = inWindow.filter((a) => a.date === d);
      return {
        date: d,
        paid: list.filter((a) => a.status === "completed").reduce((s, a) => s + a.price, 0),
        pending: list.filter((a) => a.status !== "completed").reduce((s, a) => s + a.price, 0),
        bookings: list.length,
      };
    });

    const byCategory = CATEGORIES.map((cat) => {
      const ids = new Set(services.filter((s) => s.category === cat).map((s) => s.id));
      const list = inWindow.filter((a) => ids.has(a.serviceId));
      return { cat, revenue: list.reduce((s, a) => s + a.price, 0), count: list.length };
    }).sort((a, b) => b.revenue - a.revenue);

    const leaderboard = barbers
      .map((b) => {
        const list = inWindow.filter((a) => a.barberId === b.id);
        const minutes = list.reduce((s, a) => s + a.durationMinutes, 0);
        return {
          barber: b,
          revenue: list.reduce((s, a) => s + a.price, 0),
          count: list.length,
          occupancy: openMinutes ? (minutes / (openMinutes * days.length)) * 100 : 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    return { completed, pending, utilization, retention, daily, byCategory, leaderboard, clientCount: clients.length };
  }, [store, appointments, barbers, services, profile]);

  const maxDay = Math.max(1, ...data.daily.map((d) => d.paid + d.pending));
  const maxCat = Math.max(1, ...data.byCategory.map((c) => c.revenue));
  const todayKey = toDateKey(new Date());

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Gross revenue, this week" value={fmt(data.completed + data.pending)} />
        <div className="card px-5 py-4">
          <p className="text-xs text-ink-muted">Paid vs pending</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-status-completed">{fmt(data.completed)}</p>
          <p className="font-mono text-xs text-ink-faint">+ {fmt(data.pending)} pending</p>
        </div>
        <Kpi label="Chair utilization" value={`${data.utilization.toFixed(1)}%`} meter={data.utilization} />
        <Kpi label="Repeat client retention" value={`${data.retention.toFixed(0)}%`} meter={data.retention} sub={`of ${data.clientCount} clients`} />
      </div>

      <div className="card p-5">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm">Revenue and bookings, this week</h3>
          <div className="flex gap-4 text-xs text-ink-muted">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brass" />Paid</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brass/30" />Booked, not yet paid</span>
          </div>
        </div>
        <div className="flex h-56 items-end gap-2 sm:gap-4" onMouseLeave={() => setHover(null)}>
          {data.daily.map((d, i) => {
            const total = d.paid + d.pending;
            const label = new Date(d.date + "T00:00").toLocaleDateString("en-US", { weekday: "short" });
            return (
              <button
                key={d.date}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                className="group relative flex h-full flex-1 flex-col items-center justify-end gap-2"
                aria-label={`${label}: ${fmt(total)}, ${d.bookings} bookings`}
              >
                {hover === i && (
                  <div className="absolute -top-2 z-10 -translate-y-full whitespace-nowrap rounded-control border border-line bg-raised px-3 py-2 text-left text-xs shadow-card">
                    <p className="font-mono font-semibold">{fmt(total)}</p>
                    <p className="text-ink-muted">{d.bookings} bookings · {fmt(d.paid)} paid</p>
                  </div>
                )}
                <div className="flex w-full max-w-[56px] flex-1 flex-col justify-end">
                  <div className="rounded-t-[4px] bg-brass/30" style={{ height: `${(d.pending / maxDay) * 100}%` }} />
                  <div className={cn("bg-brass", d.pending ? "" : "rounded-t-[4px]")} style={{ height: `${(d.paid / maxDay) * 100}%` }} />
                  {total === 0 && <div className="h-px bg-line" />}
                </div>
                <span className={cn("text-xs", d.date === todayKey ? "font-semibold text-brass" : "text-ink-muted")}>
                  {d.date === todayKey ? "Today" : label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-4 text-sm">Revenue by service category</h3>
          <ul className="space-y-4">
            {data.byCategory.map((c) => (
              <li key={c.cat}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span>{c.cat} <span className="text-xs text-ink-faint">· {c.count} bookings</span></span>
                  <span className="font-mono">{fmt(c.revenue)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-raised">
                  <div className="h-full rounded-full bg-brass" style={{ width: `${(c.revenue / maxCat) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-5">
          <h3 className="mb-4 text-sm">Barber leaderboard</h3>
          <ol className="divide-y divide-line">
            {data.leaderboard.map((row, i) => (
              <li key={row.barber.id} className="flex items-center gap-3 py-3">
                <span className="w-4 font-mono text-xs text-ink-faint">{i + 1}</span>
                <Avatar src={row.barber.avatarUrl} name={row.barber.name} className="h-9 w-9" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.barber.name}</p>
                  <p className="text-2xs text-ink-faint">{row.count} bookings · <span className="font-mono">{row.occupancy.toFixed(0)}%</span> chair occupancy</p>
                </div>
                <span className="font-mono text-sm">{fmt(row.revenue)}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, meter, sub }: { label: string; value: string; meter?: number; sub?: string }) {
  return (
    <div className="card px-5 py-4">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold">{value}</p>
      {sub && <p className="text-xs text-ink-faint">{sub}</p>}
      {meter !== undefined && (
        <div className="mt-2 h-1 rounded-full bg-raised">
          <div className="h-full rounded-full bg-brass" style={{ width: `${Math.min(100, meter)}%` }} />
        </div>
      )}
    </div>
  );
}
