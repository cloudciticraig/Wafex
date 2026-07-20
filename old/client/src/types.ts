export type Photo = { id: number; src: string; caption?: string | null };

export type CreditStatus = "pending" | "approved" | "rejected";

export type CreditLine = {
  id: number;
  sku: string;
  description: string;
  qty: number;
  unitCost: number;
  reason: string;
  photos: Photo[];
  status: CreditStatus;
  bcCreditMemo?: string | null;
  decidedBy?: string | null;
  decidedAt?: string | null;
};

export type Condition = "Excellent" | "Good" | "Needs attention";

export type Visit = {
  id: number;
  storeId: number;
  merchandiser: string;
  date: string;
  timeIn: string;
  timeOut: string;
  displayPhotos: Photo[];
  condition: Condition;
  notes: string;
  concerns?: string | null;
  credits: CreditLine[];
};

export type Store = {
  id: number;
  name: string;
  banner: string;
  suburb: string;
  bcCustomerNo: string;
  contact: string;
};

export type OrderLine = { sku: string; description: string; qty: number; unitPrice: number };

export type SalesOrder = {
  id: number;
  orderNo: string;
  deliveryDate: string;
  status: string;
  lines: OrderLine[];
};

export type StoreWithOrders = Store & { orders: SalesOrder[] };

export type CatalogueItem = { sku: string; description: string; unitCost: number; unitPrice: number };

export type Bootstrap = {
  stores: Store[];
  catalogue: CatalogueItem[];
  merchandisers: string[];
  reasons: string[];
  bcLastSync: string | null;
};

export const aud = (n: number) => n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });

export function fmtDate(iso: string) {
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}

export function fmtDateLong(iso: string) {
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const addDaysISO = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export type Me = {
  user: { name: string; email: string; roles: string[]; demo: boolean };
  authConfigured: boolean;
  permissions: { approveCredits: boolean; logVisits: boolean };
};
