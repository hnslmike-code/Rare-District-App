import { Link } from "wouter";
import { useAddToWardrobe, getGetWardrobeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ShoppingBag } from "lucide-react";

interface Product {
  id: number;
  vendorId: number;
  name: string;
  price: number;
  currency?: string;
  images?: string[];
  sizes?: string[];
  wardrobeCount?: number;
  vendor?: {
    id: number;
    brandName: string;
  };
}

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const addToWardrobe = useAddToWardrobe({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetWardrobeQueryKey() });
        toast({ title: "Added to wardrobe", description: product.name });
      },
      onError: () => {
        toast({ title: "Sign in to save to your wardrobe", variant: "destructive" });
      }
    }
  });

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      toast({ title: "Sign in to save to your wardrobe" });
      return;
    }
    addToWardrobe.mutate({ data: { productId: product.id, quantity: 1 } });
  };

  const imageUrl = product.images && product.images.length > 0
    ? `/api/storage/objects/${product.images[0]}`
    : `https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=533&auto=format&fit=crop&q=80`;

  return (
    <Link href={`/product/${product.id}`} data-testid={`product-card-${product.id}`}>
      <article className="group block cursor-pointer">
        {/* Image */}
        <div className="relative overflow-hidden bg-secondary aspect-[3/4] mb-4">
          <img
            src={imageUrl}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
            loading="lazy"
          />
          {/* Add to Wardrobe overlay */}
          <button
            onClick={handleAdd}
            disabled={addToWardrobe.isPending}
            className="absolute bottom-0 left-0 right-0 bg-foreground text-background text-xs font-bold tracking-widest uppercase py-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300 flex items-center justify-center gap-2"
            data-testid={`add-to-wardrobe-${product.id}`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            {addToWardrobe.isPending ? "Adding..." : "Add to Wardrobe"}
          </button>
        </div>

        {/* Info */}
        <div className="space-y-1">
          {product.vendor && (
            <p className="text-xs font-bold tracking-widest uppercase text-muted-foreground">{product.vendor.brandName}</p>
          )}
          <p className="text-sm font-medium leading-snug line-clamp-2">{product.name}</p>
          <p className="font-serif text-base font-medium">₦{product.price.toLocaleString()}</p>
          {product.sizes && product.sizes.length > 0 && (
            <p className="text-xs text-muted-foreground">{product.sizes.slice(0, 4).join(" · ")}{product.sizes.length > 4 ? " ···" : ""}</p>
          )}
        </div>
      </article>
    </Link>
  );
}
