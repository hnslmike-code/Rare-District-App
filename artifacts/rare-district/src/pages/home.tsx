import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useAddToWardrobe, useGetStorefrontSummary, useListProducts } from "@workspace/api-client-react";
import { ArrowLeft, ArrowRight, Pause, Play, ShoppingBag, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductCard } from "@/components/ProductCard";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type Product = {
  id: number;
  vendorId: number;
  name: string;
  price: number;
  currency?: string;
  images?: string[];
  stock?: number;
  sizes?: string[];
  category?: string | null;
  vendor?: { id: number; brandName: string };
};

type CarouselEntry =
  | { kind: "product"; product: Product }
  | { kind: "collection"; product: Product; title: string; category: string };

function imageUrl(product?: Product) {
  const image = product?.images?.[0];
  if (!image) return undefined;
  return image.startsWith("http") || image.startsWith("/") || image.startsWith("data:") ? image : `/api/storage/objects/${image}`;
}

function money(product: Product) {
  return `${product.currency || "₦"} ${product.price.toLocaleString()}`;
}

function ProductPlaceholder({ product, collection = false }: { product: Product; collection?: boolean }) {
  return (
    <div className={`product-placeholder ${collection ? "is-collection" : ""}`}>
      <span className="product-placeholder-index">{collection ? "EDIT" : `0${(product.id % 9) + 1}`}</span>
      <strong>{collection ? `${product.category || "The"} edit` : product.name}</strong>
      <span>{product.vendor?.brandName || "Rare District"}</span>
    </div>
  );
}

function QuickAddDrawer({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [size, setSize] = useState(product?.sizes?.[0] || "");
  const addToWardrobe = useAddToWardrobe({
    mutation: {
      onSuccess: () => {
        toast({ title: "Added to wardrobe", description: product?.name });
        onClose();
      },
      onError: () => toast({ title: "Unable to add this piece", description: "Please sign in and try again.", variant: "destructive" }),
    },
  });

  useEffect(() => setSize(product?.sizes?.[0] || ""), [product]);
  if (!product) return null;

  const add = () => {
    if (!isAuthenticated) {
      toast({ title: "Sign in to save this piece", description: "Your wardrobe is ready when you are." });
      return;
    }
    addToWardrobe.mutate({ data: { productId: product.id, quantity: 1 } });
  };

  return (
    <div className="fixed inset-0 z-[70] flex justify-end" role="dialog" aria-modal="true" aria-label={`Quick add ${product.name}`}>
      <button className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} aria-label="Close quick add" />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col bg-background p-6 shadow-2xl sm:p-8">
        <div className="flex items-center justify-between border-b border-border pb-5">
          <div>
            <p className="eyebrow">Quick add</p>
            <h2 className="mt-2 font-serif text-2xl">{product.name}</h2>
          </div>
          <button onClick={onClose} className="rounded-full border border-border p-2 hover:bg-secondary" aria-label="Close quick add"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-8 overflow-hidden rounded-[2rem] bg-secondary">
          {imageUrl(product) ? <img src={imageUrl(product)} alt={product.name} className="aspect-[4/5] w-full object-cover" /> : <div className="aspect-[4/5] flex items-center justify-center font-serif text-4xl text-muted-foreground">RD</div>}
        </div>
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">{product.vendor?.brandName || "Rare District"}</p>
          <p className="font-serif text-xl">{money(product)}</p>
        </div>
        {product.sizes?.length ? (
          <div className="mt-7">
            <div className="mb-3 flex justify-between text-xs font-semibold uppercase tracking-[0.18em]"><span>Select size</span><span className="text-muted-foreground">Required</span></div>
            <div className="grid grid-cols-4 gap-2">
              {product.sizes.map((option) => <button key={option} onClick={() => setSize(option)} className={`border px-3 py-3 text-sm transition ${size === option ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"}`}>{option}</button>)}
            </div>
          </div>
        ) : null}
        <div className="mt-auto space-y-3 border-t border-border pt-6">
          <button onClick={add} disabled={addToWardrobe.isPending || (!!product.sizes?.length && !size)} className="flex w-full items-center justify-center gap-3 bg-foreground px-5 py-4 text-xs font-bold uppercase tracking-[0.2em] text-background transition hover:bg-muted-foreground disabled:cursor-not-allowed disabled:opacity-50">
            <ShoppingBag className="h-4 w-4" /> {addToWardrobe.isPending ? "Adding…" : "Add to wardrobe"}
          </button>
          <Link href={`/product/${product.id}`} onClick={onClose} className="block w-full border border-border px-5 py-4 text-center text-xs font-bold uppercase tracking-[0.2em] hover:bg-secondary">View full details</Link>
        </div>
      </aside>
    </div>
  );
}

