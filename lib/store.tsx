"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

// ───────────────────────── Types ─────────────────────────

export type Currency = "₸" | "$" | "€";
export type ServiceCategory = "Haircuts" | "Beard" | "Combos" | "VIP";
export type PaymentMethod = "venue" | "kaspi_qr" | "card";
export type AppointmentStatus = "confirmed" | "in-chair" | "completed" | "cancelled" | "blocked";
export type AppointmentSource = "online" | "walk-in";

export interface StudioProfile {
  salonName: string;
  slug: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  bio: string;
  /** Remote URL or Base64 data URI from an upload */
  avatarUrl: string;
  currency: Currency;
  openTime: string; // HH:mm
  closeTime: string; // HH:mm
  slotInterval: number; // minutes
  rating: number;
  reviewCount: number;
}

export interface Barber {
  id: string;
  name: string;
  role: string;
  avatarUrl: string;
  rating: number;
  specialties: string[];
  active: boolean;
}

export interface Service {
  id: string;
  name: string;
  category: ServiceCategory;
  price: number;
  durationMinutes: number;
  description: string;
  barberIds: string[];
}

export interface Appointment {
  id: string;
  referenceCode: string;
  clientName: string;
  clientPhone: string;
  clientNotes: string;
  barberId: string;
  /** Empty string for "blocked" time */
  serviceId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  durationMinutes: number;
  price: number;
  paymentMethod: PaymentMethod;
  status: AppointmentStatus;
  source: AppointmentSource;
  createdAt: string; // ISO
}

export interface ClientNote {
  notes: string;
  tags: string[];
}

/** Keyed by normalizePhone(phone) */
export type ClientNoteMap = Record<string, ClientNote>;

export interface Slot {
  time: string;
  available: boolean;
  /** Barbers free for this slot (one entry for a specific barber, many for "any") */
  freeBarberIds: string[];
}

export interface DerivedClient {
  name: string;
  phone: string;
  totalVisits: number;
  totalSpend: number;
  lastVisit: string | null;
  appointments: Appointment[];
  notes: string;
  tags: string[];
}

export interface BarberSyncState {
  profile: StudioProfile;
  barbers: Barber[];
  services: Service[];
  appointments: Appointment[];
  clientNotes: ClientNoteMap;
}

export type NewAppointment = Omit<Appointment, "id" | "referenceCode" | "createdAt">;

// ───────────────────────── Helpers ─────────────────────────

export const normalizePhone = (phone: string) => phone.replace(/\D/g, "");

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const fromMinutes = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

/** Local-time YYYY-MM-DD (toISOString would shift to UTC) */
export const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const addDays = (d: Date, days: number) => {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
};

export const formatPrice = (amount: number, currency: Currency) =>
  currency === "₸"
    ? `${amount.toLocaleString("ru-RU")} ₸`
    : `${currency}${amount.toLocaleString("en-US")}`;

const uid = (prefix: string) =>
  `${prefix}_${typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10)}`;

const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion
const makeReferenceCode = (taken: Set<string>) => {
  let code: string;
  do {
    code = "BS-" + Array.from({ length: 4 }, () => REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)]).join("");
  } while (taken.has(code));
  return code;
};

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd;

// ───────────────────────── Seed data ─────────────────────────

