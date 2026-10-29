"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart3, CalendarDays, Check, Copy, ExternalLink, Menu, QrCode, Scissors, Settings as SettingsIcon, Users, X, Printer } from "lucide-react";
import { toDateKey, useBarberSync } from "@/lib/store";
import { Avatar, Loading, Modal, cn, useOrigin } from "@/components/ui";
import { Timetable } from "@/components/dashboard/Timetable";
import { Clients } from "@/components/dashboard/Clients";
import { Analytics } from "@/components/dashboard/Analytics";
import { Catalog } from "@/components/dashboard/Catalog";
import { Settings } from "@/components/dashboard/Settings";
import { ReservationModal, type ReservationPrefill } from "@/components/dashboard/ReservationModal";

type Tab = "timetable" | "clients" | "analytics" | "catalog" | "settings";

const TITLES: Record<Tab, string> = {
  timetable: "Timetable",
  clients: "Clients & CRM",
  analytics: "Analytics & revenue",
  catalog: "Services & barbers",
  settings: "Studio settings",
};

export default function DashboardPage() {
  const store = useBarberSync();
  const origin = useOrigin();
  const [tab, setTab] = useState<Tab>("timetable");
  const [prefill, setPrefill] = useState<ReservationPrefill | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  if (!store.hydrated) return <Loading />;

  const { profile } = store;
  const bookPath = `/book/${profile.slug}`;
  const bookUrl = `${origin}${bookPath}`;
  const today = toDateKey(new Date());
  const counts: Record<Tab, number> = {
    timetable: store.appointments.filter((a) => a.date === today && a.status !== "cancelled" && a.status !== "blocked").length,
    clients: store.getDerivedClients().length,
    analytics: store.appointments.filter((a) => a.status === "completed").length,
    catalog: store.services.length + store.barbers.length,
    settings: 0,
  };
  const nav: { id: Tab; icon: typeof CalendarDays }[] = [
    { id: "timetable", icon: CalendarDays },
    { id: "clients", icon: Users },
    { id: "analytics", icon: BarChart3 },
    { id: "catalog", icon: Scissors },
    { id: "settings", icon: SettingsIcon },
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(bookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      prompt("Copy your booking link:", bookUrl);
    }
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-line p-5">
        <Avatar src={profile.avatarUrl} name={profile.salonName} className="h-11 w-11 rounded-control" />
        <div className="min-w-0">
          <p className="truncate font-semibold">{profile.salonName}</p>
          <p className="truncate text-xs text-ink-muted">{profile.ownerName}</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 p-3">
        {nav.map(({ id, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setTab(id); setNavOpen(false); }}
            aria-current={tab === id ? "page" : undefined}
            className={cn(
              "flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-sm",
              tab === id ? "bg-raised font-semibold text-ink" : "text-ink-muted hover:bg-raised/60 hover:text-ink"
            )}
          >
            <Icon className={cn("h-4 w-4", tab === id && "text-brass")} />
            {TITLES[id]}
            {id !== "settings" && <span className="ml-auto font-mono text-2xs text-ink-faint">{counts[id]}</span>}
          </button>
        ))}
      </nav>
      <div className="m-3 rounded-card border border-line bg-raised p-4">
        <p className="text-xs font-semibold">Share your booking page</p>
        <p className="mt-1 truncate font-mono text-2xs text-ink-muted">{bookPath}</p>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <button onClick={copy} className="btn-ghost bg-surface px-0 py-2 text-2xs" aria-label="Copy booking link">
            {copied ? <Check className="h-3.5 w-3.5 text-status-completed" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button onClick={() => setQrOpen(true)} className="btn-ghost bg-surface px-0 py-2 text-2xs">
            <QrCode className="h-3.5 w-3.5" /> QR
          </button>
          <a href={bookPath} target="_blank" rel="noreferrer" className="btn-ghost bg-surface px-0 py-2 text-2xs">
            <ExternalLink className="h-3.5 w-3.5" /> Open
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-line bg-surface lg:block">{sidebar}</aside>

      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Close menu" className="absolute inset-0 bg-black/60" onClick={() => setNavOpen(false)} />
          <aside className="relative h-full w-72 border-r border-line bg-surface">{sidebar}</aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="glass-header">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <button className="rounded-control p-2 text-ink-muted hover:bg-raised lg:hidden" onClick={() => setNavOpen(true)} aria-label="Open menu">
              {navOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <h1 className="text-lg">{TITLES[tab]}</h1>
            <span className="hidden font-mono text-xs text-ink-faint sm:inline">
              {new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })}
            </span>
            <Link href="/" className="ml-auto text-xs text-ink-muted hover:text-ink">Home</Link>
          </div>
        </header>
        <main className="p-4 sm:p-6">
          {tab === "timetable" && <Timetable onBook={setPrefill} />}
          {tab === "clients" && <Clients onBook={setPrefill} />}
          {tab === "analytics" && <Analytics />}
          {tab === "catalog" && <Catalog />}
          {tab === "settings" && <Settings />}
        </main>
      </div>

      <ReservationModal prefill={prefill} onClose={() => setPrefill(null)} />

      <Modal open={qrOpen} onClose={() => setQrOpen(false)} title="Booking QR code">
        <div className="print-area space-y-4 text-center">
          <div className="mx-auto w-fit rounded-card bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=480x480&margin=0&data=${encodeURIComponent(bookUrl)}`}
              alt={`QR code for ${bookUrl}`}
              width={240}
              height={240}
            />
          </div>
          <p className="font-semibold">{profile.salonName}</p>
          <p className="break-all font-mono text-xs text-ink-muted">{bookUrl}</p>
          <p className="text-xs text-ink-faint">Print it for the mirror or the front desk. Clients scan it to book.</p>
          <button className="btn-ghost w-full" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </button>
        </div>
      </Modal>
    </div>
  );
}
