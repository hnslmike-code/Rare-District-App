import { useMemo } from "react";
import { useParams, Link } from "wouter";
import { getGetAdminVendorDetailQueryKey, getListAdminVendorsQueryKey, useGetAdminVendorDetail, useUpdateVendorStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
  Store,
  Mail,
  Phone,
  Link as LinkIcon,
  AlertTriangle,
  Ban,
  MessageSquare,
  Shield,
  Activity,
  Package,
  Building,
  Image as ImageIcon,
} from "lucide-react";

const statusColors: Record<string, string> = {
  approved: "bg-green-100 text-green-800 border-green-200",
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
};

export default function AdminVendorDetail() {
  const params = useParams();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, error } = useGetAdminVendorDetail(id, {
    query: { queryKey: getGetAdminVendorDetailQueryKey(id), enabled: !!id }
  });

  const updateStatus = useUpdateVendorStatus({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getGetAdminVendorDetailQueryKey(id)
        });
        queryClient.invalidateQueries({ queryKey: getListAdminVendorsQueryKey() });
        toast({ title: "Vendor status updated successfully." });
      },
      onError: (err: any) => {
        toast({ title: "Failed to update vendor", description: err.message, variant: "destructive" });
      }
    }
  });

  const handleStatusChange = (status: "approved" | "rejected") => {
    const note = window.prompt(`Enter a note for changing status to ${status} (optional):`);
    if (note !== null) {
      updateStatus.mutate({ id, data: { status, adminNote: note || undefined } });
    }
  };

  const timeline = useMemo(() => {
    if (!data) return [];
    const typedData = data;
    const events: Array<{ type: string; date: Date; icon: any; title: string; desc: string; meta?: string }> = [];
    
    typedData.notes?.forEach(n => events.push({
      type: 'note', date: new Date(n.createdAt), icon: MessageSquare, title: `Note added by ${n.admin?.name || 'Admin'}`, desc: n.text ?? ''
    }));
    typedData.suspensions?.forEach(s => events.push({
      type: 'suspension', date: new Date(s.createdAt), icon: Ban, title: `Suspended by ${s.admin?.name || 'Admin'}`, desc: s.reason ?? ''
    }));
    typedData.decisions?.forEach(d => events.push({
      type: 'decision', date: new Date(d.createdAt), icon: Shield, title: `Status set to ${d.status} by ${d.admin?.name || 'Admin'}`, desc: d.note || ''
    }));
    typedData.auditEvents?.forEach(a => events.push({
      type: 'audit', date: new Date(a.createdAt), icon: Activity, title: `${a.action} on ${a.entityType}`, desc: a.detail || ''
    }));

    return events.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-20 text-center">
        <AlertTriangle className="w-10 h-10 mx-auto text-destructive mb-4" />
        <h2 className="text-xl font-bold">Failed to load vendor</h2>
        <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  const { vendor, balance, catalog, orderItems, payouts } = data;

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-border">
        <div>
          <Link href="/admin/vendors" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Vendors
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center font-serif text-2xl font-bold text-muted-foreground border border-border">
              {vendor.logoUrl ? (
                <img src={vendor.logoUrl} alt={vendor.brandName} className="w-full h-full object-cover rounded-full" />
              ) : vendor.brandName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-serif text-3xl font-bold tracking-tight">{vendor.brandName}</h1>
                <span className={`text-xs font-bold tracking-widest uppercase px-2 py-1 rounded border ${statusColors[vendor.status] ?? "bg-secondary"}`}>
                  {vendor.status}
                </span>
              </div>
              <p className="text-muted-foreground mt-1">{vendor.contactName || "No contact"} · {vendor.user?.email}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {vendor.status === "pending" && (
            <>
              <Button size="sm" onClick={() => handleStatusChange("approved")} disabled={updateStatus.isPending}>
                <CheckCircle className="w-4 h-4 mr-2" /> Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleStatusChange("rejected")} disabled={updateStatus.isPending}>
                <XCircle className="w-4 h-4 mr-2" /> Reject
              </Button>
            </>
          )}
          {vendor.status === "approved" && (
            <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10 border-destructive/20" onClick={() => handleStatusChange("rejected")} disabled={updateStatus.isPending}>
              <Ban className="w-4 h-4 mr-2" /> Suspend
            </Button>
          )}
          {vendor.status === "rejected" && (
            <Button size="sm" onClick={() => handleStatusChange("approved")} disabled={updateStatus.isPending}>
              <CheckCircle className="w-4 h-4 mr-2" /> Reinstate
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start h-auto p-1 bg-secondary/50 rounded-none overflow-x-auto flex-nowrap mb-6">
          <TabsTrigger value="overview" className="rounded-none data-[state=active]:bg-background data-[state=active]:shadow-sm min-w-max">Overview</TabsTrigger>
          <TabsTrigger value="catalog" className="rounded-none data-[state=active]:bg-background data-[state=active]:shadow-sm min-w-max">Catalog ({catalog.length})</TabsTrigger>
          <TabsTrigger value="orders" className="rounded-none data-[state=active]:bg-background data-[state=active]:shadow-sm min-w-max">Orders ({orderItems.length})</TabsTrigger>
          <TabsTrigger value="payouts" className="rounded-none data-[state=active]:bg-background data-[state=active]:shadow-sm min-w-max">Payouts ({payouts.length})</TabsTrigger>
          <TabsTrigger value="timeline" className="rounded-none data-[state=active]:bg-background data-[state=active]:shadow-sm min-w-max">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 border border-border bg-card">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Available</p>
              <p className="text-2xl font-serif">₦{balance.available.toLocaleString()}</p>
            </div>
            <div className="p-4 border border-border bg-card">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Pending Payouts</p>
              <p className="text-2xl font-serif">₦{balance.pendingPayouts.toLocaleString()}</p>
            </div>
            <div className="p-4 border border-border bg-card">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Total Sales</p>
              <p className="text-2xl font-serif">₦{balance.totalSales.toLocaleString()}</p>
            </div>
            <div className="p-4 border border-border bg-card">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Total Paid</p>
              <p className="text-2xl font-serif">₦{balance.totalPaid.toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <section className="p-6 border border-border bg-card">
                <h3 className="font-serif text-lg mb-4 flex items-center gap-2"><Store className="w-4 h-4 text-muted-foreground" /> Brand Details</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Description</p>
                    <p className="text-sm">{vendor.description || "—"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Category</p>
                      <p className="text-sm font-medium">{vendor.category || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Experience</p>
                      <p className="text-sm font-medium">{vendor.experienceLevel || "—"}</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="p-6 border border-border bg-card">
                <h3 className="font-serif text-lg mb-4 flex items-center gap-2"><Building className="w-4 h-4 text-muted-foreground" /> Financials</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Commission Override</p>
                      <p className="text-sm font-medium">{vendor.commissionRateOverride != null ? `${vendor.commissionRateOverride}%` : "Platform Default"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Total Commission Paid</p>
                      <p className="text-sm font-medium">₦{balance.totalCommission.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-border">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Payout Account</p>
                    {vendor.payoutAccount ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Bank</p>
                          <p className="text-sm">{vendor.payoutAccount.bankName || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Account</p>
                          <p className="text-sm">**** {vendor.payoutAccount.accountNumberLast4 || "—"}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground mb-1">Name</p>
                          <p className="text-sm">{vendor.payoutAccount.accountName || "—"}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not configured</p>
                    )}
                  </div>
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <section className="p-6 border border-border bg-card">
                <h3 className="font-serif text-lg mb-4 flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" /> Contact Info</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{vendor.user?.email || "—"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{vendor.phone || "—"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <LinkIcon className="w-4 h-4 text-muted-foreground" />
                    {vendor.website ? (
                      <a href={vendor.website} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">{vendor.website}</a>
                    ) : 
                    <span className="text-sm text-muted-foreground">—</span>
                    }
                  </div>
                  <div className="flex items-center gap-3">
                    <LinkIcon className="w-4 h-4 text-muted-foreground" />
                    {vendor.socialLink ? (
                      <a href={vendor.socialLink} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">Social Media</a>
                    ) : 
                    <span className="text-sm text-muted-foreground">—</span>
                    }
                  </div>
                </div>
              </section>

              {vendor.sampleImages && vendor.sampleImages.length > 0 && (
                <section className="p-6 border border-border bg-card">
                  <h3 className="font-serif text-lg mb-4 flex items-center gap-2"><ImageIcon className="w-4 h-4 text-muted-foreground" /> Portfolio</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {vendor.sampleImages.map((img, i) => (
                      <a key={i} href={img.startsWith('http') ? img : `/api/storage${img}`} target="_blank" rel="noreferrer" className="block aspect-square bg-secondary rounded overflow-hidden">
                        <img src={img.startsWith('http') ? img : `/api/storage${img}`} alt="Sample" className="w-full h-full object-cover hover:scale-105 transition-transform" />
                      </a>
                    ))}
                  </div>
                </section>
              )}
              
              {vendor.adminNote && (
                 <section className="p-4 border border-yellow-200 bg-yellow-50 text-yellow-900 rounded-sm">
                   <h3 className="font-bold text-sm mb-1 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Admin Note</h3>
                   <p className="text-sm">{vendor.adminNote}</p>
                 </section>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="catalog" className="space-y-4 mt-6">
          <div className="border border-border rounded-md overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-secondary/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Product</th>
                    <th className="px-6 py-3 font-semibold">Price</th>
                    <th className="px-6 py-3 font-semibold">Stock</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold text-right">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {catalog.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No products found.</td></tr>
                  ) : (
                    catalog.map(prod => (
                      <tr key={prod.id} className="hover:bg-secondary/20">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-secondary rounded overflow-hidden shrink-0">
                              {prod.images?.[0] ? <img src={prod.images[0].startsWith('http') ? prod.images[0] : `/api/storage${prod.images[0]}`} className="w-full h-full object-cover" alt="" /> : <Package className="w-5 h-5 m-2.5 text-muted-foreground" />}
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{prod.name}</p>
                              <p className="text-xs text-muted-foreground">{prod.category || "Uncategorized"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono">{prod.currency} {prod.price.toLocaleString()}</td>
                        <td className="px-6 py-4">{prod.stock}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${prod.isActive ? 'bg-green-100 text-green-800' : 'bg-secondary text-muted-foreground'}`}>
                            {prod.isActive ? 'Active' : 'Draft'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-muted-foreground text-xs">{new Date(prod.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4 mt-6">
          <div className="border border-border rounded-md overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-secondary/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Order Item</th>
                    <th className="px-6 py-3 font-semibold">Customer</th>
                    <th className="px-6 py-3 font-semibold">Price (Qty)</th>
                    <th className="px-6 py-3 font-semibold">Vendor Cut</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orderItems.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No order items found.</td></tr>
                  ) : (
                    orderItems.map(item => (
                      <tr key={item.id} className="hover:bg-secondary/20">
                        <td className="px-6 py-4">
                          <p className="font-medium text-foreground">{item.productName}</p>
                          <p className="text-xs text-muted-foreground">Order #{item.orderId} {item.selectedSize ? `· Size ${item.selectedSize}` : ''}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-foreground">{item.customer?.name || 'Guest'}</p>
                          <p className="text-xs text-muted-foreground">{item.customer?.email}</p>
                        </td>
                        <td className="px-6 py-4 font-mono">
                          ₦{item.unitPrice.toLocaleString()} <span className="text-muted-foreground text-xs">x{item.quantity}</span>
                        </td>
                        <td className="px-6 py-4 font-mono text-green-600">
                          ₦{item.vendorAmount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-secondary text-foreground`}>
                            {item.fulfillmentStatus || item.orderStatus || 'Pending'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-muted-foreground text-xs">
                          {item.orderedAt ? new Date(item.orderedAt).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="payouts" className="space-y-4 mt-6">
          <div className="border border-border rounded-md overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-secondary/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Amount</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold">Reference</th>
                    <th className="px-6 py-3 font-semibold">Note</th>
                    <th className="px-6 py-3 font-semibold text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payouts.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No payouts found.</td></tr>
                  ) : (
                    payouts.map(payout => (
                      <tr key={payout.id} className="hover:bg-secondary/20">
                        <td className="px-6 py-4 font-mono font-medium text-foreground">
                          ₦{payout.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                           <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${payout.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-secondary text-muted-foreground'}`}>
                            {payout.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs">{payout.reference || '—'}</td>
                        <td className="px-6 py-4 text-muted-foreground text-xs truncate max-w-[200px]">{payout.note || '—'}</td>
                        <td className="px-6 py-4 text-right text-muted-foreground text-xs">
                          {new Date(payout.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="mt-6">
          <div className="max-w-2xl">
            {timeline.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-border rounded bg-secondary/10">
                <Clock className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No history available for this vendor.</p>
              </div>
            ) : (
              <div className="space-y-8 pl-4 border-l-2 border-border ml-4">
                {timeline.map((event, i) => {
                  const Icon = event.icon;
                  return (
                    <div key={i} className="relative">
                      <div className="absolute -left-[41px] bg-background p-1 border-2 border-border rounded-full shadow-sm">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-sm">{event.title}</p>
                          <span className="text-xs text-muted-foreground">· {event.date.toLocaleString()}</span>
                        </div>
                        {event.desc && (
                          <div className={`mt-2 text-sm p-3 rounded-md ${event.type === 'note' ? 'bg-secondary/50' : event.type === 'suspension' ? 'bg-destructive/10 text-destructive border border-destructive/20' : 'border border-border bg-card'}`}>
                            {event.desc}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