function createSeed(): BarberSyncState {
  const today = toDateKey(new Date());
  const tomorrow = toDateKey(addDays(new Date(), 1));
  const now = new Date().toISOString();

  const profile: StudioProfile = {
    salonName: "Craft & Blade",
    slug: "craft-blade",
    ownerName: "Iskander Rustam",
    email: "hello@craftblade.kz",
    phone: "+7 701 555 24 10",
    address: "Dostyk Ave 132, floor 1",
    city: "Almaty",
    bio: "Classic cuts, hot-towel shaves and sharp fades in the centre of Almaty. Book a chair online, pay at the counter or with Kaspi QR.",
    avatarUrl: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400&h=400&fit=crop",
    currency: "₸",
    openTime: "10:00",
    closeTime: "21:00",
    slotInterval: 30,
    rating: 4.98,
    reviewCount: 142,
  };

  const barbers: Barber[] = [
    {
      id: "b_iskander",
      name: "Iskander Rustam",
      role: "Founder · Master barber",
      avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop",
      rating: 4.99,
      specialties: ["Scissor cuts", "Hot-towel shave", "Classic pompadour"],
      active: true,
    },
    {
      id: "b_arman",
      name: "Arman Serikov",
      role: "Senior barber",
      avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop",
      rating: 4.96,
      specialties: ["Skin fades", "Beard sculpting", "Textured crops"],
      active: true,
    },
    {
      id: "b_daniyar",
      name: "Daniyar K.",
      role: "Barber",
      avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop",
      rating: 4.92,
      specialties: ["Buzz cuts", "Kids cuts", "Line-ups"],
      active: true,
    },
  ];

  const all = barbers.map((b) => b.id);
  const services: Service[] = [
    { id: "s_classic", name: "Classic haircut", category: "Haircuts", price: 8000, durationMinutes: 45, description: "Consultation, wash, scissor-and-clipper cut, styling.", barberIds: all },
    { id: "s_fade", name: "Skin fade", category: "Haircuts", price: 9000, durationMinutes: 60, description: "Zero-blend fade with foil shaver finish and detailed line-up.", barberIds: ["b_arman", "b_daniyar"] },
    { id: "s_beard", name: "Beard trim & shape", category: "Beard", price: 5000, durationMinutes: 30, description: "Shape, line and trim with hot towel and beard oil.", barberIds: all },
    { id: "s_shave", name: "Royal hot-towel shave", category: "Beard", price: 7000, durationMinutes: 45, description: "Straight-razor shave with three hot towels and cold-towel finish.", barberIds: ["b_iskander", "b_arman"] },
    { id: "s_combo", name: "Haircut + beard", category: "Combos", price: 12000, durationMinutes: 75, description: "Any haircut plus full beard shape. The most booked service.", barberIds: all },
    { id: "s_vip", name: "VIP atelier ritual", category: "VIP", price: 25000, durationMinutes: 120, description: "Cut, royal shave, face mask, scalp massage and a drink, in the private chair.", barberIds: ["b_iskander"] },
  ];

  const svc = (id: string) => services.find((s) => s.id === id)!;
  const apt = (
    i: number,
    p: Pick<Appointment, "clientName" | "clientPhone" | "barberId" | "date" | "time" | "status"> &
      Partial<Pick<Appointment, "clientNotes" | "paymentMethod" | "source" | "serviceId" | "durationMinutes" | "price">>
  ): Appointment => {
    const s = p.serviceId ? svc(p.serviceId) : null;
    return {
      id: `a_seed_${i}`,
      referenceCode: `BS-${4800 + i * 37}`,
      clientNotes: "",
      paymentMethod: "venue",
      source: "online",
      serviceId: "",
      durationMinutes: s?.durationMinutes ?? 30,
      price: s?.price ?? 0,
      createdAt: now,
      ...p,
    };
  };

  const appointments: Appointment[] = [
    apt(1, { clientName: "Timur Abenov", clientPhone: "+7 707 412 88 31", barberId: "b_iskander", serviceId: "s_combo", date: today, time: "10:00", status: "completed", paymentMethod: "kaspi_qr" }),
    apt(2, { clientName: "Alikhan Zhunusov", clientPhone: "+7 701 903 14 52", barberId: "b_arman", serviceId: "s_fade", date: today, time: "11:00", status: "in-chair", clientNotes: "Low fade, keep length on top" }),
    apt(3, { clientName: "Ruslan Ospanov", clientPhone: "+7 777 260 45 19", barberId: "b_daniyar", serviceId: "s_classic", date: today, time: "12:30", status: "confirmed", source: "walk-in" }),
    apt(4, { clientName: "Maksat Ibraev", clientPhone: "+7 705 318 77 02", barberId: "b_iskander", serviceId: "s_vip", date: today, time: "15:00", status: "confirmed", paymentMethod: "card", clientNotes: "Birthday visit" }),
    apt(5, { clientName: "Daulet Seitkali", clientPhone: "+7 702 114 63 90", barberId: "b_arman", serviceId: "s_beard", date: today, time: "17:30", status: "cancelled" }),
    apt(6, { clientName: "Blocked", clientPhone: "", barberId: "b_daniyar", date: today, time: "14:00", durationMinutes: 60, status: "blocked", clientNotes: "Lunch break" }),
    apt(7, { clientName: "Timur Abenov", clientPhone: "+7 707 412 88 31", barberId: "b_arman", serviceId: "s_shave", date: tomorrow, time: "11:30", status: "confirmed" }),
    apt(8, { clientName: "Erlan Nurgaliev", clientPhone: "+7 747 501 22 68", barberId: "b_daniyar", serviceId: "s_fade", date: tomorrow, time: "16:00", status: "confirmed", paymentMethod: "kaspi_qr" }),
  ];

  const clientNotes: ClientNoteMap = {
    [normalizePhone("+7 707 412 88 31")]: { notes: "#2 guard on sides, scissor top. Prefers matte clay.", tags: ["VIP", "Regular"] },
    [normalizePhone("+7 705 318 77 02")]: { notes: "Sensitive skin: no alcohol aftershave.", tags: ["VIP"] },
  };

  return { profile, barbers, services, appointments, clientNotes };
}

// ───────────────────────── Context ─────────────────────────

const STORAGE_KEY = "barbersync:v1";

