import { useRoute, Link } from "wouter";
import { useGetVendor, useListProducts } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/ProductCard";
import { ArrowLeft, Globe } from "lucide-react";

export default function VendorPage() {
  const [, params] = useRoute("/vendor/:id");
  const vendorId = Number(params?.id);

  const { data: vendor, isLoading: vendorLoading } = useGetVendor(vendorId, {
    query: { enabled: !!vendorId, queryKey: ["vendor", vendorId] }
  });

  const { data: productsData, isLoading: productsLoading } = useListProducts(
    { vendorId },
    { query: { enabled: !!vendorId, queryKey: ["products", "vendor", vendorId] } }
  );

  const products = productsData?.items ?? [];

  if (vendorLoading) {
    return (
      <div className="container mx-auto px-4 py-24 max-w-7xl">
        <Skeleton className="h-10 w-32 mb-16" />
        <div className="flex gap-8 items-center mb-16">
          <Skeleton className="w-32 h-32 rounded-full" />
          <div className="space-y-3 flex-1">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4]" />)}
        </div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="container mx-auto px-4 py-48 text-center">
        <h1 className="font-serif text-4xl font-bold mb-4">Atelier Not Found</h1>
        <p className="text-muted-foreground mb-8">This atelier may have moved or closed its showroom.</p>
        <Link href="/shop"><Button variant="outline" className="rounded-none">Browse the District</Button></Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Vendor Hero */}
      <section className="border-b border-border py-24">
        <div className="container mx-auto px-4 max-w-7xl">
          <Link href="/shop" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-12">
            <ArrowLeft className="w-4 h-4" />
            Back to Shop
          </Link>
          <div className="flex flex-col md:flex-row gap-12 items-start">
            {/* Logo */}
            <div className="w-28 h-28 flex-shrink-0 bg-secondary rounded-full overflow-hidden flex items-center justify-center border border-border">
              {vendor.logoUrl ? (
                <img src={vendor.logoUrl} alt={vendor.brandName} className="w-full h-full object-cover" />
              ) : (
                <span className="font-serif text-4xl font-bold text-muted-foreground">{vendor.brandName.charAt(0)}</span>
              )}
            </div>
            {/* Info */}
            <div className="flex-1">
              <p className="text-xs font-bold tracking-widest uppercase text-muted-foreground mb-3">The Atelier</p>
              <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight mb-4">{vendor.brandName}</h1>
              {vendor.description && (
                <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mb-6">{vendor.description}</p>
              )}
              <div className="flex gap-6 items-center text-sm text-muted-foreground">
                <span className="font-medium">{products.length} pieces</span>
                {vendor.website && (
                  <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
                    <Globe className="w-3.5 h-3.5" />
                    Website
                  </a>
                )}
                {vendor.status === "approved" && (
                  <span className="text-xs font-bold tracking-widest uppercase bg-foreground text-background px-2 py-0.5">Verified</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-7xl">
          <h2 className="font-serif text-2xl font-bold tracking-tight mb-10">The Collection</h2>
          {productsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4]" />)}
            </div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="py-24 text-center border border-border">
              <p className="font-serif text-2xl text-muted-foreground mb-2">The showroom is empty.</p>
              <p className="text-sm text-muted-foreground">New pieces are being prepared.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
