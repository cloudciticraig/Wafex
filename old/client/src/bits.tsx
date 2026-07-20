import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Condition, CreditStatus, Photo } from "./types";
import { Check, Leaf, X } from "lucide-react";

// ---------- Small chips ----------

export function BannerChip({ banner }: { banner: string }) {
  const tone: Record<string, string> = {
    Woolworths: "bg-[#E8F1E4] text-[#1E5B2F] border-[#BFD9BC]",
    Coles: "bg-[#FBEAE4] text-[#9E3A1B] border-[#F0C9BC]",
    IGA: "bg-[#FDF3DC] text-[#8A5B12] border-[#EEDCB0]",
    "Farmer Jack's": "bg-[#EAF0F6] text-[#2C4A6E] border-[#C8D6E4]",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold", tone[banner])}>
      {banner}
    </span>
  );
}

export function ConditionBadge({ condition, big }: { condition: Condition; big?: boolean }) {
  const map: Record<Condition, string> = {
    Excellent: "bg-primary/10 text-primary border-primary/25",
    Good: "bg-secondary text-secondary-foreground border-border",
    "Needs attention": "bg-[hsl(var(--amber))]/12 text-[hsl(var(--amber))] border-[hsl(var(--amber))]/30",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border font-semibold", map[condition], big ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-[11px]")}>
      <span className={cn("h-1.5 w-1.5 rounded-full", condition === "Excellent" ? "bg-primary" : condition === "Good" ? "bg-muted-foreground" : "bg-[hsl(var(--amber))]")} />
      {condition}
    </span>
  );
}

export function StatusBadge({ status }: { status: CreditStatus }) {
  if (status === "pending")
    return <span className="inline-flex items-center rounded-full border border-[hsl(var(--amber))]/30 bg-[hsl(var(--amber))]/12 px-2 py-0.5 text-[11px] font-semibold text-[hsl(var(--amber))]">Awaiting approval</span>;
  if (status === "approved")
    return <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"><Check className="h-3 w-3" />Approved</span>;
  return <span className="inline-flex items-center gap-1 rounded-full border border-destructive/25 bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive"><X className="h-3 w-3" />Rejected</span>;
}

// ---------- Stem stepper (signature): Requested → Decision → Posted to BC ----------

export function StemStepper({ status, memo }: { status: CreditStatus; memo?: string }) {
  const steps = [
    { label: "Requested by merchandiser", done: true },
    {
      label: status === "pending" ? "Bouquet team review" : status === "approved" ? "Approved by bouquet team" : "Rejected by bouquet team",
      done: status !== "pending",
      bad: status === "rejected",
    },
    {
      label: status === "approved" ? `Credit memo ${memo ?? ""} posted to Business Central` : "Post to Business Central",
      done: status === "approved",
      muted: status === "rejected",
    },
  ];
  return (
    <ol className="relative ml-1.5 space-y-2.5 border-l-2 border-primary/25 pl-4">
      {steps.map((s, i) => (
        <li key={i} className="relative text-[13px] leading-tight">
          <span
            className={cn(
              "absolute -left-[23px] top-0 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2",
              s.done && !s.bad && "border-primary bg-primary",
              s.bad && "border-destructive bg-destructive",
              !s.done && "border-border bg-card"
            )}
          >
            {s.done && !s.bad && <Leaf className="h-2 w-2 text-primary-foreground" />}
            {s.bad && <X className="h-2 w-2 text-destructive-foreground" />}
          </span>
          <span className={cn(s.done && !s.bad ? "font-medium text-foreground" : s.bad ? "font-medium text-destructive" : "text-muted-foreground", s.muted && "line-through opacity-60")}>
            {s.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

// ---------- Photos ----------

export function PhotoThumb({ photo, onClick, size = "h-20 w-28" }: { photo: Photo; onClick?: () => void; size?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("shrink-0 overflow-hidden rounded-md border bg-muted transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", size)}
      title={photo.caption ?? undefined}
    >
      <img src={photo.src} alt={photo.caption ?? "Photo"} className="h-full w-full object-cover" />
    </button>
  );
}

export function usePhotoLightbox() {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const node = (
    <Dialog open={!!photo} onOpenChange={(o) => !o && setPhoto(null)}>
      <DialogContent className="max-w-2xl p-2">
        <DialogTitle className="sr-only">Photo</DialogTitle>
        {photo && (
          <figure>
            <img src={photo.src} alt={photo.caption ?? "Photo"} className="w-full rounded-md" />
            {photo.caption && <figcaption className="px-2 pt-2 text-sm text-muted-foreground">{photo.caption}</figcaption>}
          </figure>
        )}
      </DialogContent>
    </Dialog>
  );
  return { open: setPhoto, node };
}

// ---------- Section header ----------

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="font-display text-lg font-semibold sm:text-xl">{children}</h2>
      {right}
    </div>
  );
}