function LayeredCarousel({ entries, onQuickAdd }: { entries: CarouselEntry[]; onQuickAdd: (product: Product) => void }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const count = entries.length;
  const safeIndex = count ? active % count : 0;

  useEffect(() => {
    if (paused || prefersReducedMotion || count < 2) return;
    const timer = window.setInterval(() => setActive((current) => current + 1), 5200);
    return () => window.clearInterval(timer);
  }, [paused, prefersReducedMotion, count]);

  const go = (delta: number) => setActive((current) => (current + delta + count) % count);
  const getEntry = (offset: number) => entries[(safeIndex + offset + count) % count];
  if (!count) return <div className="border border-border py-24 text-center text-muted-foreground">The edit is being assembled.</div>;

  return (
    <div className="layered-carousel" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="layered-carousel-stage" onPointerDown={(event) => { setDragStart(event.clientX); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerUp={(event) => { if (dragStart !== null && Math.abs(event.clientX - dragStart) > 45) go(event.clientX < dragStart ? 1 : -1); setDragStart(null); }} onKeyDown={(event) => { if (event.key === "ArrowRight") go(1); if (event.key === "ArrowLeft") go(-1); }} tabIndex={0} aria-label="Featured product carousel">
        {[-1, 0, 1].map((offset) => {
          const entry = getEntry(offset);
          const product = entry.product;
          const isActive = offset === 0;
          return (
            <article key={`${entry.kind}-${product.id}-${offset}`} className={`layered-slide ${isActive ? "is-active" : offset < 0 ? "is-prev" : "is-next"}`}>
              <Link href={entry.kind === "collection" ? `/shop?category=${entry.category}` : `/product/${product.id}`} className="block h-full" tabIndex={isActive ? 0 : -1}>
                <div className="layered-slide-image">
                  {imageUrl(product) ? <img src={imageUrl(product)} alt={entry.kind === "collection" ? entry.title : product.name} draggable={false} /> : <ProductPlaceholder product={product} collection={entry.kind === "collection"} />}
                </div>
                {isActive && <div className="layered-slide-copy"><p className="eyebrow">{product.vendor?.brandName || "Rare District edit"}</p><h3>{entry.kind === "collection" ? entry.title : product.name}</h3><p className="layered-slide-price">{entry.kind === "collection" ? "Browse the edit" : money(product)}</p></div>}
              </Link>
              {isActive && entry.kind === "product" && <button onClick={() => onQuickAdd(product)} className="layered-quick-add"><ShoppingBag className="h-4 w-4" /> Quick add</button>}
            </article>
          );
        })}
      </div>
      <div className="mt-8 flex items-center justify-center gap-5">
        <button onClick={() => go(-1)} className="carousel-control" aria-label="Previous featured item"><ArrowLeft className="h-4 w-4" /></button>
        <div className="flex items-center gap-2" aria-label={`${safeIndex + 1} of ${count}`}>
          {entries.slice(0, Math.min(count, 6)).map((entry, index) => <button key={`${entry.kind}-${entry.product.id}`} aria-label={`Go to item ${index + 1}`} onClick={() => setActive(index)} className={`carousel-dot ${index === safeIndex ? "is-active" : ""}`} />)}
        </div>
        <button onClick={() => go(1)} className="carousel-control" aria-label="Next featured item"><ArrowRight className="h-4 w-4" /></button>
        <button onClick={() => setPaused((value) => !value)} className="carousel-play" aria-label={paused ? "Play carousel" : "Pause carousel"}>{paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}</button>
      </div>
      <p className="mt-4 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Swipe to explore · {safeIndex + 1} / {count}</p>
    </div>
  );
}

export default function Home() {
  const { data: summary, isLoading } = useGetStorefrontSummary();
  const newest = useListProducts({ sortBy: "newest", limit: 8 }, { query: { queryKey: ["home-products", "newest"] } });
  const popular = useListProducts({ sortBy: "popular", limit: 4 }, { query: { queryKey: ["home-products", "popular"] } });
  const [quickAdd, setQuickAdd] = useState<Product | null>(null);
  const products = (newest.data?.items || []) as Product[];
  const edit = useMemo<CarouselEntry[]>(() => {
    const source = products.slice(0, 6);
    return source.flatMap((product, index) => {
      const entries: CarouselEntry[] = [{ kind: "product", product }];
      if (index === 1 || index === 3) {
        const category = product.category || "new arrivals";
        entries.push({ kind: "collection", product, category, title: `${category.replace(/-/g, " ")} / the edit` });
      }
      return entries;
    });
  }, [products]);
  const featured = (summary?.featuredProducts || []) as Product[];

  if (isLoading) return <div className="container mx-auto space-y-12 px-4 py-16"><Skeleton className="h-[70vh] w-full" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="home-page">
      <section className="rd-hero">
        <div className="rd-hero-copy">
          <p className="eyebrow">Lagos / Global · Private access</p>
          <h1>Curated.<br /><em>Not assembled.</em></h1>
          <p className="rd-hero-description">Contemporary African fashion, selected with intention and delivered from the designers shaping what comes next.</p>
          <Link href="/shop" className="rd-primary-button" data-testid="link-enter-district">Enter the district <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <div className="rd-hero-stamp"><img src="/brand/rd-mark.png" alt="" /><span>Built different<br />Made rare</span></div>
      </section>

      <section className="carousel-section" data-testid="section-featured-carousel">
        <div className="container mx-auto px-4 md:px-6">
          <div className="section-heading"><div><p className="eyebrow">The district edit / 01</p><h2>Pieces with presence.</h2></div><Link href="/shop" className="text-xs font-bold uppercase tracking-[0.2em] hover:underline">Shop all <ArrowRight className="ml-2 inline h-3.5 w-3.5" /></Link></div>
          <LayeredCarousel entries={edit} onQuickAdd={setQuickAdd} />
        </div>
      </section>

      <section className="container mx-auto px-4 py-20 md:px-6 md:py-28">
        <div className="section-heading"><div><p className="eyebrow">The latest arrivals</p><h2>New in the district.</h2></div><Link href="/shop?category=new" className="text-xs font-bold uppercase tracking-[0.2em] hover:underline">Explore new <ArrowRight className="ml-2 inline h-3.5 w-3.5" /></Link></div>
        {newest.isLoading ? <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="aspect-[3/4]" />)}</div> : <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">{products.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} showWardrobe={false} dataTestId={`home-product-${product.id}`} />)}</div>}
      </section>

      <section className="editorial-band"><div className="container mx-auto grid items-center gap-10 px-4 py-20 md:px-6 md:py-28 lg:grid-cols-[1.1fr_.9fr]"><div><p className="eyebrow">The house edit</p><h2>Find the brand<br /><em>before the trend.</em></h2></div><div><p className="max-w-md text-lg leading-relaxed text-muted-foreground">Rare District brings the ateliers, cult labels, and emerging voices of contemporary African fashion into one considered marketplace.</p><Link href="/shop?category=designers" className="mt-8 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] hover:underline">Meet the designers <ArrowRight className="h-4 w-4" /></Link></div></div></section>

      <section className="container mx-auto px-4 py-20 md:px-6 md:py-28">
        <div className="section-heading"><div><p className="eyebrow">The ateliers</p><h2>Start with a name.</h2></div><Link href="/shop?category=designers" className="text-xs font-bold uppercase tracking-[0.2em] hover:underline">View all <ArrowRight className="ml-2 inline h-3.5 w-3.5" /></Link></div>
        <div className="grid gap-5 md:grid-cols-3">{summary?.featuredVendors?.slice(0, 3).map((vendor) => <Link key={vendor.id} href={`/vendor/${vendor.id}`} className="vendor-tile"><div className="vendor-tile-mark">{vendor.logoUrl ? <img src={vendor.logoUrl} alt="" /> : vendor.brandName.charAt(0)}</div><div><p className="eyebrow">{vendor.description || "Independent atelier"}</p><h3>{vendor.brandName}</h3></div><ArrowRight className="h-4 w-4" /></Link>)}</div>
      </section>
      <QuickAddDrawer product={quickAdd} onClose={() => setQuickAdd(null)} />
    </div>
  );
}
