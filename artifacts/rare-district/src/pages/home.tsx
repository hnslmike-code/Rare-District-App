import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "wouter";
import { useAddToWardrobe, useGetStorefrontSummary, useListProducts } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, ShoppingBag, X } from "lucide-react";
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

type HomepageContent = {
  hero: {
    eyebrow: string; title: string; accent: string; description: string;
    primaryLabel: string; primaryHref: string; secondaryLabel: string; secondaryHref: string;
    release: string; visualLabel: string; location: string; proof: string[]; productIds: number[];
  };
  carousel: { eyebrow: string; title: string; productIds: number[]; autoplay: boolean };
  sections: { latest: boolean; editorial: boolean; designers: boolean };
};

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

function LayeredCarousel({ entries, onQuickAdd, autoplay = true }: { entries: CarouselEntry[]; onQuickAdd: (product: Product) => void; autoplay?: boolean }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const count = entries.length;
  const safeIndex = count ? active % count : 0;

  useEffect(() => {
    if (paused || !autoplay || prefersReducedMotion || count < 2) return;
    const timer = window.setInterval(() => setActive((current) => current + 1), 5200);
    return () => window.clearInterval(timer);
  }, [paused, autoplay, prefersReducedMotion, count]);

  const go = (delta: number) => setActive((current) => (current + delta + count) % count);
  const getEntry = (offset: number) => entries[(safeIndex + offset + count) % count];
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    setDragStart(event.clientX);
    setDragOffset(0);
    setIsDragging(true);
    setPaused(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStart === null) return;
    const delta = event.clientX - dragStart;
    setDragOffset(Math.max(-150, Math.min(150, delta)));
  };
  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStart !== null && Math.abs(event.clientX - dragStart) > 45) {
      go(event.clientX < dragStart ? 1 : -1);
    }
    setDragStart(null);
    setDragOffset(0);
    setIsDragging(false);
    if (event.pointerType === "touch") setPaused(false);
  };
  if (!count) return <div className="border border-border py-24 text-center text-muted-foreground">The edit is being assembled.</div>;

  return (
    <div className="layered-carousel" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className={`layered-carousel-stage${isDragging ? " is-dragging" : ""}`} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={finishDrag} onPointerCancel={finishDrag} onKeyDown={(event) => { if (event.key === "ArrowRight") go(1); if (event.key === "ArrowLeft") go(-1); }} tabIndex={0} aria-label="Featured product carousel">
        {[-1, 0, 1].map((offset) => {
          const entry = getEntry(offset);
          const product = entry.product;
          const isActive = offset === 0;
          return (
            <article key={`${entry.kind}-${product.id}`} className={`layered-slide ${isActive ? "is-active" : offset < 0 ? "is-prev" : "is-next"}`} style={{ "--drag-offset": `${dragOffset}px` } as CSSProperties}>
              <Link href={entry.kind === "collection" ? `/shop?category=${entry.category}` : `/product/${product.id}`} className="block h-full" tabIndex={isActive ? 0 : -1}>
                <div className="layered-slide-image">
                  {imageUrl(product) ? <img src={imageUrl(product)} alt={entry.kind === "collection" ? entry.title : product.name} draggable={false} /> : <ProductPlaceholder product={product} collection={entry.kind === "collection"} />}
                </div>
                {isActive && <div className="layered-slide-copy"><p className="eyebrow">{product.vendor?.brandName || "Rare District edit"}</p><h3>{entry.kind === "collection" ? entry.title : product.name}</h3><p className="layered-slide-price">{entry.kind === "collection" ? "Browse the edit" : money(product)}</p>{entry.kind === "product" && product.stock ? <p className="layered-stock"><span aria-hidden="true" /> Only {product.stock} left</p> : null}</div>}
              </Link>
              {isActive && entry.kind === "product" && <button onClick={() => onQuickAdd(product)} className="layered-quick-add"><ShoppingBag className="h-4 w-4" /> Quick add</button>}
            </article>
          );
        })}
      </div>
      <div className="mt-8 flex items-center justify-center gap-5">
        <button onClick={() => go(-1)} className="carousel-control" aria-label="Previous featured item"><ArrowLeft className="h-4 w-4" /></button>
        <button onClick={() => go(1)} className="carousel-control" aria-label="Next featured item"><ArrowRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

export default function Home() {
  const { data: summary, isLoading } = useGetStorefrontSummary();
  const newest = useListProducts({ sortBy: "newest", limit: 100 }, { query: { queryKey: ["home-products", "newest"] } });
  const popular = useListProducts({ sortBy: "popular", limit: 4 }, { query: { queryKey: ["home-products", "popular"] } });
  const homepage = useQuery<{ content: HomepageContent }>({
    queryKey: ["storefront-homepage"],
    queryFn: async () => {
      const response = await fetch("/api/storefront/homepage");
      if (!response.ok) throw new Error("Homepage configuration is unavailable.");
      return response.json();
    },
    staleTime: 30_000,
  });
  const [quickAdd, setQuickAdd] = useState<Product | null>(null);
  const products = (newest.data?.items || []) as Product[];
  const content = homepage.data?.content;
  const productsById = useMemo(() => new Map(products.map(product => [product.id, product])), [products]);
  const configuredHeroProducts = content?.hero.productIds.map(id => productsById.get(id)).filter((product): product is Product => Boolean(product)) ?? [];
  const heroProducts = configuredHeroProducts.length ? configuredHeroProducts : products.slice(0, 2);
  const edit = useMemo<CarouselEntry[]>(() => {
    const configured = content?.carousel.productIds.map(id => productsById.get(id)).filter((product): product is Product => Boolean(product)) ?? [];
    const source = configured.length ? configured : products.slice(0, 6);
    return source.flatMap((product, index) => {
      const entries: CarouselEntry[] = [{ kind: "product", product }];
      if (index === 1 || index === 3) {
        const category = product.category || "new arrivals";
        entries.push({ kind: "collection", product, category, title: `${category.replace(/-/g, " ")} / the edit` });
      }
      return entries;
    });
  }, [content?.carousel.productIds, products, productsById]);
  const featured = (summary?.featuredProducts || []) as Product[];

  if (isLoading) return <div className="container mx-auto space-y-12 px-4 py-16"><Skeleton className="h-[70vh] w-full" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="home-page">
      <section className="rd-hero">
        <div className="rd-hero-copy">
          <p className="rd-hero-kicker"><span aria-hidden="true" /> {content?.hero.eyebrow ?? "Drop 01 / now live"}</p>
          <h1>{content?.hero.title ?? "Wear the"}<br /><em>{content?.hero.accent ?? "next wave."}</em></h1>
          <p className="rd-hero-description">{content?.hero.description ?? "The new names, rare pieces, and future-facing African fashion worth finding before everyone else does."}</p>
          <div className="rd-hero-actions">
            <Link href={content?.hero.primaryHref ?? "/shop?category=new"} className="rd-primary-button" data-testid="link-enter-district">{content?.hero.primaryLabel ?? "Shop new drop"} <ArrowRight className="h-4 w-4" /></Link>
            <Link href={content?.hero.secondaryHref ?? "/shop?category=designers"} className="rd-hero-secondary">{content?.hero.secondaryLabel ?? "Meet the designers"} <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <p className="rd-hero-proof">{(content?.hero.proof ?? ["Independent labels", "Private releases", "Lagos to global"]).map((item, index) => <span key={item} className="contents">{index > 0 ? <i>·</i> : null}{item}</span>)}</p>
        </div>
        <div className="rd-hero-visual" aria-label="New arrivals preview">
          <p className="rd-hero-visual-label">{(content?.hero.visualLabel ?? "Rare District\nFuture archive").split("\n").map((line) => <span key={line} className="block">{line}</span>)}</p>
          <span className="rd-hero-release">{content?.hero.release ?? "01"}</span>
          {heroProducts[0] ? (
            <Link href={`/product/${heroProducts[0].id}`} className="rd-hero-product rd-hero-product-main">
              {imageUrl(heroProducts[0]) ? <img src={imageUrl(heroProducts[0])} alt={heroProducts[0].name} /> : <ProductPlaceholder product={heroProducts[0]} />}
              <span>{heroProducts[0].name}</span>
            </Link>
          ) : <div className="rd-hero-product rd-hero-product-main rd-hero-product-empty"><img src="/brand/rd-mark.png" alt="" /></div>}
          {heroProducts[1] ? (
            <Link href={`/product/${heroProducts[1].id}`} className="rd-hero-product rd-hero-product-side">
              {imageUrl(heroProducts[1]) ? <img src={imageUrl(heroProducts[1])} alt={heroProducts[1].name} /> : <ProductPlaceholder product={heroProducts[1]} />}
              <span>{heroProducts[1].name}</span>
            </Link>
          ) : null}
          <p className="rd-hero-location">{(content?.hero.location ?? "Lagos / Worldwide").split("/").map((item, index) => <span key={`${item}-${index}`}>{index > 0 ? <i>/</i> : null}{item.trim()}</span>)}</p>
        </div>
      </section>

      <section className="carousel-section" data-testid="section-featured-carousel">
        <div className="container mx-auto px-4 md:px-6">
          <div className="section-heading"><div><p className="eyebrow">{content?.carousel.eyebrow ?? "The district edit / 01"}</p><h2>{content?.carousel.title ?? "Pieces with presence."}</h2></div><Link href="/shop" className="text-xs font-bold uppercase tracking-[0.2em] hover:underline">Shop all <ArrowRight className="ml-2 inline h-3.5 w-3.5" /></Link></div>
          <LayeredCarousel entries={edit} onQuickAdd={setQuickAdd} autoplay={content?.carousel.autoplay ?? true} />
        </div>
      </section>

      {(content?.sections.latest ?? true) && <section className="container mx-auto px-4 py-20 md:px-6 md:py-28">
        <div className="section-heading"><div><p className="eyebrow">The latest arrivals</p><h2>New in the district.</h2></div><Link href="/shop?category=new" className="text-xs font-bold uppercase tracking-[0.2em] hover:underline">Explore new <ArrowRight className="ml-2 inline h-3.5 w-3.5" /></Link></div>
        {newest.isLoading ? <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="aspect-[3/4]" />)}</div> : <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">{products.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} showWardrobe={false} dataTestId={`home-product-${product.id}`} />)}</div>}
      </section>}

      {(content?.sections.editorial ?? true) && <section className="editorial-band"><div className="editorial-band-inner container mx-auto px-4 py-20 md:px-6 md:py-28"><div className="editorial-band-copy"><p className="eyebrow">The house edit</p><h2>Find the brand<br /><em>before the trend.</em></h2><div className="editorial-band-body"><p>Rare District brings the ateliers, cult labels, and emerging voices of contemporary African fashion into one considered marketplace.</p><Link href="/shop?category=designers" className="editorial-band-link">Meet the designers <ArrowRight className="h-4 w-4" /></Link></div></div></div></section>}

      {(content?.sections.designers ?? true) && <section className="container mx-auto px-4 py-20 md:px-6 md:py-28">
        <div className="section-heading"><div><p className="eyebrow">The ateliers</p><h2>Start with a name.</h2></div><Link href="/shop?category=designers" className="text-xs font-bold uppercase tracking-[0.2em] hover:underline">View all <ArrowRight className="ml-2 inline h-3.5 w-3.5" /></Link></div>
        <div className="grid gap-5 md:grid-cols-3">{summary?.featuredVendors?.slice(0, 3).map((vendor) => <Link key={vendor.id} href={`/vendor/${vendor.id}`} className="vendor-tile"><div className="vendor-tile-mark">{vendor.logoUrl ? <img src={vendor.logoUrl} alt="" /> : vendor.brandName.charAt(0)}</div><div><p className="eyebrow">{vendor.description || "Independent atelier"}</p><h3>{vendor.brandName}</h3></div><ArrowRight className="h-4 w-4" /></Link>)}</div>
      </section>}
      <QuickAddDrawer product={quickAdd} onClose={() => setQuickAdd(null)} />
    </div>
  );
}
