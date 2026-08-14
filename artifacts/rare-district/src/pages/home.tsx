import { Link } from "wouter";
import { useGetStorefrontSummary, useListProducts } from "@workspace/api-client-react";
import { ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Starfield } from "@/components/visuals/Starfield";
import { ProductCard } from "@/components/ProductCard";

export default function Home() {
  const { data: summary, isLoading } = useGetStorefrontSummary();
  const newest = useListProducts({ sortBy: "newest", limit: 4 }, { query: { queryKey: ["home-products", "newest"] } });
  const popular = useListProducts({ sortBy: "popular", limit: 4 }, { query: { queryKey: ["home-products", "popular"] } });
  const ProductRail = ({ title, products, loading, testId }: { title: string; products: any[]; loading: boolean; testId: string }) => (
    <section className="py-20 md:py-28 container mx-auto px-4 md:px-6" data-testid={testId}>
      <div className="flex items-end justify-between mb-12 gap-4">
        <div><p className="text-primary text-xs font-bold tracking-[0.28em] uppercase mb-3">The district edit</p><h2 className="font-serif text-4xl md:text-5xl font-bold tracking-tight">{title}</h2></div>
        <Link href="/shop" className="text-xs font-bold tracking-widest uppercase hover:text-primary transition-colors flex items-center gap-2">Shop all <ArrowRight className="w-4 h-4" /></Link>
      </div>
      {loading ? <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4]" />)}</div> : products.length ? <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 md:gap-8">{products.map((product) => <ProductCard key={product.id} product={product} showWardrobe={false} dataTestId={`home-product-${product.id}`} />)}</div> : <div className="border border-border py-16 text-center text-muted-foreground" data-testid={`${testId}-empty`}>The edit is being assembled.</div>}
    </section>
  );

  if (isLoading) {
    return (
      <div className="animate-in fade-in duration-1000">
        <div className="h-[70vh] bg-secondary/50 starfield flex items-center justify-center">
          <Skeleton className="w-1/2 h-20 bg-background/20" />
        </div>
        <div className="container mx-auto px-4 py-20 space-y-20">
          <Skeleton className="w-full h-64" />
          <Skeleton className="w-full h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-1000">
      {/* Hero Section */}
      <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden bg-[hsl(229_25%_5%)] text-foreground hero-nebula nebula-surface">
        <Starfield density="high" />
        <div className="nebula-orb nebula-orb-gold" aria-hidden="true" />
        <div className="nebula-orb nebula-orb-indigo" aria-hidden="true" />
        <div className="nebula-orb nebula-orb-chrome" aria-hidden="true" />
        <div className="hero-grid" aria-hidden="true" />
        <div className="relative z-10 text-center px-5 max-w-4xl mx-auto mt-20 hero-panel">
           <p className="text-sm md:text-base tracking-[0.3em] uppercase mb-6 text-primary">Lagos / Global · Private access</p>
           <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl font-medium tracking-tight mb-8 leading-[1.1]">
            Curated.<br/>Not Assembled.
          </h1>
           <p className="text-lg md:text-xl text-foreground/70 mb-10 max-w-xl mx-auto font-light">
            The private district for the discerning eye. Discover contemporary African luxury from elite vanguard designers.
          </p>
            <Link href="/shop" className="inline-flex items-center justify-center chrome-button px-8 py-4 text-sm font-bold tracking-widest uppercase gap-3 group" data-testid="link-enter-district">
            Enter The District
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>

      <ProductRail title="New Arrivals" products={newest.data?.items ?? []} loading={newest.isLoading} testId="section-new-arrivals" />
      <ProductRail title="Trending Now" products={popular.data?.items ?? []} loading={popular.isLoading} testId="section-trending-now" />

      {/* Featured Products */}
      <section className="py-24 md:py-32 container mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div>
            <h2 className="font-serif text-4xl md:text-5xl font-bold tracking-tight mb-4">The Vanguard</h2>
            <p className="text-muted-foreground text-lg max-w-md">Featured pieces from our most coveted designers.</p>
          </div>
          <Link href="/shop" className="text-sm font-bold tracking-widest uppercase hover:text-primary transition-colors flex items-center gap-2 group">
            Shop All <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-8">
          {summary?.featuredProducts?.slice(0, 4).map((product) => (
            <ProductCard key={product.id} product={product} showWardrobe={false} dataTestId={`home-featured-product-${product.id}`} />
          ))}
          {(!summary?.featuredProducts || summary.featuredProducts.length === 0) && (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              <p>No featured products available at the moment.</p>
            </div>
          )}
        </div>
      </section>

      {/* Editorial Split Section */}
       <section className="bg-[hsl(229_25%_5%)] text-foreground starfield nebula-surface">
         <Starfield density="medium" />
        <div className="grid grid-cols-1 lg:grid-cols-2">
          <div className="aspect-square lg:aspect-auto relative min-h-[50vh]">
             <div className="absolute inset-0 editorial-nebula-art" role="img" aria-label="Abstract orbit artwork for the Rare District editorial" />
          </div>
          <div className="p-12 md:p-24 lg:p-32 flex flex-col justify-center">
            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-8">Quiet Luxury.<br/>Loud Impact.</h2>
             <p className="text-lg text-foreground/70 mb-12 max-w-md leading-relaxed font-light">
              We don't chase trends. We define the standard. Every piece in our district is vetted for material excellence, conceptual brilliance, and impeccable execution.
            </p>
            <Link href="/shop?category=editorial" className="self-start border-b border-background pb-1 text-sm font-bold tracking-widest uppercase hover:text-primary hover:border-primary transition-colors">
              Read The Editorial
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Vendors */}
      <section className="py-24 md:py-32 container mx-auto px-4 md:px-6">
        <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight text-center mb-16">The Ateliers</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {summary?.featuredVendors?.slice(0, 3).map((vendor) => (
            <div key={vendor.id} className="group text-center" data-testid={`home-vendor-${vendor.id}`}>
              <Link href={`/vendor/${vendor.id}`} className="block">
              <div className="w-32 h-32 mx-auto rounded-full overflow-hidden bg-secondary mb-6 relative">
                {vendor.logoUrl ? (
                  <img src={vendor.logoUrl} alt={vendor.brandName} className="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl font-serif text-muted-foreground bg-primary/10">
                    {vendor.brandName.charAt(0)}
                  </div>
                )}
              </div>
              <h3 className="font-serif text-2xl font-medium mb-3 group-hover:text-primary transition-colors">{vendor.brandName}</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto line-clamp-2">{vendor.description || "Discover the collection."}</p>
              </Link>
              <Link href={`/lookbook/${vendor.id}`} className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-primary mt-5 hover:text-foreground" data-testid={`link-home-vendor-lookbook-${vendor.id}`}>Open lookbook <ArrowRight className="w-3.5 h-3.5" /></Link>
            </div>
          ))}
          {(!summary?.featuredVendors || summary.featuredVendors.length === 0) && (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              <p>The ateliers are preparing their showrooms.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
