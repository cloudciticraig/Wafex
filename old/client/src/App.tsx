import { useCallback, useEffect, useMemo, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { addDaysISO, aud, fmtDateLong, todayISO, type Bootstrap, type Me, type StoreWithOrders, type Visit } from "./types";
import { api, AuthRequiredError } from "./api";
import { SignIn } from "./SignIn";
import { VisitsView } from "./VisitsView";
import { CreditsView } from "./CreditsView";
import { OrdersView } from "./OrdersView";
import { LogVisitView } from "./LogVisitView";
import { CalendarClock, ClipboardList, Flower2, Loader2, LogOut, NotebookPen, ReceiptText, UserCircle2 } from "lucide-react";

type Tab = "visits" | "credits" | "orders" | "log";

const NAV: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "visits", label: "Visits", icon: ClipboardList },
  { id: "credits", label: "Credits", icon: ReceiptText },
  { id: "orders", label: "Orders", icon: CalendarClock },
  { id: "log", label: "Log visit", icon: NotebookPen },
];

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
        <Flower2 className="h-5 w-5" />
      </span>
      <div className="leading-tight">
        <div className="font-display text-lg font-bold tracking-tight text-primary-foreground">WAFEX</div>
        <div className="text-[11px] font-medium text-primary-foreground/70">Merchandising & credits</div>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("visits");
  const [me, setMe] = useState<Me | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [orderStores, setOrderStores] = useState<StoreWithOrders[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshingOrders, setRefreshingOrders] = useState(false);

  const loadAll = useCallback(async () => {
    setLoadError(null);
    try {
      const meRes = await api.me();
      setMe(meRes);
      setNeedsSignIn(false);
      const [b, v, o] = await Promise.all([api.bootstrap(), api.visits(), api.orders()]);
      setBoot(b);
      setVisits(v);
      setOrderStores(o);
    } catch (e) {
      if (e instanceof AuthRequiredError) setNeedsSignIn(true);
      else setLoadError(e instanceof Error ? e.message : "Could not reach the server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const pendingCredits = useMemo(
    () => visits.flatMap((v) => v.credits).filter((c) => c.status === "pending"),
    [visits]
  );
  const pendingValue = pendingCredits.reduce((s, c) => s + c.qty * c.unitCost, 0);
  const weekStart = addDaysISO(-6);
  const visitsThisWeek = visits.filter((v) => v.date >= weekStart).length;
  const next7 = addDaysISO(7);
  const ordersNext7 = orderStores.flatMap((s) => s.orders).filter((o) => o.deliveryDate >= todayISO() && o.deliveryDate <= next7);
  const ordersValue = ordersNext7.reduce((s, o) => s + o.lines.reduce((t, l) => t + l.qty * l.unitPrice, 0), 0);

  const decide = async (creditId: number, decision: "approved" | "rejected") => {
    let store = "";
    let desc = "";
    try {
      const result = await api.decideCredit(creditId, decision);
      setVisits((vs) =>
        vs.map((v) => {
          const hit = v.credits.find((c) => c.id === creditId);
          if (!hit) return v;
          store = boot?.stores.find((s) => s.id === v.storeId)?.name ?? "";
          desc = `${hit.qty} × ${hit.description}`;
          return {
            ...v,
            credits: v.credits.map((c) =>
              c.id === creditId
                ? { ...c, status: result.status as typeof c.status, bcCreditMemo: result.bcCreditMemo, decidedBy: result.decidedBy, decidedAt: result.decidedAt }
                : c
            ),
          };
        })
      );
      if (decision === "approved") {
        toast.success(`Credit approved — ${desc}`, {
          description: `Credit memo ${result.bcCreditMemo} posted to Business Central for ${store}.`,
        });
      } else {
        toast(`Credit rejected — ${desc}`, {
          description: `${store} · the merchandiser will be notified. Nothing was posted to Business Central.`,
        });
      }
    } catch (e) {
      toast.error("Could not save the decision", {
        description: e instanceof Error ? e.message : "Check the connection and try again.",
      });
      loadAll();
    }
  };

  const addVisit = async (input: Parameters<typeof api.createVisit>[0]) => {
    const created = await api.createVisit(input);
    setVisits((vs) => [created, ...vs]);
    const storeName = boot?.stores.find((s) => s.id === created.storeId)?.name ?? "store";
    toast.success("Visit logged", {
      description:
        created.credits.length > 0
          ? `${storeName} · ${created.credits.length} credit request${created.credits.length > 1 ? "s" : ""} sent to the bouquet team.`
          : `${storeName} · no credits requested.`,
    });
    setTab("visits");
  };

  const refreshOrders = async () => {
    setRefreshingOrders(true);
    try {
      await api.refreshOrders();
      setOrderStores(await api.orders());
      toast.success("Orders refreshed from Business Central");
    } catch (e) {
      toast.error("Refresh failed", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setRefreshingOrders(false);
    }
  };

  const kpis = [
    { label: "Visits this week", value: String(visitsThisWeek), sub: `across ${boot?.stores.length ?? 0} stores` },
    { label: "Credits awaiting approval", value: String(pendingCredits.length), sub: aud(pendingValue), warn: pendingCredits.length > 0 },
    { label: "Deliveries next 7 days", value: String(ordersNext7.length), sub: aud(ordersValue) },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">Loading the bouquet team desk…</p>
      </div>
    );
  }

  if (needsSignIn) {
    const authError = new URLSearchParams(window.location.search).get("authError");
    return <SignIn authError={authError} />;
  }

  if (loadError || !boot || !me) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-display text-lg font-semibold">Can't reach the server</p>
        <p className="max-w-md text-sm text-muted-foreground">{loadError ?? "The API didn't respond."} The database may still be starting — try again in a moment.</p>
        <Button onClick={() => { setLoading(true); loadAll(); }}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:flex">
      {/* Rail — desktop / big screen */}
      <aside className="stem-pattern hidden w-60 shrink-0 flex-col bg-primary lg:flex xl:w-64">
        <div className="px-5 pb-6 pt-6">
          <Wordmark />
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setTab(n.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-[15px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/60",
                tab === n.id ? "bg-primary-foreground text-primary" : "text-primary-foreground/85 hover:bg-primary-foreground/10"
              )}
            >
              <n.icon className="h-[18px] w-[18px]" />
              {n.label}
              {n.id === "credits" && pendingCredits.length > 0 && (
                <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">
                  {pendingCredits.length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="space-y-3 px-5 pb-5 text-xs text-primary-foreground/70">
          <div>
            <div className="mb-1 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
              Business Central sync (synthetic)
            </div>
            <div>WAFEX-AU · {boot.bcLastSync ? `last sync ${new Date(boot.bcLastSync).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}` : "not yet synced"}</div>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-primary-foreground/15 pt-3">
            <span className="flex min-w-0 items-center gap-1.5">
              <UserCircle2 className="h-4 w-4 shrink-0" />
              <span className="truncate text-primary-foreground/90" title={me.user.email}>{me.user.name}</span>
            </span>
            {me.authConfigured && (
              <a href="/auth/logout" title="Sign out" className="flex items-center gap-1 rounded px-1.5 py-1 hover:bg-primary-foreground/10 hover:text-primary-foreground">
                <LogOut className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="min-w-0 flex-1">
        {/* Top bar — tablet & phone */}
        <header className="stem-pattern sticky top-0 z-20 bg-primary lg:hidden">
          <div className="flex items-center justify-between px-4 pb-2 pt-3">
            <Wordmark />
            <span className="flex items-center gap-2 text-xs text-primary-foreground/80">
              <span className="hidden max-w-[160px] truncate sm:inline">{me.user.name}</span>
              {me.authConfigured && (
                <a href="/auth/logout" className="flex items-center gap-1 rounded px-1.5 py-1 hover:bg-primary-foreground/10"><LogOut className="h-3.5 w-3.5" /></a>
              )}
            </span>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2 scroll-thin">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium",
                  tab === n.id ? "bg-primary-foreground text-primary" : "text-primary-foreground/85 hover:bg-primary-foreground/10"
                )}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
                {n.id === "credits" && pendingCredits.length > 0 && (
                  <span className="rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-bold text-accent-foreground">{pendingCredits.length}</span>
                )}
              </button>
            ))}
          </nav>
        </header>

        <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          {!me.authConfigured && (
            <div className="mb-4 rounded-md border border-[hsl(var(--amber))]/30 bg-[hsl(var(--amber))]/10 px-3 py-2 text-sm text-[hsl(var(--amber))]">
              Demo mode — Microsoft Entra SSO isn't configured yet. Set AZURE_TENANT_ID, AZURE_CLIENT_ID and AZURE_CLIENT_SECRET to require sign-in.
            </div>
          )}
          <div className="mb-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight sm:text-[28px]">Bouquet team desk</h1>
              <span className="text-sm text-muted-foreground">{fmtDateLong(todayISO())}</span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {kpis.map((k) => (
                <div key={k.label} className="rounded-lg border bg-card px-4 py-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k.label}</div>
                  <div className="mt-0.5 flex items-baseline gap-2">
                    <span className={cn("font-display text-3xl font-bold", k.warn ? "text-[hsl(var(--amber))]" : "text-primary")}>{k.value}</span>
                    <span className="text-sm text-muted-foreground">{k.sub}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {tab === "visits" && <VisitsView visits={visits} stores={boot.stores} />}
          {tab === "credits" && <CreditsView visits={visits} stores={boot.stores} onDecide={decide} canApprove={me.permissions.approveCredits} />}
          {tab === "orders" && <OrdersView stores={orderStores} onRefresh={refreshOrders} refreshing={refreshingOrders} />}
          {tab === "log" && (
            <LogVisitView
              stores={boot.stores}
              catalogue={boot.catalogue}
              userName={me.user.name}
              reasons={boot.reasons}
              onSubmit={addVisit}
            />
          )}
        </main>
      </div>

      <Toaster position="top-right" richColors />
    </div>
  );
}
