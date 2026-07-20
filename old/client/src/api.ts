import type { Bootstrap, Condition, Me, StoreWithOrders, Visit } from "./types";

export class AuthRequiredError extends Error {
  constructor() { super("Sign-in required"); this.name = "AuthRequiredError"; }
}

async function json<T>(res: Response): Promise<T> {
  if (res.status === 401) throw new AuthRequiredError();
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch { /* keep default */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  me: () => fetch("/api/me").then((r) => json<Me>(r)),
  bootstrap: () => fetch("/api/bootstrap").then((r) => json<Bootstrap>(r)),
  visits: () => fetch("/api/visits").then((r) => json<Visit[]>(r)),
  orders: () => fetch("/api/orders").then((r) => json<StoreWithOrders[]>(r)),

  decideCredit: (creditId: number, decision: "approved" | "rejected") =>
    fetch(`/api/credits/${creditId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    }).then((r) =>
      json<{ id: number; status: string; bcCreditMemo: string | null; decidedBy: string; decidedAt: string }>(r)
    ),

  createVisit: (input: {
    storeId: number;
    date: string;
    timeIn: string;
    timeOut: string;
    condition: Condition;
    notes: string;
    concerns?: string;
    displayPhotos: Blob[];
    credits: { sku: string; qty: number; reason: string; photos: Blob[] }[];
  }) => {
    const fd = new FormData();
    fd.append(
      "payload",
      JSON.stringify({
        storeId: input.storeId,
        date: input.date,
        timeIn: input.timeIn,
        timeOut: input.timeOut,
        condition: input.condition,
        notes: input.notes,
        concerns: input.concerns,
        credits: input.credits.map((c) => ({ sku: c.sku, qty: c.qty, reason: c.reason })),
      })
    );
    input.displayPhotos.forEach((b, i) => fd.append("display", b, `display-${i + 1}.jpg`));
    input.credits.forEach((c, i) =>
      c.photos.forEach((b, j) => fd.append(`credit_${i}`, b, `credit-${i + 1}-${j + 1}.jpg`))
    );
    return fetch("/api/visits", { method: "POST", body: fd }).then((r) => json<Visit>(r));
  },

  refreshOrders: () =>
    fetch("/api/bc/refresh-orders", { method: "POST" }).then((r) => json<{ syncedAt: string }>(r)),
};

/** Downscale an image file so tablets don't upload 12MP originals. */
export function downscaleImage(file: File, maxDim = 1600, quality = 0.82): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return Promise.resolve(file);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      if (scale === 1) return resolve(file);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

/** Demo-only sample photo (SVG) for trying the form without a camera. */
export function samplePhotoBlob(kind: "display" | "waste"): Blob {
  const seed = Math.floor(Math.random() * 1000);
  const pals = [
    ["#E27BA6", "#F2C14E", "#C9527E"],
    ["#F4A259", "#E76F51", "#BC4B51"],
    ["#B486C9", "#F7D6E0", "#8E5AA8"],
  ];
  const pal = pals[seed % pals.length];
  const wilt = kind === "waste";
  const rng = (n: number) => {
    const x = Math.sin(seed * 91.7 + n * 47.3) * 10000;
    return x - Math.floor(x);
  };
  let heads = "";
  for (let i = 0; i < (wilt ? 4 : 6); i++) {
    const cx = 40 + rng(i) * 240;
    const cy = (wilt ? 110 : 70) + rng(i + 10) * 60;
    const r = 14 + rng(i + 20) * 10;
    const petal = wilt ? (i % 2 ? "#B08968" : "#C8A27A") : pal[i % 2];
    heads += `<path d="M ${cx} ${cy} Q ${cx + 6} ${cy + 60} ${cx + 8} 210" stroke="${wilt ? "#8A8A5A" : "#3E7C57"}" stroke-width="3.5" fill="none"/>`;
    for (let p = 0; p < 6; p++) {
      const a = (p / 6) * Math.PI * 2;
      heads += `<circle cx="${(cx + Math.cos(a) * r).toFixed(1)}" cy="${(cy + Math.sin(a) * r).toFixed(1)}" r="${(r * 0.55).toFixed(1)}" fill="${petal}"/>`;
    }
    heads += `<circle cx="${cx}" cy="${cy}" r="${(r * 0.5).toFixed(1)}" fill="${wilt ? "#7A5C3E" : pal[2]}"/>`;
  }
  const tag = wilt ? `<rect x="8" y="8" width="86" height="24" rx="4" fill="#B23A3A"/><text x="51" y="25" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="700" fill="#fff">WASTE</text>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><rect width="320" height="240" fill="${wilt ? "#E8E4DA" : "#EEF3EA"}"/><rect y="200" width="320" height="40" fill="${wilt ? "#D6D2C6" : "#DDE6D8"}"/>${heads}${tag}</svg>`;
  return new Blob([svg], { type: "image/svg+xml" });
}
