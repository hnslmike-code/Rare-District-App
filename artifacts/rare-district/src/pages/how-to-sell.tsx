import { Link } from "wouter";
import { ArrowRight, Tag } from "lucide-react";

export default function HowToSell() {
  return (
    <section className="min-h-[60vh] bg-background px-4 py-16 md:px-6 md:py-24 nebula-surface">
      <div className="container mx-auto max-w-3xl">
        <p className="mb-4 text-xs uppercase tracking-[0.3em] text-primary">Rare District / Selling</p>
        <div className="mb-7 flex h-12 w-12 items-center justify-center border border-primary/40 text-primary">
          <Tag className="h-5 w-5" aria-hidden="true" />
        </div>
        <h1 className="mb-6 font-serif text-4xl font-medium tracking-tight md:text-6xl">Bring your point of view.</h1>
        <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">Rare District is a home for considered Nigerian fashion and the people shaping its next chapter. Apply to introduce your label to the district.</p>
        <Link href="/vendor-dashboard/apply" className="chrome-button mt-9 inline-flex items-center gap-3 px-5 py-3 text-xs font-bold uppercase tracking-widest" data-testid="link-how-to-sell-apply">
          Sell With Us <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <p className="mt-12 border-t border-border/60 pt-5 text-sm text-muted-foreground">The full vendor guide is coming later. For now, our application is the best place to begin.</p>
      </div>
    </section>
  );
}