import { Link, useLocation } from "wouter";
import { useGetWardrobe, useRemoveWardrobeItem, getGetWardrobeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Wardrobe() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: wardrobeItems, isLoading } = useGetWardrobe({
    query: {
      queryKey: getGetWardrobeQueryKey(),
      retry: false
    }
  });

  const removeMutation = useRemoveWardrobeItem();

  const handleRemove = (itemId: number) => {
    removeMutation.mutate({ id: itemId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetWardrobeQueryKey() });
        toast({ title: "Removed from wardrobe" });
      },
      onError: () => {
        toast({ title: "Failed to remove item", variant: "destructive" });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 md:py-24 max-w-5xl">
        <h1 className="font-serif text-4xl font-bold tracking-tight mb-12">Private Wardrobe</h1>
        <div className="space-y-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-6 border-b border-border pb-8">
              <Skeleton className="w-24 h-32 md:w-32 md:h-40 rounded-none bg-secondary/50" />
              <div className="flex-1 space-y-4">
                <Skeleton className="w-1/3 h-6 rounded-none bg-secondary/50" />
                <Skeleton className="w-1/4 h-4 rounded-none bg-secondary/50" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const items = wardrobeItems || [];
  const linePrice = (item: typeof items[number]) => (item.product?.price || 0) + (item.variant?.priceAdjustment || 0);
  const subtotal = items.reduce((acc, item) => acc + (linePrice(item) * (item.quantity || 1)), 0);

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-24 md:py-32 flex flex-col items-center justify-center text-center">
        <h1 className="font-serif text-4xl font-bold tracking-tight mb-6">Your Wardrobe is Empty</h1>
        <p className="text-muted-foreground text-lg mb-10 max-w-md">
          Discover the latest pieces from our curated collection to start building your wardrobe.
        </p>
        <Link href="/shop" className="inline-flex items-center justify-center bg-foreground text-background px-8 py-4 text-sm font-bold tracking-widest uppercase hover:bg-primary hover:text-primary-foreground transition-all duration-300">
          Explore Collection
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 md:py-20 max-w-6xl">
      <h1 className="font-serif text-4xl font-bold tracking-tight mb-12">Private Wardrobe</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
        
        {/* Items List */}
        <div className="lg:col-span-8">
          <div className="border-t border-border">
            {items.map((item) => (
              <div key={item.id} className="flex flex-col sm:flex-row gap-6 py-8 border-b border-border">
                {/* Image */}
                <Link href={`/product/${item.productId}`} className="w-full sm:w-32 aspect-[3/4] bg-secondary block shrink-0 relative group">
                  {item.product?.images?.[0] ? (
                    <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-serif text-muted-foreground">No Image</div>
                  )}
                </Link>
                
                {/* Details */}
                <div className="flex-1 flex flex-col">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <Link href={`/product/${item.productId}`} className="font-serif text-xl font-medium hover:text-primary transition-colors block mb-1">
                        {item.product?.name}
                      </Link>
                      <p className="text-xs font-bold tracking-widest uppercase text-muted-foreground mb-4">
                        {item.product?.vendor?.brandName || "Rare District"}
                      </p>
                      {item.selectedSize && (
                        <p className="text-sm text-muted-foreground mb-2"><span className="font-medium text-foreground">Size:</span> {item.selectedSize}</p>
                      )}
                      {item.variant && (
                        <p className="text-sm text-muted-foreground mb-2">{Object.entries(item.variant.attributes).map(([key, value]) => <span key={key} className="mr-2"><span className="font-medium text-foreground">{key}:</span> {value}</span>)}</p>
                      )}
                      <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">Qty:</span> {item.quantity}</p>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-lg font-light mb-4">{item.product?.currency} {(linePrice(item) * (item.quantity || 1)).toLocaleString()}</p>
                      <button 
                        onClick={() => handleRemove(item.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-2 -mr-2"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary sidebar */}
        <div className="lg:col-span-4">
          <div className="bg-secondary/30 p-8 border border-border sticky top-32">
            <h2 className="font-serif text-2xl font-bold tracking-tight mb-6 border-b border-border pb-4">Summary</h2>
            
            <div className="space-y-4 mb-8">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>₦ {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Shipping</span>
                <span>Calculated at checkout</span>
              </div>
            </div>
            
            <div className="border-t border-border pt-6 mb-8">
              <div className="flex justify-between items-center text-lg font-medium">
                <span>Estimated Total</span>
                <span>₦ {subtotal.toLocaleString()}</span>
              </div>
            </div>

            <Button 
              onClick={() => setLocation("/checkout")}
              className="w-full h-14 rounded-none font-bold tracking-widest uppercase flex items-center justify-center gap-2 group"
            >
              Proceed to Checkout
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
            
            <p className="text-xs text-muted-foreground text-center mt-6">
              Taxes and shipping calculated at checkout.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
