import { useRef } from "react";
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
  stock?: number;
  wardrobeCount?: number;
  vendor?: {
    id: number;
    brandName: string;
  };
}

interface ProductCardProps {
  product: Product;
  dataTestId?: string;
  showWardrobe?: boolean;
}

export function ProductCard({ product, dataTestId, showWardrobe = true }: ProductCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const frameRef = useRef<number>(0);
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

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const card = cardRef.current;
    if (!card) return;
    const bounds = card.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    const rotateX = (0.5 - y) * 5;
    const rotateY = (x - 0.5) * 5;
    if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = window.requestAnimationFrame(() => {
      card.style.setProperty("--tilt-x", `${rotateX}deg`);
      card.style.setProperty("--tilt-y", `${rotateY}deg`);
      card.style.setProperty("--glow-x", `${x * 100}%`);
      card.style.setProperty("--glow-y", `${y * 100}%`);
    });
  };

  const resetTilt = () => {
    const card = cardRef.current;
    if (!card) return;
    if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    card.style.setProperty("--tilt-x", "0deg");
    card.style.setProperty("--tilt-y", "0deg");
    card.style.setProperty("--glow-x", "50%");
    card.style.setProperty("--glow-y", "50%");
  };

  const imageUrl = product.images && product.images.length > 0
    ? product.images[0].startsWith("http") || product.images[0].startsWith("/")
      ? product.images[0]
      : `/api/storage/objects/${product.images[0]}`
    : undefined;

  return (
    <article
      ref={cardRef}
      className="group block cursor-pointer product-card-tilt"
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTilt}
      data-testid={dataTestId || `product-card-${product.id}`}
    >
      <div className="relative">
        <Link href={`/product/${product.id}`} className="block" data-testid={`link-product-${product.id}`}>
        {/* Image */}
        <div className="relative overflow-hidden bg-secondary aspect-[3/4] luxury-image product-card-media">
          {imageUrl ? <img
            src={imageUrl}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
            loading="lazy"
          /> : <div className="absolute inset-0 starfield flex items-center justify-center"><span className="font-serif text-3xl text-primary/60">RD</span></div>}
          {product.stock === 0 && (
            <span className="absolute top-3 left-3 bg-background/85 border border-primary/45 px-3 py-1 text-[10px] font-bold tracking-widest uppercase backdrop-blur-md">
              Sold Out
            </span>
          )}
        </div>
        </Link>
        {/* Add to Wardrobe overlay stays outside the product link for valid interactive semantics. */}
        {showWardrobe && (
          <button
            onClick={handleAdd}
            disabled={addToWardrobe.isPending}
            className="absolute bottom-3 left-3 right-3 glass-action text-foreground text-xs font-bold tracking-widest uppercase py-3 translate-y-[calc(100%+1rem)] group-hover:translate-y-0 transition-transform duration-500 flex items-center justify-center gap-2"
            data-testid={`add-to-wardrobe-${product.id}`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            {addToWardrobe.isPending ? "Adding..." : "Add to Wardrobe"}
          </button>
        )}
      </div>

      {/* Info */}
      <Link href={`/product/${product.id}`} className="block space-y-1 mt-4" data-testid={`link-product-info-${product.id}`}>
        {product.vendor && (
          <p className="text-xs font-bold tracking-widest uppercase text-muted-foreground">{product.vendor.brandName}</p>
        )}
        <p className="text-sm font-medium leading-snug line-clamp-2">{product.name}</p>
        <p className="font-serif text-base font-medium text-primary">{product.currency || "₦"} {product.price.toLocaleString()}</p>
        {product.sizes && product.sizes.length > 0 && (
          <p className="text-xs text-muted-foreground">{product.sizes.slice(0, 4).join(" · ")}{product.sizes.length > 4 ? " ···" : ""}</p>
        )}
      </Link>
    </article>
  );
}
