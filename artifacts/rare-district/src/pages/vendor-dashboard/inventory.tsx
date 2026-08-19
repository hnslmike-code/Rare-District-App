import { useEffect, useMemo, useState } from "react";
import { useGetMyVendorProfile } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

type Product = { id: number; name: string; price: number; stock: number };
type Variant = { id: number; sku: string; attributes: Record<string, string>; stock: number; reservedStock: number; availableStock: number; priceAdjustment: number; lowStockThreshold: number };
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` });

export default function VendorInventory() {
  const { data: profile } = useGetMyVendorProfile();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(false);
  const [attributes, setAttributes] = useState("Size=S, Color=Black");
  const [stock, setStock] = useState("0");
  const [priceAdjustment, setPriceAdjustment] = useState("0");
  const [sku, setSku] = useState("");

  const loadProducts = async () => {
    if (!profile?.id) return;
    const response = await fetch(`/api/products?vendorId=${profile.id}&limit=100`, { headers: authHeaders() });
    const data = await response.json();
    setProducts(data.items ?? data);
    if (!productId && (data.items ?? data)[0]) setProductId(String((data.items ?? data)[0].id));
  };
  const loadVariants = async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/vendors/inventory/variants?productId=${productId}`, { headers: authHeaders() });
      setVariants(response.ok ? await response.json() : []);
    } finally { setLoading(false); }
  };
  useEffect(() => { void loadProducts(); }, [profile?.id]);
  useEffect(() => { void loadVariants(); }, [productId]);

  const parsedAttributes = useMemo(() => Object.fromEntries(attributes.split(",").map(pair => pair.split("=").map(value => value.trim())).filter(pair => pair.length === 2 && pair[0] && pair[1])), [attributes]);
  const addVariant = async () => {
    const response = await fetch("/api/vendors/inventory/variants", {
      method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ productId: Number(productId), attributes: parsedAttributes, stock: Number(stock), priceAdjustment: Number(priceAdjustment), sku: sku || undefined }),
    });
    const data = await response.json();
    if (!response.ok) { toast({ title: "Variant not added", description: data.error, variant: "destructive" }); return; }
    toast({ title: "Variant added." }); setSku(""); setStock("0"); await loadVariants();
  };
  const adjustVariant = async (variant: Variant) => {
    const next = window.prompt("Set total stock for this variant", String(variant.stock));
    if (next === null) return;
    const response = await fetch(`/api/vendors/inventory/variants/${variant.id}`, {
      method: "PATCH", headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ stock: Number(next), reason: "vendor_adjustment" }),
    });
    const data = await response.json();
    if (!response.ok) toast({ title: "Stock not updated", description: data.error, variant: "destructive" });
    else { toast({ title: "Stock updated." }); await loadVariants(); }
  };
  const selectedProduct = products.find(product => String(product.id) === productId);

  return <div className="space-y-8">
    <header><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Workspace / Inventory</p><h1 className="mt-2 font-serif text-4xl font-bold tracking-tight">Inventory</h1><p className="mt-2 max-w-2xl text-muted-foreground">Manage variant stock, generated SKUs, reservations, and low-stock decisions from one place.</p></header>
    <div className="flex flex-col gap-3 border border-border bg-background p-5 sm:flex-row sm:items-end">
      <label className="flex-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">Product<select value={productId} onChange={event => setProductId(event.target.value)} className="mt-2 h-11 w-full border border-border bg-background px-3 text-sm font-normal tracking-normal">{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
      <div className="text-right"><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Aggregate stock</p><p className="font-serif text-2xl">{selectedProduct?.stock ?? 0}</p></div>
    </div>
    <section className="border border-border bg-background p-5">
      <div className="mb-5 flex items-start justify-between gap-4"><div><h2 className="font-serif text-2xl font-bold">Variant matrix</h2><p className="mt-1 text-xs text-muted-foreground">Use any attribute names, formatted as <span className="font-mono">Name=Value</span>.</p></div><span className="text-xs uppercase tracking-widest text-muted-foreground">{variants.length} variants</span></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground"><th className="pb-3">Attributes</th><th className="pb-3">SKU</th><th className="pb-3">Stock</th><th className="pb-3">Reserved</th><th className="pb-3">Price adjustment</th><th /></tr></thead><tbody>{loading ? <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Loading variants…</td></tr> : variants.map(variant => <tr key={variant.id} className="border-b border-border/70"><td className="py-4">{Object.entries(variant.attributes).map(([key, value]) => <span key={key} className="mr-2 inline-block bg-secondary px-2 py-1 text-xs">{key}: {value}</span>)}</td><td className="py-4 font-mono text-xs">{variant.sku}</td><td className={`py-4 font-bold ${variant.availableStock <= variant.lowStockThreshold ? "text-amber-700" : ""}`}>{variant.availableStock}</td><td className="py-4 text-muted-foreground">{variant.reservedStock}</td><td className="py-4">{variant.priceAdjustment >= 0 ? "+" : ""}₦{variant.priceAdjustment.toLocaleString()}</td><td className="py-4 text-right"><button onClick={() => adjustVariant(variant)} className="text-xs font-bold uppercase tracking-widest underline">Adjust</button></td></tr>)}</tbody></table></div>
      <div className="mt-6 grid gap-3 border-t border-border pt-5 md:grid-cols-[1.6fr_1fr_1fr_1fr_auto]">
        <input value={attributes} onChange={event => setAttributes(event.target.value)} placeholder="Size=S, Color=Black" className="h-10 border border-border bg-transparent px-3 text-sm" />
        <input value={sku} onChange={event => setSku(event.target.value)} placeholder="SKU (optional)" className="h-10 border border-border bg-transparent px-3 text-sm" />
        <input type="number" min="0" value={stock} onChange={event => setStock(event.target.value)} placeholder="Stock" className="h-10 border border-border bg-transparent px-3 text-sm" />
        <input type="number" value={priceAdjustment} onChange={event => setPriceAdjustment(event.target.value)} placeholder="Price adjustment" className="h-10 border border-border bg-transparent px-3 text-sm" />
        <button onClick={addVariant} className="h-10 bg-foreground px-4 text-xs font-bold uppercase tracking-widest text-background">Add</button>
      </div>
    </section>
    <p className="text-xs text-muted-foreground">Variant inventory is the source of truth for products using variants. Existing simple products remain supported while the catalog is migrated.</p>
  </div>;
}