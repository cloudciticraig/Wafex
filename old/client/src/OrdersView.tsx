import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { addDaysISO, aud, fmtDate, type StoreWithOrders } from "./types";
import { BannerChip, SectionTitle } from "./bits";
import { CalendarDays, RefreshCw, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

export function OrdersView({
  stores,
  onRefresh,
  refreshing,
}: {
  stores: StoreWithOrders[];
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const tomorrow = addDaysISO(1);

  const filtered = useMemo(
    () => stores.filter((s) => storeFilter === "all" || String(s.id) === storeFilter),
    [stores, storeFilter]
  );

  return (
    <div>
      <SectionTitle
        right={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 bg-card" onClick={onRefresh} disabled={refreshing}>
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              Refresh from Business Central
            </Button>
            <Select value={storeFilter} onValueChange={setStoreFilter}>
              <SelectTrigger className="h-9 w-[200px] bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stores</SelectItem>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      >
        Upcoming orders
      </SectionTitle>
      <p className="mb-4 -mt-1 text-sm text-muted-foreground">
        Open and released sales orders — one order per delivery date, per store (Business Central customer).
      </p>

      <div className="space-y-5">
        {filtered.map((store) => {
          const orders = [...store.orders].sort((a, b) => (a.deliveryDate > b.deliveryDate ? 1 : -1));
          const next = orders[0];
          return (
            <Card key={store.id} className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="font-display text-[15px] font-semibold">{store.name}</span>
                  <BannerChip banner={store.banner} />
                  <span className="font-data text-xs text-muted-foreground">{store.bcCustomerNo}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Truck className="h-3.5 w-3.5 text-primary" />
                  {next ? (
                    <>Next delivery <span className="font-semibold text-foreground">{fmtDate(next.deliveryDate)}</span></>
                  ) : (
                    <>No upcoming deliveries</>
                  )}
                  <span>·</span>
                  <span>{store.contact}</span>
                </div>
              </div>

              <div className="divide-y">
                {orders.length === 0 && (
                  <p className="px-4 py-4 text-sm text-muted-foreground">No open sales orders for this store.</p>
                )}
                {orders.map((o) => {
                  const total = o.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
                  const units = o.lines.reduce((s, l) => s + l.qty, 0);
                  return (
                    <div key={o.orderNo} className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <CalendarDays className="h-4 w-4 text-primary" />
                          <span className="font-semibold">{fmtDate(o.deliveryDate)}</span>
                          {o.deliveryDate === tomorrow && (
                            <span className="rounded-full bg-accent/12 px-2 py-0.5 text-[11px] font-semibold text-accent">Tomorrow</span>
                          )}
                          <span className="font-data text-xs text-muted-foreground">{o.orderNo}</span>
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                              o.status === "Released"
                                ? "border-primary/25 bg-primary/10 text-primary"
                                : "border-border bg-secondary text-secondary-foreground"
                            )}
                          >
                            {o.status}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {units} units · <span className="font-semibold text-foreground">{aud(total)}</span>
                        </div>
                      </div>
                      <div className="mt-2 overflow-x-auto scroll-thin">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="h-8 w-[110px] text-xs">Item no.</TableHead>
                              <TableHead className="h-8 text-xs">Description</TableHead>
                              <TableHead className="h-8 w-[70px] text-right text-xs">Qty</TableHead>
                              <TableHead className="h-8 w-[90px] text-right text-xs">Unit</TableHead>
                              <TableHead className="h-8 w-[100px] text-right text-xs">Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {o.lines.map((l) => (
                              <TableRow key={l.sku} className="hover:bg-muted/40">
                                <TableCell className="py-1.5 font-data text-xs">{l.sku}</TableCell>
                                <TableCell className="py-1.5 text-sm">{l.description}</TableCell>
                                <TableCell className="py-1.5 text-right text-sm">{l.qty}</TableCell>
                                <TableCell className="py-1.5 text-right text-sm">{aud(l.unitPrice)}</TableCell>
                                <TableCell className="py-1.5 text-right text-sm font-medium">{aud(l.qty * l.unitPrice)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