export interface BarberSyncContextValue extends BarberSyncState {
  /** False until localStorage has been read on the client */
  hydrated: boolean;
  updateStudioProfile: (partial: Partial<StudioProfile>) => void;
  addBarber: (barber: Omit<Barber, "id"> & { id?: string }) => Barber;
  updateBarber: (id: string, partial: Partial<Barber>) => void;
  deleteBarber: (id: string) => void;
  addService: (service: Omit<Service, "id"> & { id?: string }) => Service;
  updateService: (id: string, partial: Partial<Service>) => void;
  deleteService: (id: string) => void;
  addAppointment: (apt: NewAppointment) => Appointment;
  updateAppointmentStatus: (id: string, status: AppointmentStatus) => void;
  deleteAppointment: (id: string) => void;
  updateClientNotes: (phone: string, notes: string, tags: string[]) => void;
  isSlotAvailable: (barberId: string, date: string, time: string, durationMinutes: number) => boolean;
  getAvailableSlots: (barberId: string | "any", date: string, durationMinutes: number) => Slot[];
  getDerivedClients: () => DerivedClient[];
  resetDemoData: () => void;
}

const BarberSyncContext = createContext<BarberSyncContextValue | null>(null);

function isValidState(x: unknown): x is BarberSyncState {
  const s = x as BarberSyncState;
  return !!s && typeof s === "object" && !!s.profile && Array.isArray(s.barbers) && Array.isArray(s.services) && Array.isArray(s.appointments) && !!s.clientNotes;
}

