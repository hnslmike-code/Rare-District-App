import { useGetAdminStats } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Store, Package, ShoppingCart, Activity } from "lucide-react";

export default function AdminDashboard() {
  const { data: stats, isLoading } = useGetAdminStats();

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-4xl font-bold tracking-tight mb-2">Platform Overview</h1>
        <p className="text-muted-foreground">Admin command center for Rare District.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="rounded-none border-border shadow-none bg-background">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Total Revenue</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-serif text-3xl font-medium">₦{stats?.totalRevenue?.toLocaleString() || 0}</div>
            <p className="text-xs text-primary mt-1 font-medium tracking-widest uppercase">Platform Commission: ₦{stats?.platformCommission?.toLocaleString() || 0}</p>
          </CardContent>
        </Card>
        
        <Card className="rounded-none border-border shadow-none bg-background">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Total Orders</CardTitle>
            <ShoppingCart className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-serif text-3xl font-medium">{stats?.totalOrders || 0}</div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-border shadow-none bg-background">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Vendors</CardTitle>
            <Store className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-serif text-3xl font-medium">{stats?.totalVendors || 0}</div>
            <div className="flex gap-2 mt-1">
              <p className="text-xs text-muted-foreground">{stats?.approvedVendors || 0} approved</p>
              {stats?.pendingVendors ? (
                <span className="text-xs text-yellow-600 bg-yellow-500/10 px-1 rounded">{stats.pendingVendors} pending</span>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-border shadow-none bg-background">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Users</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-serif text-3xl font-medium">{stats?.totalUsers || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Add more admin details here like pending vendors list or recent global orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-8 border-t border-border">
        <div>
          <h2 className="font-serif text-2xl font-bold mb-6">Recent Platform Orders</h2>
          <div className="space-y-4">
            {stats?.recentOrders && stats.recentOrders.length > 0 ? (
              stats.recentOrders.slice(0, 5).map(order => (
                <div key={order.id} className="flex justify-between items-center p-4 border border-border bg-background">
                  <div>
                    <p className="font-bold text-sm tracking-widest uppercase mb-1">Order #{order.id}</p>
                    <p className="text-xs text-muted-foreground">{order.status}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-serif text-lg">₦{order.totalAmount.toLocaleString()}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 border border-border text-center text-muted-foreground text-sm">
                No recent orders.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
