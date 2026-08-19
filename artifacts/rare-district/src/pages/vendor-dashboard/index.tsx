import { useGetVendorDashboard } from "@workspace/api-client-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, TrendingUp, Package, ShoppingCart, Activity } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function VendorDashboard() {
  const { data: dashboard, isLoading } = useGetVendorDashboard();
  const { toast } = useToast();
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutPending, setPayoutPending] = useState(false);

  const requestPayout = async () => {
    const amount = Number(payoutAmount);
    if (!Number.isFinite(amount) || amount < 1000) {
      toast({ title: "Minimum payout is ₦1,000", variant: "destructive" });
      return;
    }
    setPayoutPending(true);
    try {
      const response = await fetch("/api/vendors/me/payout-request", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` },
        body: JSON.stringify({ amount }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Payout request failed.");
      toast({ title: "Payout request submitted." });
      setPayoutAmount("");
      setPayoutOpen(false);
    } catch (error) {
      toast({ title: "Payout request failed", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    } finally {
      setPayoutPending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-4xl font-bold tracking-tight mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your atelier's performance.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="rounded-none border-border shadow-none">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Total Revenue</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-serif text-3xl font-medium">₦{dashboard?.totalRevenue?.toLocaleString() || 0}</div>
          </CardContent>
        </Card>
        <Card className="rounded-none border-border shadow-none">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Total Orders</CardTitle>
            <ShoppingCart className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-serif text-3xl font-medium">{dashboard?.totalOrders || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">{dashboard?.pendingOrders || 0} pending fulfillment</p>
          </CardContent>
        </Card>
        <Card className="rounded-none border-border shadow-none">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Active Products</CardTitle>
            <Package className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-serif text-3xl font-medium">{dashboard?.totalProducts || 0}</div>
          </CardContent>
        </Card>
        <Card className="rounded-none border-border shadow-none">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Payout Balance</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-serif text-3xl font-medium">₦{dashboard?.payoutBalance?.toLocaleString() || 0}</div>
            <button onClick={() => setPayoutOpen((open) => !open)} className="text-xs text-primary hover:underline mt-1">Request Payout</button>
          </CardContent>
        </Card>
      </div>

      {payoutOpen && (
        <div className="border border-border bg-background p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <label className="flex-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Amount (₦)
              <input type="number" min="1000" value={payoutAmount} onChange={(event) => setPayoutAmount(event.target.value)} placeholder="1000" className="mt-2 h-11 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-foreground" />
            </label>
            <button onClick={requestPayout} disabled={payoutPending} className="h-11 bg-foreground px-5 text-xs font-bold uppercase tracking-widest text-background disabled:opacity-50">{payoutPending ? "Submitting…" : "Submit request"}</button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Requested funds are held until the payout is reviewed.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-serif text-2xl font-bold">Top Performing Pieces</h2>
            <Link href="/vendor-dashboard/products" className="text-xs font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground flex items-center gap-1">
              View All <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          
          <div className="space-y-4">
            {dashboard?.topProducts && dashboard.topProducts.length > 0 ? (
              dashboard.topProducts.slice(0, 5).map(product => (
                <div key={product.id} className="flex items-center gap-4 p-4 border border-border bg-background">
                  <div className="w-16 h-16 bg-secondary overflow-hidden shrink-0">
                    {product.images?.[0] && <img src={product.images[0]} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium line-clamp-1">{product.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{product.stock} in stock</p>
                  </div>
                  <div className="text-right">
                    <p className="font-serif">₦{product.price.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1">{(product as any).unitsSold ?? 0} units sold · ₦{((product as any).vendorRevenue ?? 0).toLocaleString()} earned</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 border border-border text-center text-muted-foreground text-sm">
                No product data available yet.
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 className="font-serif text-2xl font-bold mb-6">Recent Sales</h2>
          {/* We'd render a chart here using Recharts if we had full component setup, 
              but since we just need the UI, let's render a stylish representation */}
          <div className="p-6 border border-border bg-background h-[300px] flex items-center justify-center flex-col gap-4 text-muted-foreground">
            <Activity className="w-8 h-8 opacity-20" />
            <p className="text-sm font-medium tracking-widest uppercase">Sales Chart Generation</p>
            <div className="flex items-end gap-2 h-32 mt-4 opacity-30">
              {dashboard?.monthlySales?.map((s, i) => (
                <div key={i} className="w-12 bg-foreground relative group" style={{ height: `${Math.max(10, (s.revenue / 100000) * 100)}%`}}>
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs hidden group-hover:block whitespace-nowrap bg-foreground text-background px-2 py-1">
                    {s.month}: ₦{s.revenue}
                  </div>
                </div>
              ))}
              {(!dashboard?.monthlySales || dashboard.monthlySales.length === 0) && (
                <div className="flex gap-2">
                  <div className="w-12 h-10 bg-foreground"></div>
                  <div className="w-12 h-20 bg-foreground"></div>
                  <div className="w-12 h-16 bg-foreground"></div>
                  <div className="w-12 h-32 bg-foreground"></div>
                  <div className="w-12 h-24 bg-foreground"></div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
