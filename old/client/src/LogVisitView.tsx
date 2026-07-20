import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { aud, todayISO, type CatalogueItem, type Condition, type Store } from "./types";
import { UserCircle2 } from "lucide-react";
import { downscaleImage, samplePhotoBlob } from "./api";
import { SectionTitle } from "./bits";
import { Camera, ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";

let uid = 0;
const newId = () => `local-${++uid}`;

type LocalPhoto = { key: string; blob: Blob; previewUrl: string };

function PhotoPicker({
  photos,
  onAdd,
  onRemove,
  label,
  sampleKind,
}: {
  photos: LocalPhoto[];
  onAdd: (p: LocalPhoto[]) => void;
  onRemove: (key: string) => void;
  label: string;
  sampleKind: "display" | "waste";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {photos.map((p) => (
          <div key={p.key} className="relative">
            <img src={p.previewUrl} alt="Photo" className="h-20 w-28 rounded-md border object-cover" />
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => onRemove(p.key)}
              className="absolute -right-1.5 -top-1.5 rounded-full border bg-card p-1 shadow-sm hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-20 w-28 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-input text-muted-foreground hover:border-primary hover:text-primary"
        >
          <Camera className="h-5 w-5" />
          <span className="text-[11px] font-medium">{label}</span>
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          const out: LocalPhoto[] = [];
          for (const f of files) {
            const blob = await downscaleImage(f);
            out.push({ key: newId(), blob, previewUrl: URL.createObjectURL(blob) });
          }
          onAdd(out);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
        onClick={() => {
          const blob = samplePhotoBlob(sampleKind);
          onAdd([{ key: newId(), blob, previewUrl: URL.createObjectURL(blob) }]);
        }}
      >
        <ImagePlus className="h-3 w-3" /> Add a sample photo (demo)
      </button>
    </div>
  );
}

type DraftCredit = { key: string; sku: string; qty: number; reason: string; photos: LocalPhoto[] };

export function LogVisitView({
  stores,
  catalogue,
  userName,
  reasons,
  onSubmit,
}: {
  stores: Store[];
  catalogue: CatalogueItem[];
  userName: string;
  reasons: string[];
  onSubmit: (input: {
    storeId: number;
    date: string;
    timeIn: string;
    timeOut: string;
    condition: Condition;
    notes: string;
    concerns?: string;
    displayPhotos: Blob[];
    credits: { sku: string; qty: number; reason: string; photos: Blob[] }[];
  }) => Promise<void>;
}) {
  const [storeId, setStoreId] = useState<string>("");
  const [timeIn, setTimeIn] = useState("08:00");
  const [timeOut, setTimeOut] = useState("08:45");
  const [condition, setCondition] = useState<Condition>("Good");
  const [notes, setNotes] = useState("");
  const [concerns, setConcerns] = useState("");
  const [displayPhotos, setDisplayPhotos] = useState<LocalPhoto[]>([]);
  const [credits, setCredits] = useState<DraftCredit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const addCredit = () =>
    setCredits((c) => [...c, { key: newId(), sku: catalogue[0]?.sku ?? "", qty: 1, reason: reasons[0] ?? "", photos: [] }]);

  const updateCredit = (key: string, patch: Partial<DraftCredit>) =>
    setCredits((c) => c.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const submit = async () => {
    if (!storeId) return setError("Choose the store you visited.");
    if (displayPhotos.length === 0) return setError("Add at least one photo of the display.");
    if (!notes.trim()) return setError("Add a short note about the visit.");
    if (credits.some((c) => c.photos.length === 0))
      return setError("Every credit line needs at least one photo of the product being credited.");
    setError(null);
    setSaving(true);
    try {
      await onSubmit({
        storeId: Number(storeId),
        date: todayISO(),
        timeIn,
        timeOut,
        condition,
        notes: notes.trim(),
        concerns: concerns.trim() || undefined,
        displayPhotos: displayPhotos.map((p) => p.blob),
        credits: credits.map((c) => ({ sku: c.sku, qty: c.qty, reason: c.reason, photos: c.photos.map((p) => p.blob) })),
      });
      displayPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      credits.forEach((c) => c.photos.forEach((p) => URL.revokeObjectURL(p.previewUrl)));
      setStoreId("");
      setNotes("");
      setConcerns("");
      setDisplayPhotos([]);
      setCredits([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the visit — check the connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <SectionTitle>Log a store visit</SectionTitle>
      <p className="-mt-1 mb-4 text-sm text-muted-foreground">
        Capture the display, note anything raised with the store team, and request credits for waste. Credits go to the bouquet team for approval before posting to Business Central.
      </p>

      <Card className="space-y-5 p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Store</Label>
            <Select value={storeId} onValueChange={setStoreId}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Select store…" /></SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Merchandiser</Label>
            <div className="flex h-11 items-center gap-2 rounded-md border bg-muted/40 px-3 text-sm">
              <UserCircle2 className="h-4 w-4 text-primary" />
              <span className="truncate">{userName}</span>
              <span className="ml-auto text-xs text-muted-foreground">from sign-in</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tin">Time in</Label>
              <Input id="tin" type="time" className="h-11" value={timeIn} onChange={(e) => setTimeIn(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tout">Time out</Label>
              <Input id="tout" type="time" className="h-11" value={timeOut} onChange={(e) => setTimeOut(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Display condition</Label>
            <Select value={condition} onValueChange={(v) => setCondition(v as Condition)}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["Excellent", "Good", "Needs attention"] as Condition[]).map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Display photos</Label>
          <PhotoPicker
            photos={displayPhotos}
            onAdd={(p) => setDisplayPhotos((d) => [...d, ...p])}
            onRemove={(key) => setDisplayPhotos((d) => d.filter((x) => x.key !== key))}
            label="Take photo"
            sampleKind="display"
          />
          <p className="text-xs text-muted-foreground">On a tablet this opens the camera; on a laptop it opens the file picker. Photos are resized before upload.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Visit notes</Label>
          <Textarea id="notes" rows={3} placeholder="Stock rotated, water topped up, sell-through since last visit…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="concerns">Raised with the store team <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Textarea id="concerns" rows={2} placeholder="Anything discussed with the fresh manager that needs follow-up…" value={concerns} onChange={(e) => setConcerns(e.target.value)} />
        </div>

        <Separator />

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label className="text-base">Credits to request</Label>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addCredit}>
              <Plus className="h-4 w-4" /> Add credit line
            </Button>
          </div>
          {credits.length === 0 && (
            <p className="text-sm text-muted-foreground">No credits this visit — add a line if any product needs to be written off.</p>
          )}
          <div className="space-y-3">
            {credits.map((c) => {
              const item = catalogue.find((i) => i.sku === c.sku);
              return (
                <div key={c.key} className="rounded-md border bg-muted/30 p-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_90px]">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Product</Label>
                      <Select value={c.sku} onValueChange={(v) => updateCredit(c.key, { sku: v })}>
                        <SelectTrigger className="h-10 bg-card"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {catalogue.map((i) => (
                            <SelectItem key={i.sku} value={i.sku}>{i.description}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Qty</Label>
                      <Input
                        type="number"
                        min={1}
                        className="h-10 bg-card"
                        value={c.qty}
                        onChange={(e) => updateCredit(c.key, { qty: Math.max(1, Number(e.target.value) || 1) })}
                      />
                    </div>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <Label className="text-xs">Reason</Label>
                    <Select value={c.reason} onValueChange={(v) => updateCredit(c.key, { reason: v })}>
                      <SelectTrigger className="h-10 bg-card"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {reasons.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <Label className="text-xs">Photos of the product (required)</Label>
                    <PhotoPicker
                      photos={c.photos}
                      onAdd={(p) => updateCredit(c.key, { photos: [...c.photos, ...p] })}
                      onRemove={(key) => updateCredit(c.key, { photos: c.photos.filter((x) => x.key !== key) })}
                      label="Take photo"
                      sampleKind="waste"
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Credit value: <span className="font-semibold text-foreground">{aud(c.qty * (item?.unitCost ?? 0))}</span>
                    </span>
                    <Button type="button" variant="ghost" size="sm" className="gap-1 text-destructive hover:text-destructive" onClick={() => setCredits((cs) => cs.filter((x) => x.key !== c.key))}>
                      <Trash2 className="h-4 w-4" /> Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {error && <p className="rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive">{error}</p>}

        <Button className="h-12 w-full text-base" onClick={submit} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {saving ? "Saving visit…" : `Submit visit${credits.length > 0 ? ` & ${credits.length} credit request${credits.length > 1 ? "s" : ""}` : ""}`}
        </Button>
      </Card>
    </div>
  );
}
