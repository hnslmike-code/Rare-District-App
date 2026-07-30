import { useState, useRef } from "react";
import { Link, useRoute } from "wouter";
import { useGetProduct, useGetProductReviews, useAddToWardrobe, getGetWardrobeQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Star, Heart, Share2, Info, ChevronRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function ProductDetail() {
  const [, params] = useRoute("/product/:id");
  const id = Number(params?.id);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedSize, setSelectedSize] = useState<string>("");
  const [activeImage, setActiveImage] = useState<number>(0);

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
    
    if (product.sizes && product.sizes.length > 0 && !selectedSize) {
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

  return (
    <div className="bg-background pt-8 pb-32">
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
          <div className="lg:col-span-7 flex flex-col-reverse md:flex-row gap-4 h-fit sticky top-28">
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
            <div className="flex-1 aspect-[3/4] bg-secondary relative overflow-hidden group">
              {product.images?.[activeImage] ? (
                <img 
                  src={product.images[activeImage]} 
                  alt={product.name} 
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-1000 ease-out" 
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-serif text-xl text-muted-foreground">No Image Available</div>
              )}
            </div>
          </div>

          {/* Product Info */}
          <div className="lg:col-span-5 flex flex-col mt-4 lg:mt-12">
            <Link href={`/vendor/${product.vendorId}`} className="text-xs font-bold tracking-widest uppercase text-muted-foreground hover:text-primary transition-colors mb-4 block">
              {product.vendor?.brandName || "Rare District"}
            </Link>
            
            <h1 className="font-serif text-4xl lg:text-5xl font-bold tracking-tight mb-4 leading-tight">{product.name}</h1>
            
            <p className="text-2xl font-light mb-8">{product.currency} {product.price.toLocaleString()}</p>
            
            {/* Sizes */}
            {hasSizes && (
              <div className="mb-10">
                <div className="flex justify-between items-end mb-4">
                  <span className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Select Size</span>
                  <button className="text-xs underline text-muted-foreground hover:text-foreground transition-colors">Size Guide</button>
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

            {/* Actions */}
            <div className="space-y-4 mb-12">
              <Button 
                onClick={handleAddToCart}
                disabled={product.stock === 0 || addToWardrobe.isPending}
                className="w-full h-14 rounded-none font-bold tracking-widest uppercase text-sm"
              >
                {addToWardrobe.isPending ? "Adding..." : product.stock === 0 ? "Sold Out" : "Add to Wardrobe"}
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
