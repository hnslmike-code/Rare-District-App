import { Link, useRoute } from "wouter";
import { useGetVendor, useListProducts } from "@workspace/api-client-react";
import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { mediaUrl } from "@/lib/media-url";

const imageUrl = (image?: string) => mediaUrl(image);

export default function Lookbook() {
  const [, params] = useRoute("/lookbook/:id");
  const vendorId = Number(params?.id);
  const { data: vendor, isLoading: vendorLoading, isError } = useGetVendor(vendorId, {
    query: { enabled: !!vendorId, queryKey: ["vendor", vendorId] },
  });
  const { data, isLoading: productsLoading } = useListProducts({ vendorId, limit: 12 }, {
    query: { enabled: !!vendorId, queryKey: ["products", "lookbook", vendorId] },
  });
  const products = data?.items ?? [];

  if (vendorLoading || productsLoading) return (
    <div className="container mx-auto max-w-6xl px-4 py-20 space-y-10" data-testid="lookbook-loading">
      <Skeleton className="h-8 w-32" /><Skeleton className="h-[55vh] w-full" /><Skeleton className="h-12 w-2/3" />
    </div>
  );
  if (isError || !vendor) return (
    <div className="min-h-[65vh] flex flex-col items-center justify-center text-center px-6" data-testid="lookbook-error">
      <BookOpen className="w-8 h-8 text-primary mb-5" />
      <h1 className="font-serif text-4xl mb-3">The story is unavailable</h1>
      <p className="text-muted-foreground mb-8">This atelier has not opened its lookbook yet.</p>
      <Link href="/shop" className="border-b border-primary pb-1 text-xs font-bold tracking-widest uppercase" data-testid="link-lookbook-error-shop">Browse the district</Link>
    </div>
  );

  return (
    <main className="nebula-surface pb-28" data-testid={`lookbook-page-${vendorId}`}>
      <div className="container mx-auto max-w-7xl px-4 md:px-8 pt-8">
        <Link href={`/vendor/${vendorId}`} className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-muted-foreground hover:text-primary" data-testid="link-lookbook-back">
          <ArrowLeft className="w-4 h-4" /> Return to atelier
        </Link>
      </div>
      <header className="container mx-auto max-w-5xl px-4 md:px-8 py-24 md:py-36 text-center">
        <p className="text-primary text-xs font-bold tracking-[0.35em] uppercase mb-6">An atelier in motion</p>
        <h1 className="font-serif text-5xl md:text-8xl leading-none mb-8">{vendor.brandName}</h1>
        <p className="max-w-xl mx-auto text-muted-foreground leading-relaxed text-lg">
          A study in silhouette, material, and the Lagos light. This season, {vendor.brandName} makes a case for pieces that stay with you.
        </p>
      </header>
      {products.length === 0 ? (
        <div className="container mx-auto max-w-3xl px-4 py-24 text-center border-y border-border" data-testid="lookbook-empty">
          <p className="font-serif text-3xl mb-3">The first chapter is being written.</p>
          <p className="text-muted-foreground">Return to the atelier to see what is currently available.</p>
        </div>
      ) : (
        <div className="container mx-auto max-w-6xl px-4 md:px-8 space-y-24 md:space-y-40">
          {products.slice(0, 6).map((product, index) => {
            const image = imageUrl(product.images?.[0]);
            const secondary = imageUrl(product.images?.[1] || product.images?.[0]);
            return (
              <article key={product.id} className={`grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-14 items-center ${index % 2 ? "md:[&>*:first-child]:order-2" : ""}`} data-testid={`lookbook-story-${product.id}`}>
                <Link href={`/product/${product.id}`} className="md:col-span-7 block overflow-hidden bg-secondary luxury-image group" data-testid={`link-lookbook-product-${product.id}`}>
                  {image ? <img src={image} alt={product.name} className="w-full aspect-[4/5] object-cover group-hover:scale-[1.03] transition-transform duration-1000" /> : <div className="aspect-[4/5] flex items-center justify-center text-muted-foreground">Image coming soon</div>}
                </Link>
                <div className="md:col-span-5 md:px-4">
                  <p className="text-primary text-xs font-bold tracking-[0.28em] uppercase mb-4">Chapter {String(index + 1).padStart(2, "0")}</p>
                  <h2 className="font-serif text-3xl md:text-5xl mb-5">{product.name}</h2>
                  <p className="text-muted-foreground leading-relaxed mb-7">
                    Cut for presence, finished with restraint. A considered layer from the {vendor.brandName} collection, made to move between the city and the after-hours.
                  </p>
                  <Link href={`/product/${product.id}`} className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase hover:text-primary" data-testid={`link-lookbook-story-${product.id}`}>
                    View the piece <ArrowRight className="w-4 h-4" />
                  </Link>
                  {secondary && index % 2 === 0 && <img src={secondary} alt="" className="mt-10 w-24 h-28 object-cover opacity-70" />}
                </div>
              </article>
            );
          })}
        </div>
      )}
      <div className="text-center mt-28">
        <Link href={`/vendor/${vendorId}`} className="inline-flex items-center gap-3 bg-primary text-primary-foreground px-8 py-4 text-xs font-bold tracking-widest uppercase" data-testid="link-lookbook-collection">
          Enter the collection <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </main>
  );
}