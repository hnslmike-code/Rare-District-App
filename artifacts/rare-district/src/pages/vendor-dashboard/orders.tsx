import { useState } from "react";
import {
  getGetVendorRecentOrdersQueryKey,
  useGetVendorRecentOrders,
  useUpdateOrderStatus,
  type OrderStatusUpdateStatus,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronUp, ShoppingCart } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-blue-100 text-blue-800",
  processing: "bg-purple-100 text-purple-800",
  shipped: "bg-indigo-100 text-indigo-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function VendorOrders() {
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: orders, isLoading, isError } = useGetVendorRecentOrders({ limit: 50 });
  const updateStatus = useUpdateOrderStatus({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetVendorRecentOrdersQueryKey({ limit: 50 }) });
        queryClient.invalidateQueries({ queryKey: ["/api/vendors/dashboard"] });
        toast({ title: "Order status updated." });
      },
      onError: (error: any) => toast({ title: "Status update failed", description: error?.message ?? "Try again.", variant: "destructive" }),
    },
  });

  const visibleOrders = (orders ?? []).filter(order => filter === "all" || order.status === filter);
  const statusOptions = (status: string): OrderStatusUpdateStatus[] => {
    if (status === "paid") return ["processing", "cancelled"];
    if (status === "processing") return ["shipped", "cancelled"];
    if (status === "pending") return ["cancelled"];
    if (status === "shipped") return [];
    return [];
  };

  return (
    <div className="space-y-8" data-testid="vendor-orders">
      <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="font-serif text-4xl font-bold tracking-tight mb-2">Orders</h1><p className="text-muted-foreground">Fulfil the pieces assigned to your atelier.</p></div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-full sm:w-44 rounded-none"><SelectValue placeholder="Filter status" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All statuses</SelectItem>{["pending", "paid", "processing", "shipped", "delivered", "cancelled"].map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {isLoading ? <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}</div>
        : isError ? <div className="border border-destructive/40 p-8 text-center text-destructive">Orders could not be loaded. Refresh and try again.</div>
        : visibleOrders.length === 0 ? <div className="border border-border py-20 text-center text-muted-foreground"><ShoppingCart className="mx-auto mb-4 h-10 w-10" /><p className="font-serif text-2xl">No orders in this view.</p></div>
        : <div className="space-y-3">
          {visibleOrders.map(order => {
            const isExpanded = expanded === order.id;
            const options = statusOptions(order.status);
            const items = order.items ?? [];
            const vendorTotal = items.reduce((sum, item) => sum + item.vendorAmount, 0);
            return <div key={order.id} className="border border-border bg-background">
              <button onClick={() => setExpanded(isExpanded ? null : order.id)} className="flex w-full items-center gap-4 p-4 text-left hover:bg-secondary/20 md:p-5">
                <div className="flex-1"><p className="font-medium">Order #{order.id}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })} · {order.shippingCity}</p></div>
                <div className="hidden text-right sm:block"><p className="font-serif">₦{vendorTotal.toLocaleString()}</p><p className="text-xs text-muted-foreground">{items.length} line item{items.length === 1 ? "" : "s"}</p></div>
                <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${statusColors[order.status] ?? "bg-secondary"}`}>{order.status}</span>
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {isExpanded && <div className="border-t border-border p-4 md:p-5">
                <div className="mb-5 grid gap-2 text-sm sm:grid-cols-2"><p><span className="text-muted-foreground">Ship to:</span> {order.shippingAddress}, {order.shippingCity}</p><p><span className="text-muted-foreground">Phone:</span> {order.shippingPhone}</p></div>
                <div className="space-y-3">{items.map(item => <div key={item.id} className="flex items-center gap-3 border-t border-border pt-3"><div className="h-14 w-12 overflow-hidden bg-secondary">{item.product?.images?.[0] && <img src={item.product.images[0]} alt="" className="h-full w-full object-cover" />}</div><div className="flex-1"><p className="text-sm font-medium">{item.product?.name ?? `Product #${item.productId}`}</p><p className="text-xs text-muted-foreground">Qty {item.quantity}{item.selectedSize ? ` · Size ${item.selectedSize}` : ""}</p></div><p className="font-serif">₦{item.vendorAmount.toLocaleString()}</p></div>)}</div>
                {options.length > 0 && <div className="mt-5 flex items-center justify-between border-t border-border pt-4"><p className="text-xs text-muted-foreground">Move this order to the next fulfilment step.</p><Select onValueChange={value => updateStatus.mutate({ id: order.id, data: { status: value as OrderStatusUpdateStatus } })} disabled={updateStatus.isPending}><SelectTrigger className="w-44 rounded-none"><SelectValue placeholder="Update status" /></SelectTrigger><SelectContent>{options.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div>}
              </div>}
            </div>;
          })}
        </div>}
    </div>
  );
}