"use client";

import { useEffect, useState } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Upload, X } from "lucide-react";
import type { AppointmentStatus, Currency } from "@/lib/store";
import { fromMinutes, toMinutes } from "@/lib/store";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const PORTRAIT_PRESETS = [
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=400&fit=crop",
];

export const CURRENCIES: { value: Currency; label: string }[] = [
  { value: "₸", label: "₸ KZT" },
  { value: "$", label: "$ USD" },
  { value: "€", label: "€ EUR" },
];

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  confirmed: "Confirmed",
  "in-chair": "In chair",
  completed: "Paid",
  cancelled: "Cancelled",
  blocked: "Blocked",
};

// Full literal class names so Tailwind keeps them.
const STATUS_BADGE: Record<AppointmentStatus, string> = {
  confirmed: "badge-confirmed",
  "in-chair": "badge-in-chair",
  completed: "badge-completed",
  cancelled: "badge-cancelled",
  blocked: "badge-blocked",
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span className={STATUS_BADGE[status]}>
      <span className={cn("h-1.5 w-1.5 rounded-full bg-current", status === "in-chair" && "animate-pulse")} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Avatar({ src, name, className }: { src?: string; name: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  if (!src || failed) {
    return (
      <div className={cn("flex shrink-0 items-center justify-center rounded-full bg-raised text-xs font-semibold text-brass", className)}>
        {initials || "?"}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={name} onError={() => setFailed(true)} className={cn("shrink-0 rounded-full object-cover", className)} />;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const MAX_UPLOAD_BYTES = 1.5 * 1024 * 1024; // localStorage is ~5MB total

export function PhotoPicker({ value, name, onChange }: { value: string; name: string; onChange: (url: string) => void }) {
  const [error, setError] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar src={value} name={name || "Studio"} className="h-16 w-16 ring-1 ring-line" />
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="btn-ghost cursor-pointer py-2 text-xs">
            <Upload className="h-3.5 w-3.5" /> Upload photo
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                if (file.size > MAX_UPLOAD_BYTES) return setError("Photo is over 1.5 MB. Pick a smaller one.");
                setError("");
                onChange(await fileToDataUrl(file));
              }}
            />
          </label>
          {PORTRAIT_PRESETS.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => onChange(url)}
              aria-label={`Use preset portrait ${i + 1}`}
              className={cn("rounded-full ring-offset-2 ring-offset-surface", value === url ? "ring-2 ring-brass" : "ring-1 ring-line hover:ring-line-strong")}
            >
              <Avatar src={url} name={`Preset ${i + 1}`} className="h-8 w-8" />
            </button>
          ))}
        </div>
        {error && <p className="text-xs text-status-cancelled">{error}</p>}
      </div>
    </div>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-xs font-medium text-ink-muted">{label}</span>
      {children}
      {hint && <span className="block text-2xs text-ink-faint">{hint}</span>}
    </label>
  );
}

export function Modal({
  open,
  onClose,
  title,
  variant = "center",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  variant?: "center" | "drawer";
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close" className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          "relative flex max-h-full w-full flex-col border-line bg-surface shadow-card",
          variant === "drawer" ? "ml-auto h-full max-w-md border-l" : "m-auto max-h-[90vh] max-w-lg rounded-card border"
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base">{title}</h2>
          <button onClick={onClose} className="rounded-control p-1.5 text-ink-muted hover:bg-raised hover:text-ink" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

/** HH:mm options across the day at a given step */
export function timeOptions(step = 30, from = "06:00", to = "23:30") {
  const out: string[] = [];
  for (let t = toMinutes(from); t <= toMinutes(to); t += step) out.push(fromMinutes(t));
  return out;
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export function useOrigin() {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  return origin;
}

export function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-brass" />
    </div>
  );
}

export const waLink = (phone: string, text?: string) =>
  `https://wa.me/${phone.replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
