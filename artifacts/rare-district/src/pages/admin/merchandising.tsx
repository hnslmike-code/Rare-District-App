import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useListAdminProducts } from "@workspace/api-client-react";
import { Check, Clock3, Eye, Loader2, Save, Send, SlidersHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { adminJson } from "@/lib/admin-control";

type HomepageContent = {
  hero: {
    eyebrow: string; title: string; accent: string; description: string;
    primaryLabel: string; primaryHref: string; secondaryLabel: string; secondaryHref: string;
    release: string; visualLabel: string; location: string; proof: string[]; productIds: number[];
  };
  carousel: { eyebrow: string; title: string; productIds: number[]; autoplay: boolean };
  sections: { latest: boolean; editorial: boolean; designers: boolean };
};

type HomepageConfig = {
  id: number;
  draftContent: HomepageContent;
  publishedContent: HomepageContent | null;
  scheduledContent: HomepageContent | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
};

const inputClass = "mt-1 w-full border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-foreground";
const labelClass = "text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground";

export default function AdminMerchandising() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<HomepageContent | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const config = useQuery({
    queryKey: ["admin-homepage"],
    queryFn: () => adminJson<HomepageConfig>("/api/admin/homepage"),
  });
  const products = useListAdminProducts({ limit: 100 }, { query: { queryKey: ["admin-products-merchandising"] } });

  useEffect(() => {
    if (config.data?.draftContent) setDraft(config.data.draftContent);
    if (config.data?.scheduledAt) setScheduleAt(config.data.scheduledAt.slice(0, 16));
  }, [config.data]);

  const productMap = useMemo(() => new Map((products.data ?? []).map(product => [product.id, product])), [products.data]);
  const saveDraft = useMutation({
    mutationFn: (content: HomepageContent) => adminJson<HomepageConfig>("/api/admin/homepage", { method: "PATCH", body: JSON.stringify(content) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-homepage"] });
      toast({ title: "Homepage draft saved." });
    },
    onError: (error: Error) => toast({ title: "Draft not saved", description: error.message, variant: "destructive" }),
  });
  const publish = useMutation({
    mutationFn: (payload: { mode: "now" | "schedule"; scheduledAt?: string }) => adminJson<HomepageConfig>("/api/admin/homepage/publish", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-homepage"] });
      queryClient.invalidateQueries({ queryKey: ["storefront-homepage"] });
      toast({ title: variables.mode === "now" ? "Homepage published." : "Homepage scheduled." });
    },
    onError: (error: Error) => toast({ title: "Publish not completed", description: error.message, variant: "destructive" }),
  });

  const changeHero = <K extends keyof HomepageContent["hero"]>(key: K, value: HomepageContent["hero"][K]) => setDraft(current => current ? { ...current, hero: { ...current.hero, [key]: value } } : current);
  const changeCarousel = <K extends keyof HomepageContent["carousel"]>(key: K, value: HomepageContent["carousel"][K]) => setDraft(current => current ? { ...current, carousel: { ...current.carousel, [key]: value } } : current);
  const changeSection = (key: keyof HomepageContent["sections"], value: boolean) => setDraft(current => current ? { ...current, sections: { ...current.sections, [key]: value } } : current);

  const toggleProduct = (target: "hero" | "carousel", productId: number, limit: number) => {
    if (!draft) return;
    const currentIds = target === "hero" ? draft.hero.productIds : draft.carousel.productIds;
    const nextIds = currentIds.includes(productId) ? currentIds.filter(id => id !== productId) : [...currentIds, productId].slice(-limit);
    target === "hero" ? changeHero("productIds", nextIds) : changeCarousel("productIds", nextIds);
  };

  if (config.isLoading || !draft) {
    return <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading merchandising studio…</div>;
  }

  const selectedHero = draft.hero.productIds.map(id => productMap.get(id)).filter(Boolean);
  const selectedCarousel = draft.carousel.productIds.map(id => productMap.get(id)).filter(Boolean);
  return (
    <div className="space-y-8" data-testid="admin-merchandising">
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-6 lg:flex-row lg:items-end">
        <div>
          <p className="eyebrow">Storefront control</p>
          <h1 className="mt-2 font-serif text-4xl font-medium tracking-tight">Merchandising studio</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Edit the homepage as a draft, choose the exact products that appear, then publish now or schedule the drop.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-border px-3 py-2 text-xs font-bold uppercase tracking-widest hover:bg-secondary"><Eye className="h-3.5 w-3.5" /> Preview storefront</a>
          <button onClick={() => saveDraft.mutate(draft)} disabled={saveDraft.isPending} className="inline-flex items-center gap-2 border border-foreground px-3 py-2 text-xs font-bold uppercase tracking-widest hover:bg-secondary disabled:opacity-50"><Save className="h-3.5 w-3.5" /> Save draft</button>
          <button onClick={() => publish.mutate({ mode: "now" })} disabled={publish.isPending} className="inline-flex items-center gap-2 bg-foreground px-4 py-2 text-xs font-bold uppercase tracking-widest text-background hover:bg-foreground/85 disabled:opacity-50"><Send className="h-3.5 w-3.5" /> Publish now</button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <section className="space-y-6">
          <div className="border border-border p-5 md:p-6">
            <div className="mb-5 flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" /><h2 className="font-serif text-2xl">Hero content</h2></div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className={labelClass}>Drop label<input value={draft.hero.eyebrow} onChange={event => changeHero("eyebrow", event.target.value)} className={inputClass} /></label>
              <label className={labelClass}>Release number<input value={draft.hero.release} onChange={event => changeHero("release", event.target.value)} className={inputClass} /></label>
              <label className={labelClass}>Headline<input value={draft.hero.title} onChange={event => changeHero("title", event.target.value)} className={inputClass} /></label>
              <label className={labelClass}>Italic line<input value={draft.hero.accent} onChange={event => changeHero("accent", event.target.value)} className={inputClass} /></label>
              <label className={`${labelClass} md:col-span-2`}>Description<textarea value={draft.hero.description} onChange={event => changeHero("description", event.target.value)} className={`${inputClass} min-h-24 resize-y`} /></label>
              <label className={labelClass}>Primary CTA<input value={draft.hero.primaryLabel} onChange={event => changeHero("primaryLabel", event.target.value)} className={inputClass} /></label>
              <label className={labelClass}>Primary link<input value={draft.hero.primaryHref} onChange={event => changeHero("primaryHref", event.target.value)} className={inputClass} /></label>
              <label className={labelClass}>Secondary CTA<input value={draft.hero.secondaryLabel} onChange={event => changeHero("secondaryLabel", event.target.value)} className={inputClass} /></label>
              <label className={labelClass}>Secondary link<input value={draft.hero.secondaryHref} onChange={event => changeHero("secondaryHref", event.target.value)} className={inputClass} /></label>
            </div>
          </div>

          <div className="border border-border p-5 md:p-6">
            <div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="font-serif text-2xl">Hero product stack</h2><p className="mt-1 text-xs text-muted-foreground">Choose up to two products. Selection order becomes the front and back card order.</p></div><span className="text-xs font-bold tracking-widest text-muted-foreground">{selectedHero.length}/2</span></div>
            <div className="grid gap-2 sm:grid-cols-2">
              {(products.data ?? []).map(product => {
                const selected = draft.hero.productIds.includes(product.id);
                return <button key={product.id} onClick={() => toggleProduct("hero", product.id, 2)} className={`flex items-center gap-3 border p-3 text-left transition ${selected ? "border-foreground bg-secondary" : "border-border hover:border-foreground/50"}`}>
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center border ${selected ? "border-foreground bg-foreground text-background" : "border-border"}`}>{selected ? <Check className="h-3 w-3" /> : null}</span>
                  <span className="min-w-0"><span className="block truncate text-sm font-medium">{product.name}</span><span className="mt-0.5 block text-xs text-muted-foreground">{product.stock} in stock</span></span>
                </button>;
              })}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="border border-border p-5 md:p-6">
            <h2 className="font-serif text-2xl">Carousel</h2>
            <div className="mt-4 space-y-4">
              <label className={labelClass}>Eyebrow<input value={draft.carousel.eyebrow} onChange={event => changeCarousel("eyebrow", event.target.value)} className={inputClass} /></label>
              <label className={labelClass}>Heading<input value={draft.carousel.title} onChange={event => changeCarousel("title", event.target.value)} className={inputClass} /></label>
              <label className="flex cursor-pointer items-center justify-between border border-border p-3 text-sm">Autoplay carousel<input type="checkbox" checked={draft.carousel.autoplay} onChange={event => changeCarousel("autoplay", event.target.checked)} /></label>
              <p className="text-xs text-muted-foreground">Selected {selectedCarousel.length}/12 products. Click items below to add or remove them; use the carousel selection order to shape the edit.</p>
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {(products.data ?? []).map(product => {
                  const selected = draft.carousel.productIds.includes(product.id);
                  return <button key={product.id} onClick={() => toggleProduct("carousel", product.id, 12)} className={`flex w-full items-center justify-between border p-2.5 text-left text-sm transition ${selected ? "border-foreground bg-secondary" : "border-border hover:border-foreground/50"}`}><span className="truncate pr-2">{product.name}</span>{selected ? <Check className="h-4 w-4 shrink-0" /> : null}</button>;
                })}
              </div>
            </div>
          </div>

          <div className="border border-border p-5 md:p-6">
            <h2 className="font-serif text-2xl">Homepage sections</h2>
            <div className="mt-4 space-y-2">
              {([["latest", "New in the district"], ["editorial", "Editorial band"], ["designers", "Featured designers"]] as const).map(([key, label]) => <label key={key} className="flex cursor-pointer items-center justify-between border border-border p-3 text-sm"><span>{label}</span><input type="checkbox" checked={draft.sections[key]} onChange={event => changeSection(key, event.target.checked)} /></label>)}
            </div>
          </div>

          <div className="border border-border bg-secondary/40 p-5 md:p-6">
            <div className="flex items-center gap-2"><Clock3 className="h-4 w-4" /><h2 className="font-serif text-2xl">Schedule a drop</h2></div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">The currently published homepage stays live until the chosen time. At that time, this draft becomes the public storefront automatically.</p>
            <input type="datetime-local" value={scheduleAt} onChange={event => setScheduleAt(event.target.value)} className={`${inputClass} mt-4`} />
            <button onClick={() => { if (!scheduleAt) { toast({ title: "Choose a publish time first.", variant: "destructive" }); return; } publish.mutate({ mode: "schedule", scheduledAt: new Date(scheduleAt).toISOString() }); }} disabled={publish.isPending} className="mt-3 flex w-full items-center justify-center gap-2 bg-foreground px-4 py-3 text-xs font-bold uppercase tracking-widest text-background disabled:opacity-50"><Clock3 className="h-3.5 w-3.5" /> Schedule this draft</button>
            {config.data?.scheduledAt ? <p className="mt-3 text-xs text-muted-foreground">Scheduled: {new Date(config.data.scheduledAt).toLocaleString()}</p> : null}
          </div>
        </aside>
      </div>
    </div>
  );
}