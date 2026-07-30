import { Link } from "wouter";
import { useGetStorefrontSummary } from "@workspace/api-client-react";
import { ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { data: summary, isLoading } = useGetStorefrontSummary();

  if (isLoading) {
    return (
      <div className="animate-in fade-in duration-1000">
        <div className="h-[70vh] bg-secondary/50 flex items-center justify-center">
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
      <section className="relative h-[80vh] flex items-center justify-center overflow-hidden bg-foreground text-background">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-40 mix-blend-overlay"></div>
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto mt-20">
          <p className="text-sm md:text-base tracking-[0.3em] uppercase mb-6 text-primary-foreground/80">Lagos / Global</p>
          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-8 leading-[1.1]">
            Curated.<br/>Not Assembled.
          </h1>
          <p className="text-lg md:text-xl text-primary-foreground/70 mb-10 max-w-xl mx-auto font-light">
            The private district for the discerning eye. Discover contemporary African luxury from elite vanguard designers.
          </p>
          <Link href="/shop" className="inline-flex items-center justify-center bg-background text-foreground px-8 py-4 text-sm font-bold tracking-widest uppercase hover:bg-primary hover:text-primary-foreground transition-all duration-300 gap-3 group">
            Enter The District
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
          {summary?.featuredProducts?.slice(0, 4).map((product) => (
            <Link key={product.id} href={`/product/${product.id}`} className="group block">
              <div className="aspect-[3/4] overflow-hidden bg-secondary mb-6 relative">
                {product.images?.[0] ? (
                  <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground font-serif">No Image</div>
                )}
                {product.stock === 0 && (
                  <div className="absolute top-4 left-4 bg-background px-3 py-1 text-xs font-bold tracking-widest uppercase">Sold Out</div>
                )}
              </div>
              <p className="text-xs font-bold tracking-widest uppercase text-muted-foreground mb-2">{product.vendor?.brandName || "Rare District"}</p>
              <h3 className="font-serif text-xl font-medium mb-2 group-hover:text-primary transition-colors">{product.name}</h3>
              <p className="text-sm">{product.currency} {product.price.toLocaleString()}</p>
            </Link>
          ))}
          {(!summary?.featuredProducts || summary.featuredProducts.length === 0) && (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              <p>No featured products available at the moment.</p>
            </div>
          )}
        </div>
      </section>

      {/* Editorial Split Section */}
      <section className="bg-foreground text-background">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          <div className="aspect-square lg:aspect-auto relative min-h-[50vh]">
            <img 
              src="https://images.unsplash.com/photo-1550614000-4b95d4ed7ed6?q=80&w=2000&auto=format&fit=crop" 
              alt="Editorial Fashion" 
              className="absolute inset-0 w-full h-full object-cover grayscale-[30%]"
            />
          </div>
          <div className="p-12 md:p-24 lg:p-32 flex flex-col justify-center">
            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-8">Quiet Luxury.<br/>Loud Impact.</h2>
            <p className="text-lg text-primary-foreground/70 mb-12 max-w-md leading-relaxed font-light">
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
            <Link key={vendor.id} href={`/vendor/${vendor.id}`} className="group block text-center">
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
