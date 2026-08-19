import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useListProducts, useGetMyVendorProfile, useUpdateProduct, useDeleteProduct } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus, MoreHorizontal, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function VendorProducts() {
  const [editing, setEditing] = useState<any>(null);
  const { data: profile } = useGetMyVendorProfile();
  const vendorId = profile?.id;

  const { data: productsData, isLoading } = useListProducts({
    vendorId,
    limit: 50
  }, {
    query: {
      enabled: !!vendorId,
      queryKey: ["vendor-products", vendorId]
    },
  });
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["vendor-products", vendorId] });
  const toggleActive = (product: any) => updateProduct.mutate(
    { id: product.id, data: { isActive: !product.isActive } },
    { onSuccess: refresh },
  );
  const removeProduct = (product: any) => {
    if (!window.confirm(`Delete ${product.name}? This cannot be undone.`)) return;
    deleteProduct.mutate({ id: product.id }, { onSuccess: refresh });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-4xl font-bold tracking-tight mb-2">Pieces</h1>
          <p className="text-muted-foreground">Manage your collection.</p>
        </div>
        <Link href="/vendor-dashboard/products/new">
          <Button className="rounded-none font-bold tracking-widest uppercase text-xs h-12 px-6">
            <Plus className="w-4 h-4 mr-2" /> Add Piece
          </Button>
        </Link>
      </div>

      <div className="border border-border bg-background overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-secondary/50 border-b border-border text-xs font-bold tracking-widest uppercase text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-medium">Product</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Inventory</th>
                <th className="px-6 py-4 font-medium">Price</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><Skeleton className="h-12 w-48" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-6 w-20" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-6 w-16" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-6 w-24" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-8 w-8 ml-auto" /></td>
                  </tr>
                ))
              ) : !productsData?.items || productsData.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    No pieces in your collection yet.
                  </td>
                </tr>
              ) : (
                productsData.items.map((product) => (
                  <tr key={product.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-16 bg-secondary overflow-hidden shrink-0 border border-border/50">
                          {product.images?.[0] ? (
                            <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[8px] text-muted-foreground">No img</div>
                          )}
                        </div>
                        <div className="font-medium line-clamp-2 max-w-[200px]">{product.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-[10px] font-bold tracking-widest uppercase border ${product.isActive ? 'border-primary text-primary bg-primary/5' : 'border-muted-foreground text-muted-foreground bg-secondary'}`}>
                        {product.isActive ? 'Active' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {product.stock > 0 ? (
                        <span>{product.stock} units</span>
                      ) : (
                        <span className="text-destructive font-medium">Sold Out</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-serif text-lg">
                      {product.currency}{product.price.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 rounded-none border-border">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-none border-border shadow-md">
                           <DropdownMenuItem onClick={() => setEditing(product)} className="cursor-pointer text-xs uppercase tracking-widest font-medium">
                            <Pencil className="mr-2 h-3 w-3" /> Edit
                          </DropdownMenuItem>
                           <DropdownMenuItem onClick={() => toggleActive(product)} className="cursor-pointer text-xs uppercase tracking-widest font-medium">
                             {product.isActive ? <EyeOff className="mr-2 h-3 w-3" /> : <Eye className="mr-2 h-3 w-3" />}
                             {product.isActive ? "Archive" : "Restore"}
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={() => removeProduct(product)} className="cursor-pointer text-xs uppercase tracking-widest font-medium text-destructive focus:text-destructive">
                             <Trash2 className="mr-2 h-3 w-3" /> Delete permanently
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {editing && (
        <VendorProductEditor
          product={editing}
          saving={updateProduct.isPending}
          onClose={() => setEditing(null)}
          onSave={(data) => updateProduct.mutate({ id: editing.id, data }, { onSuccess: () => { refresh(); setEditing(null); } })}
        />
      )}
    </div>
  );
}

function VendorProductEditor({ product, saving, onClose, onSave }: {
  product: any;
  saving: boolean;
  onClose: () => void;
  onSave: (data: { name: string; description?: string; price: number; category?: string; sizes: string[]; images: string[]; stock: number }) => void;
}) {
  const [form, setForm] = useState({
    name: product.name ?? "",
    description: product.description ?? "",
    price: String(product.price ?? ""),
    category: product.category ?? "",
    sizes: (product.sizes ?? []).join(", "),
    images: (product.images ?? []).join("\n"),
    stock: String(product.stock ?? 0),
  });
  const input = "mt-1 w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground";
  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-black/30 p-0 backdrop-blur-sm md:items-center md:justify-center md:p-6" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto bg-background p-5 shadow-2xl md:p-7">
        <div className="flex items-start justify-between border-b border-border pb-5">
          <div><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Catalog editor</p><h2 className="mt-2 font-serif text-3xl">Edit piece</h2></div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close editor">×</button>
        </div>
        <form onSubmit={(event) => {
          event.preventDefault();
          onSave({
            name: form.name.trim(), description: form.description.trim() || undefined,
            price: Number(form.price), category: form.category.trim() || undefined,
            sizes: form.sizes.split(",").map((v: string) => v.trim()).filter(Boolean),
            images: form.images.split("\n").map((v: string) => v.trim()).filter(Boolean),
            stock: Number(form.stock),
          });
        }} className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Name<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={input} /></label>
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Price (₦)<input required min="1" type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className={input} /></label>
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Category<input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={input} /></label>
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Stock<input required min="0" type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} className={input} /></label>
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground md:col-span-2">Description<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={`${input} min-h-24`} /></label>
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Sizes<input value={form.sizes} onChange={e => setForm({ ...form, sizes: e.target.value })} className={input} /></label>
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Images <span className="normal-case tracking-normal">(one path per line)</span><textarea value={form.images} onChange={e => setForm({ ...form, images: e.target.value })} className={`${input} min-h-24`} /></label>
          <div className="flex gap-3 border-t border-border pt-5 md:col-span-2"><Button type="button" variant="outline" className="rounded-none" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving} className="rounded-none">{saving ? "Saving…" : "Save changes"}</Button></div>
        </form>
      </div>
    </div>
  );
}
