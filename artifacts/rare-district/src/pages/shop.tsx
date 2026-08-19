import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useListProducts, ListProductsSortBy } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export default function Shop() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialCategory = searchParams.get("category") || "";

  const [category, setCategory] = useState(initialCategory);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<ListProductsSortBy>("newest");
  const [page, setPage] = useState(1);

  // Simple debounce for search
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(handler);
  }, [search]);

  const { data: productsData, isLoading } = useListProducts({
    category: category || undefined,
    search: debouncedSearch || undefined,
    sortBy,
    page,
    limit: 12
  }, {
    query: {
      queryKey: ["products", category, debouncedSearch, sortBy, page]
    }
  });

  const categories = ["All", "streetwear", "new", "designers", "editorial", "tops", "bottoms", "dresses", "outerwear", "accessories"];

  return (
    <div className="showroom-page min-h-screen bg-background pb-24">
      <div className="container mx-auto px-4 md:px-6">
        
        {/* Header */}
         <div className="showroom-heading mb-12 border-b border-border/70 pb-12">
           <p className="eyebrow">Rare District / Showroom</p>
           <h1>The Collection</h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            {category ? `Exploring ${category} pieces from our curated selection.` : "Explore our curated selection of vanguard pieces."}
          </p>
        </div>

        {/* Filters Toolbar */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-12 pb-6 border-b border-border">
          
          <div className="hidden md:flex flex-wrap gap-7 items-center text-xs font-bold tracking-[0.18em] uppercase">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => { setCategory(c === "All" ? "" : c); setPage(1); }}
                  className={`category-tab transition-colors ${
                   (c === "All" && !category) || category === c ? "is-active" : ""
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            {/* Mobile Filters */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="md:hidden rounded-none border-border font-bold uppercase tracking-widest text-xs">
                  <SlidersHorizontal className="w-4 h-4 mr-2" /> Filters
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] sm:w-[400px] rounded-none border-border">
                <SheetHeader>
                  <SheetTitle className="font-serif text-2xl tracking-tight">Categories</SheetTitle>
                  <SheetDescription className="sr-only">Filter products by category</SheetDescription>
                </SheetHeader>
                <div className="mt-8 flex flex-col gap-4 text-sm font-medium tracking-widest uppercase">
                  {categories.map((c) => (
                    <button
                      key={c}
                      onClick={() => { setCategory(c === "All" ? "" : c); setPage(1); }}
                      className={`text-left transition-colors hover:text-primary py-2 ${
                        (c === "All" && !category) || category === c ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </SheetContent>
            </Sheet>

            {/* Search */}
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
               <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..." 
                 className="pl-9 rounded-none border-border focus-visible:ring-primary focus-visible:border-primary bg-transparent"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>

            {/* Sort */}
            <Select value={sortBy} onValueChange={(val) => { setSortBy(val as ListProductsSortBy); setPage(1); }}>
              <SelectTrigger className="w-[180px] rounded-none border-border bg-transparent focus:ring-primary">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="rounded-none border-border">
                <SelectItem value="newest" className="rounded-none">Newest Arrivals</SelectItem>
                <SelectItem value="price_asc" className="rounded-none">Price: Low to High</SelectItem>
                <SelectItem value="price_desc" className="rounded-none">Price: High to Low</SelectItem>
                <SelectItem value="popular" className="rounded-none">Most Popular</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Product Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 md:gap-12">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="aspect-[3/4] w-full rounded-2xl bg-secondary/50" />
                <Skeleton className="h-4 w-1/3 bg-secondary/50 rounded-none" />
                <Skeleton className="h-6 w-2/3 bg-secondary/50 rounded-none" />
                <Skeleton className="h-4 w-1/4 bg-secondary/50 rounded-none" />
              </div>
            ))}
          </div>
        ) : productsData?.items && productsData.items.length > 0 ? (
          <>
             <div className="showroom-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 md:gap-x-8 md:gap-y-16">
              {productsData.items.map((product) => (
                 <Link key={product.id} href={`/product/${product.id}`} className="group block showroom-product-card">
                   <div className="showroom-product-image aspect-[3/4] overflow-hidden bg-secondary mb-6 relative luxury-image">
                    {product.images?.[0] ? (
                      <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out" />
                    ) : (
                       <div className="product-placeholder h-full w-full"><span className="product-placeholder-index">RD / {String(product.id).padStart(2, "0")}</span><strong>{product.name}</strong><span>{product.vendor?.brandName || "Rare District"}</span></div>
                    )}
                    {product.stock === 0 && (
                      <div className="absolute top-4 left-4 bg-background px-3 py-1 text-xs font-bold tracking-widest uppercase shadow-sm">Sold Out</div>
                    )}
                    {product.isFeatured && product.stock > 0 && (
                       <div className="absolute top-4 left-4 bg-foreground text-background px-3 py-1 text-xs font-bold tracking-widest uppercase shadow-sm">Featured</div>
                    )}
                  </div>
                  <div className="flex justify-between items-start gap-4">
                    <div>
                       <p className="eyebrow mb-2 line-clamp-1">{product.vendor?.brandName || "Rare District"}</p>
                        <h3 className="showroom-product-title font-medium mb-2 group-hover:underline transition-colors line-clamp-2">{product.name}</h3>
                       <p className="font-serif text-base">{product.currency} {product.price.toLocaleString()}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {productsData.total > productsData.limit && (
              <div className="mt-20 flex justify-center gap-2">
                <Button 
                  variant="outline" 
                  className="rounded-none border-border"
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="flex items-center px-4 text-sm font-medium">
                  Page {page} of {Math.ceil(productsData.total / productsData.limit)}
                </span>
                <Button 
                  variant="outline" 
                  className="rounded-none border-border"
                  disabled={page >= Math.ceil(productsData.total / productsData.limit)}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="py-32 flex flex-col items-center justify-center text-center">
            <h3 className="font-serif text-2xl mb-4">Nothing to display.</h3>
            <p className="text-muted-foreground max-w-md">We couldn't find any pieces matching your current criteria. The district is always evolving—try exploring a different category.</p>
            <Button 
              variant="outline" 
              className="mt-8 rounded-none border-foreground hover:bg-foreground hover:text-background transition-colors"
              onClick={() => { setCategory(""); setSearch(""); }}
            >
              Clear Filters
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}