export function BarberSyncProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BarberSyncState>(createSeed);
  const [hydrated, setHydrated] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const lastSerialized = useRef<string | null>(null);

  // Load once on mount, then follow other tabs.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isValidState(parsed)) {
          lastSerialized.current = raw;
          setState(parsed);
        }
      }
    } catch {
      // Corrupt or blocked storage: keep seed data.
    }
    setHydrated(true);

    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      if (e.newValue === null) {
        // Cleared in another tab: fall back to seed.
        setState(createSeed());
        return;
      }
      try {
        const parsed = JSON.parse(e.newValue);
        if (isValidState(parsed)) {
          lastSerialized.current = e.newValue;
          setState(parsed);
        }
      } catch {
        // Ignore malformed writes.
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Persist after hydration; skip writes that would just echo what we received.
  useEffect(() => {
    if (!hydrated) return;
    const raw = JSON.stringify(state);
    if (raw === lastSerialized.current) return;
    lastSerialized.current = raw;
    try {
      localStorage.setItem(STORAGE_KEY, raw);
    } catch {
      // Quota exceeded (e.g. huge Base64 avatar): state stays in memory.
    }
  }, [state, hydrated]);

  // ── Profile ──
  const updateStudioProfile = useCallback((partial: Partial<StudioProfile>) => {
    setState((s) => ({ ...s, profile: { ...s.profile, ...partial } }));
  }, []);

  // ── Barbers ──
  const addBarber = useCallback((input: Omit<Barber, "id"> & { id?: string }) => {
    const barber: Barber = { ...input, id: input.id ?? uid("b") };
    setState((s) => ({ ...s, barbers: [...s.barbers, barber] }));
    return barber;
  }, []);

  const updateBarber = useCallback((id: string, partial: Partial<Barber>) => {
    setState((s) => ({ ...s, barbers: s.barbers.map((b) => (b.id === id ? { ...b, ...partial, id } : b)) }));
  }, []);

  const deleteBarber = useCallback((id: string) => {
    // Appointments are kept as history; services just stop offering this barber.
    setState((s) => ({
      ...s,
      barbers: s.barbers.filter((b) => b.id !== id),
      services: s.services.map((sv) => ({ ...sv, barberIds: sv.barberIds.filter((b) => b !== id) })),
    }));
  }, []);

  // ── Services ──
  const addService = useCallback((input: Omit<Service, "id"> & { id?: string }) => {
    const service: Service = { ...input, id: input.id ?? uid("s") };
    setState((s) => ({ ...s, services: [...s.services, service] }));
    return service;
  }, []);

  const updateService = useCallback((id: string, partial: Partial<Service>) => {
    setState((s) => ({ ...s, services: s.services.map((sv) => (sv.id === id ? { ...sv, ...partial, id } : sv)) }));
  }, []);

  const deleteService = useCallback((id: string) => {
    setState((s) => ({ ...s, services: s.services.filter((sv) => sv.id !== id) }));
  }, []);

  // ── Appointments ──
  const addAppointment = useCallback((input: NewAppointment) => {
    const taken = new Set(stateRef.current.appointments.map((a) => a.referenceCode));
    const appointment: Appointment = {
      ...input,
      id: uid("a"),
      referenceCode: makeReferenceCode(taken),
      createdAt: new Date().toISOString(),
    };
    setState((s) => ({ ...s, appointments: [...s.appointments, appointment] }));
    return appointment;
  }, []);

  const updateAppointmentStatus = useCallback((id: string, status: AppointmentStatus) => {
    setState((s) => ({ ...s, appointments: s.appointments.map((a) => (a.id === id ? { ...a, status } : a)) }));
  }, []);

  const deleteAppointment = useCallback((id: string) => {
    setState((s) => ({ ...s, appointments: s.appointments.filter((a) => a.id !== id) }));
  }, []);

  // ── CRM ──
  const updateClientNotes = useCallback((phone: string, notes: string, tags: string[]) => {
    const key = normalizePhone(phone);
    if (!key) return;
    setState((s) => ({ ...s, clientNotes: { ...s.clientNotes, [key]: { notes, tags } } }));
  }, []);

  const resetDemoData = useCallback(() => setState(createSeed()), []);

  // ── Availability ──
  const isSlotAvailable = useCallback(
    (barberId: string, date: string, time: string, durationMinutes: number) => {
      const start = toMinutes(time);
      const end = start + durationMinutes;
      return !state.appointments.some(
        (a) =>
          a.barberId === barberId &&
          a.date === date &&
          a.status !== "cancelled" &&
          overlaps(start, end, toMinutes(a.time), toMinutes(a.time) + a.durationMinutes)
      );
    },
    [state.appointments]
  );

  const getAvailableSlots = useCallback(
    (barberId: string | "any", date: string, durationMinutes: number): Slot[] => {
      const { openTime, closeTime, slotInterval } = state.profile;
      const open = toMinutes(openTime);
      const close = toMinutes(closeTime);
      const step = Math.max(5, slotInterval || 30);
      const candidates = barberId === "any" ? state.barbers.filter((b) => b.active).map((b) => b.id) : [barberId];

      const now = new Date();
      const isToday = date === toDateKey(now);
      const nowMins = now.getHours() * 60 + now.getMinutes();

      const slots: Slot[] = [];
      for (let t = open; t + durationMinutes <= close; t += step) {
        const time = fromMinutes(t);
        const inPast = isToday && t <= nowMins;
        const freeBarberIds = inPast ? [] : candidates.filter((id) => isSlotAvailable(id, date, time, durationMinutes));
        slots.push({ time, available: freeBarberIds.length > 0, freeBarberIds });
      }
      return slots;
    },
    [state.profile, state.barbers, isSlotAvailable]
  );

  const getDerivedClients = useCallback((): DerivedClient[] => {
    const map = new Map<string, DerivedClient>();
    const sorted = [...state.appointments]
      .filter((a) => a.status !== "blocked" && normalizePhone(a.clientPhone))
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

    for (const a of sorted) {
      const key = normalizePhone(a.clientPhone);
      let c = map.get(key);
      if (!c) {
        const note = state.clientNotes[key];
        c = { name: a.clientName, phone: a.clientPhone, totalVisits: 0, totalSpend: 0, lastVisit: null, appointments: [], notes: note?.notes ?? "", tags: note?.tags ?? [] };
        map.set(key, c);
      }
      c.name = a.clientName; // most recent spelling wins
      c.appointments.push(a);
      if (a.status === "completed") {
        c.totalVisits += 1;
        c.totalSpend += a.price;
        c.lastVisit = a.date;
      }
    }

    // Clients with notes but no remaining appointments still exist in the CRM.
    for (const [key, note] of Object.entries(state.clientNotes)) {
      if (!map.has(key)) map.set(key, { name: "Unknown client", phone: key, totalVisits: 0, totalSpend: 0, lastVisit: null, appointments: [], notes: note.notes, tags: note.tags });
    }

    return Array.from(map.values()).sort((a, b) => b.totalSpend - a.totalSpend || a.name.localeCompare(b.name));
  }, [state.appointments, state.clientNotes]);

  const value = useMemo<BarberSyncContextValue>(
    () => ({
      ...state,
      hydrated,
      updateStudioProfile,
      addBarber,
      updateBarber,
      deleteBarber,
      addService,
      updateService,
      deleteService,
      addAppointment,
      updateAppointmentStatus,
      deleteAppointment,
      updateClientNotes,
      isSlotAvailable,
      getAvailableSlots,
      getDerivedClients,
      resetDemoData,
    }),
    [state, hydrated, updateStudioProfile, addBarber, updateBarber, deleteBarber, addService, updateService, deleteService, addAppointment, updateAppointmentStatus, deleteAppointment, updateClientNotes, isSlotAvailable, getAvailableSlots, getDerivedClients, resetDemoData]
  );

  return <BarberSyncContext.Provider value={value}>{children}</BarberSyncContext.Provider>;
}

export function useBarberSync() {
  const ctx = useContext(BarberSyncContext);
  if (!ctx) throw new Error("useBarberSync must be used inside <BarberSyncProvider>");
  return ctx;
}
