import { useState } from "react";
import { Link, useRoute } from "wouter";
import { useGetProduct, useGetProductReviews, useAddToWardrobe, getGetWardrobeQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Heart, Share2, ChevronRight, Ruler } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ProductDetail() {
  const [, params] = useRoute("/product/:id");
  const id = Number(params?.id);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [activeImage, setActiveImage] = useState<number>(0);
  const [height, setHeight] = useState("");
  const [usualSize, setUsualSize] = useState("");
  const [fitPreference, setFitPreference] = useState("regular");

  const { data: product, isLoading } = useGetProduct(id, {
    query: {
      enabled: !!id,
      queryKey: ["product", id]
    }
  });

  const { data: reviews } = useGetProductReviews(id, {
    query: {
      enabled: !!id,
      queryKey: ["product-reviews", id]
    }
  });

  const addToWardrobe = useAddToWardrobe();

  const handleAddToCart = () => {
    if (!product) return;
    const token = localStorage.getItem("token");
    if (!token) {
      toast({
        title: "Please Sign In",
        description: "You must be signed in to add items to your wardrobe.",
        variant: "destructive"
      });
      return;
    }
    
    const variants = product.variants ?? [];
    if (variants.length > 0 && !selectedVariant) {
      toast({
        title: "Select a Variation",
        description: "Choose every available option before adding this piece to your wardrobe.",
        variant: "destructive"
      });
      return;
    }

    if (variants.length === 0 && product.sizes && product.sizes.length > 0 && !selectedSize) {
      toast({
        title: "Select a Size",
        description: "Please select a size before adding to your wardrobe.",
        variant: "destructive"
      });
      return;
    }

    addToWardrobe.mutate({
      data: {
        productId: product.id,
          variantId: selectedVariant?.id,
        selectedSize: selectedSize || undefined,
        quantity: 1
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetWardrobeQueryKey() });
        toast({
          title: "Added to Wardrobe",
          description: "The piece has been reserved in your wardrobe.",
        });
      },
      onError: (err: any) => {
        toast({
          title: "Error",
          description: err?.message || "Could not add item to wardrobe.",
          variant: "destructive"
        });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 md:py-20 grid grid-cols-1 md:grid-cols-2 gap-12">
        <Skeleton className="aspect-[3/4] w-full rounded-none" />
        <div className="space-y-8 mt-12">
          <Skeleton className="h-8 w-1/4 rounded-none" />
          <Skeleton className="h-12 w-3/4 rounded-none" />
          <Skeleton className="h-6 w-1/4 rounded-none" />
          <div className="space-y-4 pt-8 border-t border-border">
            <Skeleton className="h-12 w-full rounded-none" />
            <Skeleton className="h-12 w-full rounded-none" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
        <h2 className="font-serif text-3xl mb-4">Piece Not Found</h2>
        <p className="text-muted-foreground mb-8">This item may have been removed from the district.</p>
        <Link href="/shop" className="text-sm font-bold tracking-widest uppercase border-b border-primary hover:text-primary transition-colors pb-1">Return to Collection</Link>
      </div>
    );
  }

  const hasSizes = product.sizes && product.sizes.length > 0;
  const variants = product.variants ?? [];
  const hasVariantInventory = variants.length > 0;
  const attributeNames = [...new Set(variants.flatMap((variant) => Object.keys(variant.attributes)))];
  const matchingVariants = variants.filter((variant) =>
    Object.entries(selectedAttributes).every(([key, value]) => variant.attributes[key] === value),
  );
  const selectedVariant = attributeNames.length > 0 && attributeNames.every((key) => selectedAttributes[key])
    ? matchingVariants.find((variant) => variant.availableStock > 0)
    : undefined;
  const displayPrice = product.price + (selectedVariant?.priceAdjustment ?? 0);
  const optionIsAvailable = (attribute: string, value: string) => variants.some((variant) =>
    variant.availableStock > 0 &&
    variant.attributes[attribute] === value &&
    Object.entries(selectedAttributes).every(([selectedAttribute, selectedValue]) =>
      selectedAttribute === attribute || variant.attributes[selectedAttribute] === selectedValue,
    ),
  );
  const chooseAttribute = (attribute: string, value: string) => {
    setSelectedAttributes((previous) => ({ ...previous, [attribute]: value }));
  };
  const fitRecommendation = (() => {
    if (!product.sizes?.length || !usualSize) return "";
    const sizes = product.sizes;
    const index = Math.max(0, sizes.findIndex((size) => size.toUpperCase() === usualSize.toUpperCase()));
    const adjusted = fitPreference === "relaxed" ? index + 1 : fitPreference === "close" ? index - 1 : index;
    return sizes[Math.min(Math.max(adjusted, 0), sizes.length - 1)];
  })();

  return (
    <div className="product-page bg-background pt-8 pb-32">
      <div className="container mx-auto px-4 md:px-6">
        
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-muted-foreground mb-8 md:mb-12">
          <Link href="/shop" className="hover:text-primary transition-colors">Shop</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href={`/vendor/${product.vendorId}`} className="hover:text-primary transition-colors">{product.vendor?.brandName || 'Vendor'}</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground line-clamp-1">{product.name}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
          
          {/* Image Gallery */}
          <div className="lg:col-span-7 flex flex-col-reverse md:flex-row gap-4 h-fit lg:sticky lg:top-28">
            {/* Thumbnails */}
            {product.images && product.images.length > 1 && (
              <div className="flex md:flex-col gap-4 overflow-x-auto md:w-24 shrink-0 no-scrollbar">
                {product.images.map((img, i) => (
                  <button 
                    key={i} 
                    onClick={() => setActiveImage(i)}
                    className={`shrink-0 w-20 md:w-full aspect-[3/4] overflow-hidden bg-secondary border-2 transition-all ${activeImage === i ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  >
                    <img src={img} alt={`${product.name} - view ${i+1}`} className="w-full h-full object-cover object-center" />
                  </button>
                ))}
              </div>
            )}
            
            {/* Main Image */}
             <div className="detail-image flex-1 aspect-[3/4] bg-secondary relative overflow-hidden group luxury-image">
              {product.images?.[activeImage] ? (
                <img 
                  src={product.images[activeImage]} 
                  alt={product.name} 
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-1000 ease-out" 
                />
              ) : (
                <div className="product-placeholder h-full w-full"><span className="product-placeholder-index">RD / {String(product.id).padStart(2, "0")}</span><strong>{product.name}</strong><span>{product.vendor?.brandName || "Rare District"}</span></div>
              )}
            </div>
          </div>

          {/* Product Info */}
          <div className="lg:col-span-5 flex flex-col mt-4 lg:mt-12">
            <Link href={`/vendor/${product.vendorId}`} className="text-xs font-bold tracking-widest uppercase text-muted-foreground hover:text-primary transition-colors mb-4 block">
              {product.vendor?.brandName || "Rare District"}
            </Link>
            
            <h1 className="font-serif text-4xl lg:text-5xl font-bold tracking-tight mb-4 leading-tight">{product.name}</h1>
            
            <p className="text-2xl font-light mb-8">{product.currency} {displayPrice.toLocaleString()}</p>
            
            {/* Variant combinations */}
            {hasVariantInventory && (
              <div className="mb-10 space-y-7" data-testid="product-variant-selector">
                {attributeNames.map((attribute) => {
                  const values = [...new Set(variants.map((variant) => variant.attributes[attribute]).filter(Boolean))];
                  return (
                    <div key={attribute}>
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Select {attribute}</span>
                        {selectedAttributes[attribute] && <span className="text-xs text-muted-foreground">{selectedAttributes[attribute]}</span>}
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {values.map((value) => {
                          const available = optionIsAvailable(attribute, value);
                          const selected = selectedAttributes[attribute] === value;
                          return <button
                            key={value}
                            type="button"
                            onClick={() => chooseAttribute(attribute, value)}
                            disabled={!available}
                            className={`min-w-14 border px-4 py-3 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-35 ${
                              selected
                                ? "border-foreground bg-foreground text-background"
                                : "border-border bg-background text-foreground hover:border-foreground"
                            }`}
                          >
                            {value}
                          </button>;
                        })}
                      </div>
                    </div>
                  );
                })}
                <p className={`text-xs ${selectedVariant ? "text-muted-foreground" : "text-primary"}`}>
                  {selectedVariant
                    ? `${selectedVariant.availableStock} available · ${selectedVariant.sku}`
                    : `Choose ${attributeNames.filter((attribute) => !selectedAttributes[attribute]).join(", ")} to see availability.`}
                </p>
              </div>
            )}

            {/* Legacy sizes */}
            {!hasVariantInventory && hasSizes && (
              <div className="mb-10">
                <div className="flex justify-between items-end mb-4">
                  <span className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Select Size</span>
                   <Dialog>
                     <DialogTrigger asChild>
                       <button className="inline-flex items-center gap-1.5 text-xs underline text-muted-foreground hover:text-foreground transition-colors" data-testid="button-size-guide">
                         <Ruler className="w-3.5 h-3.5" /> Size Guide
                       </button>
                     </DialogTrigger>
                     <DialogContent className="rounded-none border-primary/30">
                       <DialogHeader>
                         <DialogTitle className="font-serif text-3xl">Size guide</DialogTitle>
                         <DialogDescription>Standard body measurements. When between sizes, consider your preferred fit.</DialogDescription>
                       </DialogHeader>
                       <div className="border-y border-border mt-4" data-testid="size-guide-table">
                         {[
                           ["XS", "84–88 cm", "66–70 cm", "88–92 cm"],
                           ["S", "88–92 cm", "70–74 cm", "92–96 cm"],
                           ["M", "92–96 cm", "74–78 cm", "96–100 cm"],
                           ["L", "96–102 cm", "78–84 cm", "100–106 cm"],
                           ["XL", "102–108 cm", "84–90 cm", "106–112 cm"],
                           ["2XL", "108–114 cm", "90–96 cm", "112–118 cm"],
                         ].map(([size, bust, waist, hip]) => <div key={size} className="grid grid-cols-4 py-3 text-sm border-b border-border last:border-0"><span className="font-bold">{size}</span><span>{bust}</span><span>{waist}</span><span>{hip}</span></div>)}
                         <div className="grid grid-cols-4 pb-2 text-[10px] tracking-widest uppercase text-muted-foreground"><span>Size</span><span>Bust / chest</span><span>Waist</span><span>Hip</span></div>
                       </div>
                       <p className="text-xs text-muted-foreground leading-relaxed">Measurements are a general guide and may vary by designer, fabric, and cut. Please contact the atelier for piece-specific advice.</p>
                     </DialogContent>
                   </Dialog>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {product.sizes?.map(size => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`py-3 text-sm font-medium transition-all border ${
                        selectedSize === size 
                          ? "bg-foreground text-background border-foreground" 
                          : "bg-background text-foreground border-border hover:border-foreground"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!hasVariantInventory && hasSizes && (
              <section className="mb-10 border border-border p-5" aria-labelledby="fit-predictor-title" data-testid="fit-predictor">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div>
                    <p id="fit-predictor-title" className="text-xs font-bold tracking-widest uppercase mb-1">Lightweight fit predictor</p>
                    <p className="text-xs text-muted-foreground">A local guide based on your usual size and preference.</p>
                  </div>
                  {fitRecommendation && <span className="text-primary text-sm font-bold" data-testid="fit-recommendation">Recommended: {fitRecommendation}</span>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div><Label htmlFor="fit-height" className="text-xs text-muted-foreground">Height (cm)</Label><Input id="fit-height" data-testid="input-fit-height" value={height} onChange={(e) => setHeight(e.target.value)} inputMode="numeric" placeholder="170" className="rounded-none mt-2" /></div>
                  <div><Label htmlFor="fit-size" className="text-xs text-muted-foreground">Usual size</Label><select id="fit-size" data-testid="select-fit-size" value={usualSize} onChange={(e) => setUsualSize(e.target.value)} className="w-full h-10 mt-2 border border-input px-3 text-sm bg-background"><option value="">Select</option>{product.sizes?.map((size) => <option key={size} value={size}>{size}</option>)}</select></div>
                  <div><Label htmlFor="fit-preference" className="text-xs text-muted-foreground">Preferred fit</Label><select id="fit-preference" data-testid="select-fit-preference" value={fitPreference} onChange={(e) => setFitPreference(e.target.value)} className="w-full h-10 mt-2 border border-input px-3 text-sm bg-background"><option value="close">Close</option><option value="regular">Regular</option><option value="relaxed">Relaxed</option></select></div>
                </div>
                {/* Future enhancement: AI style-matching could account for garment-specific proportions. */}
              </section>
            )}

            {/* Actions */}
            <div className="space-y-4 mb-12">
              <Button 
                onClick={handleAddToCart}
                disabled={(hasVariantInventory ? !selectedVariant : product.stock === 0) || addToWardrobe.isPending}
                className="w-full h-14 rounded-none font-bold tracking-widest uppercase text-sm"
              >
                {addToWardrobe.isPending
                  ? "Adding..."
                  : hasVariantInventory
                    ? !selectedVariant
                      ? "Select Variation"
                      : "Add to Wardrobe"
                    : product.stock === 0
                      ? "Sold Out"
                      : "Add to Wardrobe"}
              </Button>
              <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" className="h-12 rounded-none border-border font-medium tracking-widest uppercase text-xs hover:bg-secondary">
                  <Heart className="w-4 h-4 mr-2" /> Wishlist
                </Button>
                <Button variant="outline" className="h-12 rounded-none border-border font-medium tracking-widest uppercase text-xs hover:bg-secondary">
                  <Share2 className="w-4 h-4 mr-2" /> Share
                </Button>
              </div>
            </div>

            {/* Details Tabs */}
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent p-0 h-auto gap-8">
                <TabsTrigger value="details" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-3 text-xs font-bold tracking-widest uppercase">
                  The Details
                </TabsTrigger>
                <TabsTrigger value="delivery" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-3 text-xs font-bold tracking-widest uppercase">
                  Delivery & Returns
                </TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="pt-6">
                <div className="prose prose-sm max-w-none text-muted-foreground font-light leading-relaxed">
                  <p>{product.description || "An exceptional piece from the collection."}</p>
                  {product.category && (
                    <p className="mt-4 text-xs font-bold tracking-widest uppercase">Category: {product.category}</p>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="delivery" className="pt-6 text-sm text-muted-foreground font-light leading-relaxed space-y-4">
                <p><strong>Standard Delivery:</strong> 3-5 working days via premium courier. Signature required.</p>
                <p><strong>Returns:</strong> Complimentary returns within 14 days of receipt. Items must be in original condition with all Rare District tags attached.</p>
              </TabsContent>
            </Tabs>
            
          </div>
        </div>

      </div>
    </div>
  );
}
