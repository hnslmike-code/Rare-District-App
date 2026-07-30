import { Link, useLocation } from "wouter";
import { useListOrders } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ArrowRight, Package } from "lucide-react";

export default function Orders() {
  const [, setLocation] = useLocation();
  const { data: ordersData, isLoading } = useListOrders({
    query: {
      queryKey: ["orders", 1], // For now just page 1
    },
    limit: 50
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'paid': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'processing': return 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20';
      case 'shipped': return 'bg-primary/10 text-primary border-primary/20';
      case 'delivered': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'cancelled': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-secondary text-muted-foreground border-border';
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 md:py-20 max-w-5xl">
      <h1 className="font-serif text-4xl font-bold tracking-tight mb-4">My Orders</h1>
      <p className="text-muted-foreground mb-12">Track and manage your acquisitions from the district.</p>

      {isLoading ? (
        <div className="space-y-6">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="w-full h-32 bg-secondary/50 rounded-none" />
          ))}
        </div>
      ) : !ordersData?.items || ordersData.items.length === 0 ? (
        <div className="py-24 text-center border border-border bg-secondary/10">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h2 className="font-serif text-2xl font-bold mb-4">No order history found.</h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-8">You haven't made any purchases yet. Your wardrobe is waiting to be curated.</p>
          <Button onClick={() => setLocation("/shop")} variant="outline" className="rounded-none border-foreground uppercase tracking-widest text-xs h-12 px-8">
            Shop The Collection
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {ordersData.items.map((order) => (
            <div key={order.id} className="border border-border bg-background p-6 hover:border-foreground/50 transition-colors">
              <div className="flex flex-col md:flex-row gap-6 md:items-center justify-between mb-6 border-b border-border pb-6">
                <div>
                  <p className="text-xs font-bold tracking-widest uppercase text-muted-foreground mb-1">Order #{order.id.toString().padStart(6, '0')}</p>
                  <p className="font-serif text-xl">{format(new Date(order.createdAt), 'MMMM d, yyyy')}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className={`px-3 py-1 text-xs font-bold tracking-widest uppercase border ${getStatusColor(order.status)}`}>
                    {order.status}
                  </div>
                  <p className="font-serif text-xl">₦{order.totalAmount.toLocaleString()}</p>
                </div>
              </div>
              
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div className="flex -space-x-4">
                  {order.items?.slice(0, 5).map((item, i) => (
                    <div key={i} className="w-16 h-16 border-2 border-background bg-secondary overflow-hidden shrink-0 z-10 relative">
                      {item.product?.images?.[0] ? (
                        <img src={item.product.images[0]} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground bg-secondary/50">No img</div>
                      )}
                    </div>
                  ))}
                  {(order.items?.length || 0) > 5 && (
                    <div className="w-16 h-16 border-2 border-background bg-foreground text-background flex items-center justify-center text-xs font-bold z-20 relative">
                      +{(order.items?.length || 0) - 5}
                    </div>
                  )}
                </div>
                
                <Link href={`/orders/${order.id}`} className="text-sm font-bold tracking-widest uppercase hover:text-primary transition-colors flex items-center gap-2 group">
                  View Details <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
