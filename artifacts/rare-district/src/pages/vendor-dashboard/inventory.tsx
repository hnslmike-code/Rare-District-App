import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useGetMyVendorProfile } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { downloadInventoryExport, vendorJson } from "@/lib/vendor-control";

type Product = { id: number; name: string; price: number; stock: number };
type Variant = {
  id: number;
  sku: string;
  attributes: Record<string, string>;
  stock: number;
  reservedStock: number;
  availableStock: number;
  priceAdjustment: number;
  lowStockThreshold: number;
};

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` });

function previewRows(csv: string) {
  const rows = csv.trim().split(/\r?\n/).filter(Boolean);
  if (!rows.length) return { headers: [] as string[], rows: [] as string[][] };
  return {
    headers: rows[0].split(",").map(value => value.replace(/^"|"$/g, "").trim()),
    rows: rows.slice(1, 6).map(row => row.split(",").map(value => value.replace(/^"|"$/g, "").trim())),
  };
}

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
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkStocks, setBulkStocks] = useState<Record<number, string>>({});
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importCsv, setImportCsv] = useState("");
  const [importing, setImporting] = useState(false);

  const loadProducts = async () => {
    if (!profile?.id) return;
    const response = await fetch(`/api/products?vendorId=${profile.id}&limit=100`, { headers: authHeaders() });
    const data = await response.json();
    const nextProducts = data.items ?? data;
    setProducts(nextProducts);
    if (!productId && nextProducts[0]) setProductId(String(nextProducts[0].id));
  };

  const loadVariants = async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/vendors/inventory/variants?productId=${productId}`, { headers: authHeaders() });
      const nextVariants = response.ok ? await response.json() : [];
      setVariants(nextVariants);
      setSelectedIds(previous => previous.filter(id => nextVariants.some((variant: Variant) => variant.id === id)));
      setBulkStocks(previous => Object.fromEntries(nextVariants.map((variant: Variant) => [variant.id, previous[variant.id] ?? String(variant.stock)])));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadProducts(); }, [profile?.id]);
  useEffect(() => { void loadVariants(); }, [productId]);

  const parsedAttributes = useMemo(
    () => Object.fromEntries(attributes.split(",").map(pair => pair.split("=").map(value => value.trim())).filter(pair => pair.length === 2 && pair[0] && pair[1])),
    [attributes],
  );
  const selectedVariants = variants.filter(variant => selectedIds.includes(variant.id));
  const csvPreview = useMemo(() => previewRows(importCsv), [importCsv]);

  const addVariant = async () => {
    const response = await fetch("/api/vendors/inventory/variants", {
      method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ productId: Number(productId), attributes: parsedAttributes, stock: Number(stock), priceAdjustment: Number(priceAdjustment), sku: sku || undefined }),
    });
    const data = await response.json();
    if (!response.ok) {
      toast({ title: "Variant not added", description: data.error, variant: "destructive" });
      return;
    }
    toast({ title: "Variant added." });
    setSku("");
    setStock("0");
    await loadVariants();
    await loadProducts();
  };

  const adjustVariant = async (variant: Variant) => {
    const next = window.prompt("Set total stock for this variant", String(variant.stock));
    if (next === null) return;
    try {
      await vendorJson(`/api/vendors/inventory/variants/${variant.id}`, {
        method: "PATCH",
        body: JSON.stringify({ stock: Number(next), reason: "vendor_adjustment" }),
      });
      toast({ title: "Stock updated." });
      await loadVariants();
      await loadProducts();
    } catch (error) {
      toast({ title: "Stock not updated", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    }
  };

  const toggleSelection = (variantId: number) => {
    setSelectedIds(previous => previous.includes(variantId) ? previous.filter(id => id !== variantId) : [...previous, variantId]);
  };

  const updateSelectedStock = async () => {
    const updates = selectedVariants.map(variant => ({
      variantId: variant.id,
      stock: Number(bulkStocks[variant.id] ?? variant.stock),
      reason: "bulk_update",
      note: "Inventory workspace bulk update",
    }));
    if (updates.some(update => !Number.isInteger(update.stock) || update.stock < 0)) {
      toast({ title: "Enter whole-number stock values.", variant: "destructive" });
      return;
    }
    setBulkSaving(true);
    try {
      const result = await vendorJson<{ count: number }>("/api/vendors/inventory/variants/bulk-stock", {
        method: "POST",
        body: JSON.stringify({ updates }),
      });
      toast({ title: `${result.count} variant${result.count === 1 ? "" : "s"} updated.` });
      setBulkOpen(false);
      setSelectedIds([]);
      await loadVariants();
      await loadProducts();
    } catch (error) {
      toast({ title: "Bulk update not applied", description: error instanceof Error ? error.message : "Review the selected stock.", variant: "destructive" });
    } finally {
      setBulkSaving(false);
    }
  };

  const chooseCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 250_000) {
      toast({ title: "Choose a CSV under 250 KB.", variant: "destructive" });
      return;
    }
    setImportCsv(await file.text());
  };

  const submitCsvImport = async () => {
    if (!importCsv.trim()) return;
    setImporting(true);
    try {
      const result = await vendorJson<{ count: number }>("/api/vendors/inventory/variants/import", {
        method: "POST",
        body: JSON.stringify({ csv: importCsv }),
      });
      toast({ title: `${result.count} variant${result.count === 1 ? "" : "s"} imported.` });
      setImportOpen(false);
      setImportCsv("");
      await loadVariants();
      await loadProducts();
    } catch (error) {
      toast({ title: "CSV import not applied", description: error instanceof Error ? error.message : "Check the file and try again.", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const selectedProduct = products.find(product => String(product.id) === productId);
  const allSelected = variants.length > 0 && selectedIds.length === variants.length;

  return <div className="space-y-8">
    <header>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Workspace / Inventory</p>
      <h1 className="mt-2 font-serif text-4xl font-bold tracking-tight">Inventory</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">Manage variant stock, generated SKUs, reservations, and low-stock decisions from one place.</p>
    </header>

    <div className="flex flex-col gap-3 border border-border bg-background p-5 sm:flex-row sm:items-end">
      <label className="flex-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">Product
        <select value={productId} onChange={event => setProductId(event.target.value)} className="mt-2 h-11 w-full border border-border bg-background px-3 text-sm font-normal tracking-normal">
          {products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}
        </select>
      </label>
      <div className="text-right"><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Aggregate stock</p><p className="font-serif text-2xl">{selectedProduct?.stock ?? 0}</p></div>
    </div>

    <section className="border border-border bg-background p-5">
      <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div><h2 className="font-serif text-2xl font-bold">Variant matrix</h2><p className="mt-1 text-xs text-muted-foreground">Export a workbook, change the <span className="font-mono">Stock</span> values, then import it to update matching Variant IDs.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="h-9 rounded-none text-xs" disabled={!productId} onClick={() => void downloadInventoryExport(Number(productId)).catch(error => toast({ title: "Export unavailable", description: error.message, variant: "destructive" }))}>Export CSV</Button>
          <Button type="button" variant="outline" className="h-9 rounded-none text-xs" onClick={() => setImportOpen(true)}>Import CSV</Button>
          <Button type="button" className="h-9 rounded-none text-xs" disabled={!selectedIds.length} onClick={() => setBulkOpen(true)}>Update selected ({selectedIds.length})</Button>
        </div>
      </div>
      <div className="mb-3 flex items-center justify-between"><button onClick={() => setSelectedIds(allSelected ? [] : variants.map(variant => variant.id))} className="text-xs font-bold uppercase tracking-widest underline">{allSelected ? "Clear selection" : "Select all"}</button><span className="text-xs uppercase tracking-widest text-muted-foreground">{variants.length} variants</span></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead><tr className="border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground"><th className="w-10 pb-3"><span className="sr-only">Select</span></th><th className="pb-3">Attributes</th><th className="pb-3">SKU</th><th className="pb-3">Available</th><th className="pb-3">Reserved</th><th className="pb-3">Price adjustment</th><th /></tr></thead>
          <tbody>{loading ? <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Loading variants…</td></tr> : variants.length === 0 ? <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Add a variant to begin tracking inventory.</td></tr> : variants.map(variant => <tr key={variant.id} className="border-b border-border/70"><td className="py-4"><input aria-label={`Select ${variant.sku}`} type="checkbox" checked={selectedIds.includes(variant.id)} onChange={() => toggleSelection(variant.id)} /></td><td className="py-4">{Object.entries(variant.attributes).map(([key, value]) => <span key={key} className="mr-2 inline-block bg-secondary px-2 py-1 text-xs">{key}: {value}</span>)}</td><td className="py-4 font-mono text-xs">{variant.sku}</td><td className={`py-4 font-bold ${variant.availableStock <= variant.lowStockThreshold ? "text-amber-700" : ""}`}>{variant.availableStock}</td><td className="py-4 text-muted-foreground">{variant.reservedStock}</td><td className="py-4">{variant.priceAdjustment >= 0 ? "+" : ""}₦{variant.priceAdjustment.toLocaleString()}</td><td className="py-4 text-right"><button onClick={() => void adjustVariant(variant)} className="text-xs font-bold uppercase tracking-widest underline">Adjust</button></td></tr>)}</tbody>
        </table>
      </div>
      <div className="mt-6 grid gap-3 border-t border-border pt-5 md:grid-cols-[1.6fr_1fr_1fr_1fr_auto]">
        <input value={attributes} onChange={event => setAttributes(event.target.value)} placeholder="Size=S, Color=Black" className="h-10 border border-border bg-transparent px-3 text-sm" />
        <input value={sku} onChange={event => setSku(event.target.value)} placeholder="SKU (optional)" className="h-10 border border-border bg-transparent px-3 text-sm" />
        <input type="number" min="0" value={stock} onChange={event => setStock(event.target.value)} placeholder="Stock" className="h-10 border border-border bg-transparent px-3 text-sm" />
        <input type="number" value={priceAdjustment} onChange={event => setPriceAdjustment(event.target.value)} placeholder="Price adjustment" className="h-10 border border-border bg-transparent px-3 text-sm" />
        <button onClick={() => void addVariant()} className="h-10 bg-foreground px-4 text-xs font-bold uppercase tracking-widest text-background">Add</button>
      </div>
    </section>
    <p className="text-xs text-muted-foreground">Variant inventory is the source of truth for products using variants. Existing simple products remain supported while the catalog is migrated.</p>

    <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
      <DialogContent className="max-w-2xl rounded-none">
        <DialogHeader><DialogTitle>Update selected variants</DialogTitle><DialogDescription>Every change is recorded in your inventory history. Stock cannot fall below active reservations.</DialogDescription></DialogHeader>
        <div className="max-h-[50vh] space-y-3 overflow-y-auto py-2">{selectedVariants.map(variant => <label key={variant.id} className="grid grid-cols-[1fr_140px] items-center gap-4 border-b border-border pb-3 text-sm"><span><span className="block font-mono text-xs">{variant.sku}</span><span className="text-xs text-muted-foreground">Reserved: {variant.reservedStock} · Available now: {variant.availableStock}</span></span><input type="number" min={variant.reservedStock} value={bulkStocks[variant.id] ?? variant.stock} onChange={event => setBulkStocks(previous => ({ ...previous, [variant.id]: event.target.value }))} className="h-10 border border-border bg-background px-3" /></label>)}</div>
        <DialogFooter><Button type="button" variant="outline" className="rounded-none" onClick={() => setBulkOpen(false)}>Cancel</Button><Button type="button" className="rounded-none" disabled={bulkSaving} onClick={() => void updateSelectedStock()}>{bulkSaving ? "Updating…" : `Update ${selectedVariants.length} variants`}</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={importOpen} onOpenChange={setImportOpen}>
      <DialogContent className="max-w-3xl rounded-none">
        <DialogHeader><DialogTitle>Import inventory CSV</DialogTitle><DialogDescription>Use an exported CSV so each row keeps its Variant ID. The server validates the whole file before changing any stock.</DialogDescription></DialogHeader>
        <input type="file" accept=".csv,text/csv" onChange={event => void chooseCsv(event)} className="block w-full text-sm" />
        {importCsv && <div className="max-h-[250px] overflow-auto border border-border"><table className="w-full text-left text-xs"><thead><tr className="border-b border-border">{csvPreview.headers.map(header => <th key={header} className="p-2 font-bold">{header}</th>)}</tr></thead><tbody>{csvPreview.rows.map((row, index) => <tr key={index} className="border-b border-border/70">{row.map((value, cellIndex) => <td key={cellIndex} className="p-2">{value}</td>)}</tr>)}</tbody></table></div>}
        <DialogFooter><Button type="button" variant="outline" className="rounded-none" onClick={() => setImportOpen(false)}>Cancel</Button><Button type="button" className="rounded-none" disabled={!importCsv || importing} onClick={() => void submitCsvImport()}>{importing ? "Importing…" : "Apply CSV changes"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}