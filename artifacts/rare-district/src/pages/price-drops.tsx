import { Link } from "wouter";
import { ArrowRight, Tag } from "lucide-react";

export default function PriceDrops() {
  return (
    <section className="min-h-[60vh] bg-background px-4 py-16 md:px-6 md:py-24 nebula-surface">
      <div className="container mx-auto max-w-3xl">
        <p className="mb-4 text-xs uppercase tracking-[0.3em] text-primary">Rare District / Price Drops</p>
        <div className="glass-panel p-7 md:p-10" data-testid="empty-price-drops">
          <Tag className="mb-7 h-7 w-7 text-primary" aria-hidden="true" />
          <h1 className="mb-4 font-serif text-4xl font-medium tracking-tight">Nothing marked down.</h1>
          <p className="max-w-xl leading-relaxed text-muted-foreground">There are no active price drops currently listed in the district. We will show them here when verified reductions become available.</p>
          <Link href="/shop" className="mt-8 inline-flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-primary transition-colors hover:text-foreground" data-testid="link-price-drops-shop">
            Return to the showroom <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}