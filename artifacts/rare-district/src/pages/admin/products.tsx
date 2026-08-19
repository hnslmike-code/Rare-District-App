import { useState } from "react";
import { useListAdminProducts, useDeleteProduct, useUpdateProduct, getListAdminProductsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Edit3, Eye, EyeOff, Package, Save, Sparkles, Trash2, X } from "lucide-react";

type AdminProduct = {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  category?: string | null;
  sizes?: string[];
  images?: string[];
  stock: number;
  isActive?: boolean;
  isFeatured?: boolean;
};

export default function AdminProducts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<AdminProduct | null>(null);

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
  const updateProduct = useUpdateProduct({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey() });
        toast({ title: "Product updated." });
        setEditing(null);
      },
      onError: () => toast({ title: "Product not updated.", description: "Review the details and try again.", variant: "destructive" }),
    },
  });

  const handleDelete = (id: number) => {
    if (window.confirm("Delete this product permanently?")) {
      deleteProduct.mutate({ id });
    }
  };

  return (
    <div className="space-y-8" data-testid="admin-products">
      <div className="flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
        <h1 className="font-serif text-4xl font-bold tracking-tight mb-2">Products</h1>
        <p className="text-muted-foreground">Manage listing details, stock, visibility, and homepage-ready featured status.</p>
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Use Merchandising to pin hero and carousel products</p>
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
                <th className="text-left py-3 px-4 font-bold tracking-widest uppercase text-xs text-muted-foreground">Merchandising</th>
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
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateProduct.mutate({ id: product.id, data: { isActive: !product.isActive } })} title={product.isActive ? "Hide product" : "Make product live"} className="text-muted-foreground hover:text-foreground">
                        {product.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                      <button onClick={() => updateProduct.mutate({ id: product.id, data: { isFeatured: !product.isFeatured } })} title={product.isFeatured ? "Remove featured status" : "Mark as featured"} className={product.isFeatured ? "text-primary" : "text-muted-foreground hover:text-foreground"}>
                        <Sparkles className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={() => setEditing(product)} title="Edit product"><Edit3 className="w-4 h-4" /></Button>
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
      {editing ? <ProductEditor product={editing} onClose={() => setEditing(null)} onSave={(data) => updateProduct.mutate({ id: editing.id, data })} saving={updateProduct.isPending} /> : null}
    </div>
  );
}

function ProductEditor({ product, onClose, onSave, saving }: { product: { id: number; name: string; description?: string | null; price: number; category?: string | null; sizes?: string[]; images?: string[]; stock: number; isActive?: boolean; isFeatured?: boolean }; onClose: () => void; onSave: (data: { name: string; description?: string; price: number; category?: string; sizes: string[]; images: string[]; stock: number; isActive: boolean; isFeatured: boolean }) => void; saving: boolean }) {
  const [form, setForm] = useState({
    name: product.name,
    description: product.description ?? "",
    price: String(product.price),
    category: product.category ?? "",
    sizes: (product.sizes ?? []).join(", "),
    images: (product.images ?? []).join("\n"),
    stock: String(product.stock),
    isActive: product.isActive ?? true,
    isFeatured: product.isFeatured ?? false,
  });
  const input = "mt-1 w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground";
  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-black/30 p-0 backdrop-blur-sm md:items-center md:justify-center md:p-6" role="dialog" aria-modal="true" aria-label={`Edit ${product.name}`}>
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto bg-background p-5 shadow-2xl md:p-7">
        <div className="flex items-start justify-between border-b border-border pb-5"><div><p className="eyebrow">Catalog editor</p><h2 className="mt-2 font-serif text-3xl">Edit product</h2></div><button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground" aria-label="Close editor"><X className="h-5 w-5" /></button></div>
        <form onSubmit={(event) => { event.preventDefault(); onSave({ name: form.name, description: form.description || undefined, price: Number(form.price), category: form.category || undefined, sizes: form.sizes.split(",").map(value => value.trim()).filter(Boolean), images: form.images.split("\n").map(value => value.trim()).filter(Boolean), stock: Number(form.stock), isActive: form.isActive, isFeatured: form.isFeatured }); }} className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Name<input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className={input} /></label>
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Price (₦)<input required min="0" type="number" value={form.price} onChange={event => setForm({ ...form, price: event.target.value })} className={input} /></label>
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Category<input value={form.category} onChange={event => setForm({ ...form, category: event.target.value })} className={input} /></label>
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Stock<input required min="0" type="number" value={form.stock} onChange={event => setForm({ ...form, stock: event.target.value })} className={input} /></label>
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground md:col-span-2">Description<textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} className={`${input} min-h-24 resize-y`} /></label>
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Sizes <span className="normal-case tracking-normal">(comma separated)</span><input value={form.sizes} onChange={event => setForm({ ...form, sizes: event.target.value })} className={input} /></label>
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Images <span className="normal-case tracking-normal">(one URL/path per line)</span><textarea value={form.images} onChange={event => setForm({ ...form, images: event.target.value })} className={`${input} min-h-20 resize-y`} /></label>
          <label className="flex items-center justify-between border border-border p-3 text-sm">Live on storefront<input type="checkbox" checked={form.isActive} onChange={event => setForm({ ...form, isActive: event.target.checked })} /></label>
          <label className="flex items-center justify-between border border-border p-3 text-sm">Featured product<input type="checkbox" checked={form.isFeatured} onChange={event => setForm({ ...form, isFeatured: event.target.checked })} /></label>
          <div className="flex gap-3 border-t border-border pt-5 md:col-span-2"><Button type="button" variant="outline" className="rounded-none" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving} className="rounded-none bg-foreground text-background hover:bg-foreground/90"><Save className="mr-2 h-4 w-4" /> {saving ? "Saving…" : "Save product"}</Button></div>
        </form>
      </div>
    </div>
  );
}
