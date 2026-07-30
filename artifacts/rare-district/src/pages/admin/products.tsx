import { useListAdminProducts, useDeleteProduct, getListAdminProductsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Package } from "lucide-react";

export default function AdminProducts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: products, isLoading } = useListAdminProducts({}, {
    query: { queryKey: getListAdminProductsQueryKey() }
  });

  const deleteProduct = useDeleteProduct({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey() });
        toast({ title: "Product deleted." });
      }
    }
  });

  const handleDelete = (id: number) => {
    if (window.confirm("Delete this product permanently?")) {
      deleteProduct.mutate({ id });
    }
  };

  return (
    <div className="space-y-8" data-testid="admin-products">
      <div>
        <h1 className="font-serif text-4xl font-bold tracking-tight mb-2">Products</h1>
        <p className="text-muted-foreground">All products on the platform.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : products && products.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-bold tracking-widest uppercase text-xs text-muted-foreground">Product</th>
                <th className="text-left py-3 px-4 font-bold tracking-widest uppercase text-xs text-muted-foreground">Category</th>
                <th className="text-left py-3 px-4 font-bold tracking-widest uppercase text-xs text-muted-foreground">Price</th>
                <th className="text-left py-3 px-4 font-bold tracking-widest uppercase text-xs text-muted-foreground">Stock</th>
                <th className="text-left py-3 px-4 font-bold tracking-widest uppercase text-xs text-muted-foreground">Status</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => (
                <tr key={product.id} className="border-b border-border hover:bg-secondary/30" data-testid={`admin-product-${product.id}`}>
                  <td className="py-4 px-4 font-medium max-w-xs">
                    <div className="flex items-center gap-3">
                      {product.images && product.images.length > 0 ? (
                        <img src={`/api/storage/objects/${product.images[0]}`} alt={product.name} className="w-10 h-10 object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 bg-secondary flex items-center justify-center flex-shrink-0">
                          <Package className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <span className="truncate">{product.name}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-muted-foreground capitalize">{product.category ?? "—"}</td>
                  <td className="py-4 px-4 font-serif font-medium">₦{product.price.toLocaleString()}</td>
                  <td className="py-4 px-4">{product.stock}</td>
                  <td className="py-4 px-4">
                    <span className={`text-xs font-bold tracking-widest uppercase px-2 py-1 ${product.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {product.isActive ? "Active" : "Hidden"}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                      onClick={() => handleDelete(product.id)}
                      disabled={deleteProduct.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-20 border border-border text-center text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-4" />
          <p className="font-serif text-2xl mb-2">No products yet.</p>
        </div>
      )}
    </div>
  );
}
