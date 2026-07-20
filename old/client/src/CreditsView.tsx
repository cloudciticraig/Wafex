import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { aud, fmtDate, type Store, type Visit } from "./types";
import { BannerChip, PhotoThumb, SectionTitle, StatusBadge, usePhotoLightbox } from "./bits";
import { Check, Landmark, Loader2, X } from "lucide-react";

export function CreditsView({
  visits,
  stores,
  onDecide,
  canApprove,
}: {
  visits: Visit[];
  stores: Store[];
  onDecide: (creditId: number, decision: "approved" | "rejected") => Promise<void>;
  canApprove: boolean;
}) {
  const lightbox = usePhotoLightbox();
  const [busy, setBusy] = useState<number | null>(null);
  const storeById = useMemo(() => new Map(stores.map((s) => [s.id, s])), [stores]);

  const rows = useMemo(
    () =>
      visits
        .flatMap((v) => v.credits.map((c) => ({ visit: v, credit: c })))
        .sort((a, b) => (a.visit.date < b.visit.date ? 1 : -1)),
    [visits]
  );
  const pending = rows.filter((r) => r.credit.status === "pending");
  const decided = rows.filter((r) => r.credit.status !== "pending");
  const pendingValue = pending.reduce((s, r) => s + r.credit.qty * r.credit.unitCost, 0);

  const decide = async (creditId: number, decision: "approved" | "rejected") => {
    setBusy(creditId);
    try {
      await onDecide(creditId, decision);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <SectionTitle
          right={
            pending.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {pending.length} line{pending.length > 1 ? "s" : ""} · <span className="font-semibold text-foreground">{aud(pendingValue)}</span> pending
              </span>
            )
          }
        >
          Awaiting approval
        </SectionTitle>

        {pending.length === 0 ? (
          <Card className="flex flex-col items-center gap-1 border-dashed p-8 text-center">
            <Check className="h-6 w-6 text-primary" />
            <p className="text-sm font-medium">The queue is clear</p>
            <p className="text-sm text-muted-foreground">New credit requests from merchandiser visits will appear here.</p>
          </Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {pending.map(({ visit, credit }) => {
              const store = storeById.get(visit.storeId);
              if (!store) return null;
              const isBusy = busy === credit.id;
              return (
                <Card key={credit.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-[15px] font-semibold">{store.name}</span>
                        <BannerChip banner={store.banner} />
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Visit {fmtDate(visit.date)} · {visit.merchandiser} · customer <span className="font-data">{store.bcCustomerNo}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-lg font-semibold">{aud(credit.qty * credit.unitCost)}</div>
                      <div className="text-xs text-muted-foreground">{credit.qty} × {aud(credit.unitCost)}</div>
                    </div>
                  </div>

                  <div className="mt-3 rounded-md bg-muted/60 p-2.5 text-sm">
                    <div className="font-medium">{credit.description}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      <span className="font-data">{credit.sku}</span> · {credit.reason}
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    {credit.photos.map((p) => (
                      <PhotoThumb key={p.id} photo={p} size="h-20 w-28" onClick={() => lightbox.open(p)} />
                    ))}
                  </div>

                  {canApprove ? (
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <Button disabled={isBusy} className="h-11 flex-1 gap-2 text-[15px]" onClick={() => decide(credit.id, "approved")}>
                        {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve & post to Business Central
                      </Button>
                      <Button disabled={isBusy} variant="outline" className="h-11 gap-2 text-[15px] text-destructive hover:bg-destructive/5 hover:text-destructive sm:w-36" onClick={() => decide(credit.id, "rejected")}>
                        <X className="h-4 w-4" /> Reject
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-4 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                      Approving credits needs the Bouquet team role — this queue is read-only for your account.
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <SectionTitle>Recent decisions</SectionTitle>
        <div className="space-y-2">
          {decided.map(({ visit, credit }) => {
            const store = storeById.get(visit.storeId);
            if (!store) return null;
            return (
              <Card key={credit.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{store.name}</span>
                    <span className="text-muted-foreground">· {credit.description}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {credit.qty} × {aud(credit.unitCost)} = {aud(credit.qty * credit.unitCost)} · visit {fmtDate(visit.date)} · decided by {credit.decidedBy}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {credit.bcCreditMemo && (
                    <span className="inline-flex items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-1 text-xs">
                      <Landmark className="h-3.5 w-3.5 text-primary" />
                      <span className="font-data">{credit.bcCreditMemo}</span>
                    </span>
                  )}
                  <StatusBadge status={credit.status} />
                </div>
              </Card>
            );
          })}
          {decided.length === 0 && <p className="text-sm text-muted-foreground">No decisions yet.</p>}
        </div>
      </div>
      {lightbox.node}
    </div>
  );
}
