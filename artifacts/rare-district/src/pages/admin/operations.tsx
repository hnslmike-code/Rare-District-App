import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Download, Loader2, ShieldBan, ShieldCheck, Store, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { adminJson, downloadAdminExport } from "@/lib/admin-control";

type Operations = {
  lowStock: Array<{ id: number; name: string; stock: number; isActive: boolean; vendorId: number }>;
  pendingVendors: Array<{ id: number; brandName: string; status: string; createdAt: string }>;
  recentCustomers: Array<{ id: number; email: string; name: string | null; role: string; isSuspended: boolean; createdAt: string }>;
  auditLogs: Array<{ id: number; action: string; entityType: string; entityId: string | null; detail: string | null; createdAt: string }>;
  categories: Array<{ id: number; name: string; slug: string }>;
};

export default function AdminOperations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const operations = useQuery({ queryKey: ["admin-operations"], queryFn: () => adminJson<Operations>("/api/admin/operations") });
  const customerAction = useMutation({
    mutationFn: ({ id, isSuspended }: { id: number; isSuspended: boolean }) => adminJson(`/api/admin/customers/${id}`, { method: "PATCH", body: JSON.stringify({ isSuspended }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-operations"] }); toast({ title: "Customer account updated." }); },
    onError: (error: Error) => toast({ title: "Customer not updated", description: error.message, variant: "destructive" }),
  });
  if (operations.isLoading) return <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading operations…</div>;
  if (operations.isError || !operations.data) return <div className="border border-destructive/40 p-6 text-sm text-destructive">Operations data could not be loaded.</div>;
  const data = operations.data;
  const exportData = async (resource: "products" | "orders" | "customers" | "transactions") => {
    try { await downloadAdminExport(resource); toast({ title: `${resource[0].toUpperCase()}${resource.slice(1)} export downloaded.` }); }
    catch (error) { toast({ title: "Export failed", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" }); }
  };
  return (
    <div className="space-y-8" data-testid="admin-operations">
      <div><p className="eyebrow">Marketplace health</p><h1 className="mt-2 font-serif text-4xl font-medium tracking-tight">Operations center</h1><p className="mt-2 text-sm text-muted-foreground">Act on low inventory, incoming vendors, customer accounts, and data exports from one place.</p></div>
      <div className="grid gap-4 md:grid-cols-3">
        <section className="border border-border p-5"><AlertTriangle className="h-5 w-5 text-amber-600" /><p className="mt-6 text-3xl font-serif">{data.lowStock.length}</p><p className="mt-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">Low-stock pieces</p></section>
        <section className="border border-border p-5"><Store className="h-5 w-5 text-primary" /><p className="mt-6 text-3xl font-serif">{data.pendingVendors.length}</p><p className="mt-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">Vendor reviews</p></section>
        <section className="border border-border p-5"><Users className="h-5 w-5 text-primary" /><p className="mt-6 text-3xl font-serif">{data.recentCustomers.length}</p><p className="mt-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">Recent accounts</p></section>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border border-border p-5 md:p-6"><h2 className="font-serif text-2xl">Inventory attention</h2><div className="mt-4 divide-y divide-border">{data.lowStock.length ? data.lowStock.map(product => <div key={product.id} className="flex items-center justify-between py-3"><div><p className="text-sm font-medium">{product.name}</p><p className="text-xs text-muted-foreground">Vendor #{product.vendorId} · {product.isActive ? "Live" : "Hidden"}</p></div><span className="border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs font-bold text-amber-700">{product.stock} left</span></div>) : <p className="py-6 text-sm text-muted-foreground">No low-stock products need attention.</p>}</div></section>
        <section className="border border-border p-5 md:p-6"><h2 className="font-serif text-2xl">Vendor review queue</h2><div className="mt-4 divide-y divide-border">{data.pendingVendors.length ? data.pendingVendors.map(vendor => <div key={vendor.id} className="flex items-center justify-between py-3"><div><p className="text-sm font-medium">{vendor.brandName}</p><p className="text-xs text-muted-foreground">Received {new Date(vendor.createdAt).toLocaleDateString()}</p></div><a href="/admin/vendors" className="text-xs font-bold uppercase tracking-widest underline underline-offset-4">Review</a></div>) : <p className="py-6 text-sm text-muted-foreground">No vendor applications are waiting.</p>}</div></section>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <section className="border border-border p-5 md:p-6"><h2 className="font-serif text-2xl">Customer controls</h2><div className="mt-4 divide-y divide-border">{data.recentCustomers.map(customer => <div key={customer.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">{customer.name || customer.email}</p><p className="text-xs text-muted-foreground">{customer.email} · {customer.role}</p></div><button onClick={() => customerAction.mutate({ id: customer.id, isSuspended: !customer.isSuspended })} disabled={customerAction.isPending} className={`inline-flex w-fit items-center gap-2 border px-3 py-2 text-xs font-bold uppercase tracking-widest ${customer.isSuspended ? "border-foreground hover:bg-secondary" : "border-destructive/50 text-destructive hover:bg-destructive/10"}`}>{customer.isSuspended ? <><ShieldCheck className="h-3.5 w-3.5" /> Restore</> : <><ShieldBan className="h-3.5 w-3.5" /> Suspend</>}</button></div>)}</div></section>
        <section className="border border-border p-5 md:p-6"><h2 className="font-serif text-2xl">Exports</h2><p className="mt-2 text-sm text-muted-foreground">Download current marketplace data as a CSV.</p><div className="mt-5 grid gap-2">{(["products", "orders", "customers", "transactions"] as const).map(resource => <button key={resource} onClick={() => exportData(resource)} className="flex items-center justify-between border border-border px-3 py-3 text-left text-xs font-bold uppercase tracking-widest hover:bg-secondary"><span>{resource}</span><Download className="h-3.5 w-3.5" /></button>)}</div></section>
      </div>
      <section className="border border-border p-5 md:p-6"><h2 className="font-serif text-2xl">Administrator activity</h2><div className="mt-4 grid gap-2">{data.auditLogs.length ? data.auditLogs.map(log => <div key={log.id} className="flex flex-col justify-between gap-1 border-b border-border py-3 text-sm sm:flex-row"><p><span className="font-medium">{log.action.replaceAll("_", " ")}</span><span className="text-muted-foreground"> · {log.entityType}{log.entityId ? ` #${log.entityId}` : ""}</span></p><p className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</p></div>) : <p className="py-6 text-sm text-muted-foreground">Admin actions will be recorded here.</p>}</div></section>
    </div>
  );
}