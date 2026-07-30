import { useListAdminOrders, useUpdateOrderStatus, getListAdminOrdersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-blue-100 text-blue-800",
  processing: "bg-purple-100 text-purple-800",
  shipped: "bg-indigo-100 text-indigo-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function AdminOrders() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: orders, isLoading } = useListAdminOrders({}, {
    query: { queryKey: getListAdminOrdersQueryKey() }
  });

  const updateStatus = useUpdateOrderStatus({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminOrdersQueryKey() });
        toast({ title: "Order status updated." });
      }
    }
  });

  const statusOptions = ["pending", "paid", "processing", "shipped", "delivered", "cancelled"];

  return (
    <div className="space-y-8" data-testid="admin-orders">
      <div>
        <h1 className="font-serif text-4xl font-bold tracking-tight mb-2">All Orders</h1>
        <p className="text-muted-foreground">Platform-wide order management.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : orders && orders.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-bold tracking-widest uppercase text-xs text-muted-foreground">Order</th>
                <th className="text-left py-3 px-4 font-bold tracking-widest uppercase text-xs text-muted-foreground">City</th>
                <th className="text-left py-3 px-4 font-bold tracking-widest uppercase text-xs text-muted-foreground">Total</th>
                <th className="text-left py-3 px-4 font-bold tracking-widest uppercase text-xs text-muted-foreground">Payment</th>
                <th className="text-left py-3 px-4 font-bold tracking-widest uppercase text-xs text-muted-foreground">Date</th>
                <th className="text-left py-3 px-4 font-bold tracking-widest uppercase text-xs text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id} className="border-b border-border hover:bg-secondary/30" data-testid={`admin-order-${order.id}`}>
                  <td className="py-4 px-4 font-medium">#{order.id}</td>
                  <td className="py-4 px-4 text-muted-foreground">{order.shippingCity}</td>
                  <td className="py-4 px-4 font-serif font-medium">₦{order.totalAmount.toLocaleString()}</td>
                  <td className="py-4 px-4 capitalize text-muted-foreground">{order.paymentProcessor ?? "—"}</td>
                  <td className="py-4 px-4 text-muted-foreground">{new Date(order.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td className="py-4 px-4">
                    <Select
                      value={order.status}
                      onValueChange={(v) => updateStatus.mutate({ id: order.id, data: { status: v } })}
                    >
                      <SelectTrigger className={`w-36 h-7 text-xs rounded-none border-none shadow-none font-bold tracking-widest uppercase ${statusColors[order.status] ?? "bg-secondary"}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map(s => (
                          <SelectItem key={s} value={s} className="text-xs uppercase tracking-widest">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-20 border border-border text-center text-muted-foreground">
          <ShoppingCart className="w-10 h-10 mx-auto mb-4" />
          <p className="font-serif text-2xl mb-2">No orders yet.</p>
        </div>
      )}
    </div>
  );
}
