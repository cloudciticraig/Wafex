import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { aud, fmtDate, fmtDateLong, type Store, type Visit } from "./types";
import { BannerChip, ConditionBadge, PhotoThumb, SectionTitle, StatusBadge, StemStepper, usePhotoLightbox } from "./bits";
import { Camera, Clock, MessageSquareWarning, User } from "lucide-react";

export function VisitsView({ visits, stores }: { visits: Visit[]; stores: Store[] }) {
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [openId, setOpenId] = useState<number | null>(null);
  const lightbox = usePhotoLightbox();

  const storeById = useMemo(() => new Map(stores.map((s) => [s.id, s])), [stores]);
  const open = visits.find((v) => v.id === openId) ?? null;

  const filtered = useMemo(
    () => visits.filter((v) => storeFilter === "all" || String(v.storeId) === storeFilter),
    [visits, storeFilter]
  );

  return (
    <div>
      <SectionTitle
        right={
          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger className="h-9 w-[220px] bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stores</SelectItem>
              {stores.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      >
        Merchandiser visits
      </SectionTitle>

      {filtered.length === 0 && (
        <Card className="border-dashed p-8 text-center text-sm text-muted-foreground">
          No visits logged yet for this store — they'll appear here as merchandisers submit them.
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {filtered.map((v) => {
          const store = storeById.get(v.storeId);
          if (!store) return null;
          const pending = v.credits.filter((c) => c.status === "pending");
          const creditValue = v.credits.reduce((s, c) => s + c.qty * c.unitCost, 0);
          return (
            <Card
              key={v.id}
              role="button"
              tabIndex={0}
              onClick={() => setOpenId(v.id)}
              onKeyDown={(e) => e.key === "Enter" && setOpenId(v.id)}
              className="cursor-pointer overflow-hidden border-border/80 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex gap-1 bg-muted/50 p-1.5">
                {v.displayPhotos.slice(0, 3).map((p) => (
                  <div key={p.id} className="h-24 flex-1 overflow-hidden rounded-sm">
                    <img src={p.src} alt={p.caption ?? "Display"} loading="lazy" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
              <div className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-display text-[15px] font-semibold leading-tight">{store.name}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <BannerChip banner={store.banner} />
                      <span className="font-data">{store.bcCustomerNo}</span>
                    </div>
                  </div>
                  <ConditionBadge condition={v.condition} />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" />{v.merchandiser}</span>
                  <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{fmtDate(v.date)} · {v.timeIn}–{v.timeOut}</span>
                  <span className="inline-flex items-center gap-1"><Camera className="h-3.5 w-3.5" />{v.displayPhotos.length} photos</span>
                </div>
                <p className="line-clamp-2 text-sm text-foreground/90">{v.notes}</p>
                <div className="flex items-center justify-between pt-1">
                  {v.credits.length ? (
                    <span className="text-xs text-muted-foreground">
                      {v.credits.length} credit line{v.credits.length > 1 ? "s" : ""} · {aud(creditValue)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">No credits requested</span>
                  )}
                  {pending.length > 0 && (
                    <span className="rounded-full bg-[hsl(var(--amber))]/12 px-2 py-0.5 text-[11px] font-semibold text-[hsl(var(--amber))]">
                      {pending.length} awaiting approval
                    </span>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          {open && (() => {
            const store = storeById.get(open.storeId)!;
            return (
              <div className="space-y-5">
                <div>
                  <DialogTitle className="font-display text-xl font-semibold">{store.name}</DialogTitle>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <BannerChip banner={store.banner} />
                    <span className="font-data text-xs">{store.bcCustomerNo}</span>
                    <span>·</span>
                    <span>{fmtDateLong(open.date)}, {open.timeIn}–{open.timeOut}</span>
                    <span>·</span>
                    <span>{open.merchandiser}</span>
                  </div>
                  <div className="mt-2"><ConditionBadge condition={open.condition} big /></div>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold">Display photos</h3>
                  <div className="flex gap-2 overflow-x-auto pb-1 scroll-thin">
                    {open.displayPhotos.map((p) => (
                      <PhotoThumb key={p.id} photo={p} size="h-28 w-40" onClick={() => lightbox.open(p)} />
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="mb-1 text-sm font-semibold">Visit notes</h3>
                  <p className="text-sm leading-relaxed text-foreground/90">{open.notes}</p>
                </div>

                {open.concerns && (
                  <div className="rounded-md border border-[hsl(var(--amber))]/30 bg-[hsl(var(--amber))]/8 p-3">
                    <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--amber))]">
                      <MessageSquareWarning className="h-4 w-4" /> Raised with the store team
                    </h3>
                    <p className="text-sm leading-relaxed text-foreground/90">{open.concerns}</p>
                  </div>
                )}

                <Separator />

                <div>
                  <h3 className="mb-2 text-sm font-semibold">Credits requested {open.credits.length === 0 && <span className="font-normal text-muted-foreground">— none this visit</span>}</h3>
                  <div className="space-y-3">
                    {open.credits.map((c) => (
                      <div key={c.id} className="rounded-md border bg-card p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-medium">{c.description}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              <span className="font-data">{c.sku}</span> · {c.qty} × {aud(c.unitCost)} = <span className="font-semibold text-foreground">{aud(c.qty * c.unitCost)}</span> · {c.reason}
                            </div>
                          </div>
                          <StatusBadge status={c.status} />
                        </div>
                        <div className="mt-2 flex gap-2">
                          {c.photos.map((p) => (
                            <PhotoThumb key={p.id} photo={p} size="h-16 w-24" onClick={() => lightbox.open(p)} />
                          ))}
                        </div>
                        <div className="mt-3">
                          <StemStepper status={c.status} memo={c.bcCreditMemo ?? undefined} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
      {lightbox.node}
    </div>
  );
}
