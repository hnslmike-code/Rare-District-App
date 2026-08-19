import { Link, useRoute } from "wouter";
import { useEffect, useState } from "react";
import { useGetOrder } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ArrowLeft, MapPin, Truck, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ReturnShippingConversation } from "@/components/returns/ReturnShippingConversation";

export default function OrderDetail() {
  const [, params] = useRoute("/orders/:id");
  const id = Number(params?.id);
  const { toast } = useToast();
  const [returningItemId, setReturningItemId] = useState<number | null>(null);
  const [returnReason, setReturnReason] = useState("wrong_item");
  const [returnDescription, setReturnDescription] = useState("");
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [customerReturns, setCustomerReturns] = useState<any[]>([]);

  const { data: order, isLoading } = useGetOrder(id, {
    query: {
      enabled: !!id,
      queryKey: ["order", id]
    }
  });
  const loadCustomerReturns = async () => {
    const response = await fetch("/api/returns/mine", { headers: { Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` } });
    if (response.ok) setCustomerReturns(await response.json());
  };
  useEffect(() => { if (id) void loadCustomerReturns(); }, [id]);

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

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Skeleton className="w-40 h-6 mb-8" />
        <Skeleton className="w-full h-40 mb-8" />
        <Skeleton className="w-full h-96" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <h1 className="font-serif text-3xl font-bold mb-4">Order Not Found</h1>
        <p className="text-muted-foreground mb-8">We couldn't locate this order in our records.</p>
        <Link href="/orders" className="text-sm font-bold tracking-widest uppercase border-b border-primary hover:text-primary transition-colors pb-1">Return to Orders</Link>
      </div>
    );
  }

  const subtotal = order.totalAmount + (order.discountAmount || 0);
  const submitReturn = async (itemId: number) => {
    setReturnSubmitting(true);
    try {
      const response = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` },
        body: JSON.stringify({ orderId: order.id, orderItemId: itemId, reason: returnReason, description: returnDescription }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Return request failed.");
      toast({ title: "Return request submitted.", description: "The vendor has 48 hours to respond." });
      setCustomerReturns(current => [...current, result]);
      setReturningItemId(null);
      setReturnDescription("");
    } catch (error) {
      toast({ title: "Return request failed", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    } finally { setReturnSubmitting(false); }
  };

  return (
    <div className="bg-background pt-8 pb-32">
      <div className="container mx-auto px-4 md:px-6 max-w-4xl">
        
        <Link href="/orders" className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to Orders
        </Link>

        <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-8">
          <div>
            <h1 className="font-serif text-4xl font-bold tracking-tight mb-2">Order #{order.id.toString().padStart(6, '0')}</h1>
            <p className="text-muted-foreground">Placed on {format(new Date(order.createdAt), 'MMMM d, yyyy')}</p>
          </div>
          <div className={`px-4 py-2 text-sm font-bold tracking-widest uppercase border ${getStatusColor(order.status)}`}>
            {order.status}
          </div>
        </div>

        {/* Order Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div className="bg-secondary/20 p-6 border border-border">
            <div className="flex items-center gap-2 mb-4 text-sm font-bold tracking-widest uppercase border-b border-border pb-2">
              <MapPin className="w-4 h-4" /> Shipping Address
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {order.shippingAddress}<br />
              {order.shippingCity}, {order.shippingState}<br />
              {order.shippingPhone}
            </p>
          </div>
          
          <div className="bg-secondary/20 p-6 border border-border">
            <div className="flex items-center gap-2 mb-4 text-sm font-bold tracking-widest uppercase border-b border-border pb-2">
              <CreditCard className="w-4 h-4" /> Payment
            </div>
            <p className="text-sm text-muted-foreground capitalize">
              {order.paymentProcessor || 'Pending'}
            </p>
            {order.paymentReference && (
              <p className="text-xs text-muted-foreground mt-2 font-mono truncate">Ref: {order.paymentReference}</p>
            )}
          </div>

          <div className="bg-secondary/20 p-6 border border-border">
            <div className="flex items-center gap-2 mb-4 text-sm font-bold tracking-widest uppercase border-b border-border pb-2">
              <Truck className="w-4 h-4" /> Status
            </div>
            <p className="text-sm text-muted-foreground capitalize">
              {order.status === 'processing' ? 'Preparing your items' : 
               order.status === 'shipped' ? 'On the way to you' :
               order.status === 'delivered' ? 'Delivered' : 
               order.status}
            </p>
          </div>
        </div>

        {/* Items */}
        <h2 className="font-serif text-2xl font-bold mb-6">Items Ordered</h2>
        <div className="border border-border bg-background mb-12">
          {order.items?.map((item) => (
            <div key={item.id} className="flex gap-6 p-6 border-b border-border last:border-0">
              <div className="w-20 md:w-24 aspect-[3/4] bg-secondary shrink-0 overflow-hidden relative">
                {item.product?.images?.[0] ? (
                  <img src={item.product.images[0]} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">No Image</div>
                )}
              </div>
              <div className="flex-1 flex flex-col justify-between">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <Link href={`/product/${item.productId}`} className="font-serif text-lg font-medium hover:text-primary transition-colors block mb-1">
                      {item.product?.name || `Product #${item.productId}`}
                    </Link>
                    <p className="text-xs font-bold tracking-widest uppercase text-muted-foreground mb-2">
                      {item.product?.vendor?.brandName || "Unknown Vendor"}
                    </p>
                    {item.selectedSize && (
                      <p className="text-sm text-muted-foreground">Size: {item.selectedSize}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-light mb-1">₦{(item.unitPrice * item.quantity).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Qty: {item.quantity} × ₦{item.unitPrice.toLocaleString()}</p>
                    {["delivered", "shipped"].includes(order.status) && !customerReturns.some(request => request.orderItemId === item.id && !["rejected", "cancelled", "refunded"].includes(request.status)) && (
                      <button onClick={() => setReturningItemId(returningItemId === item.id ? null : item.id)} className="mt-4 text-xs font-bold uppercase tracking-widest text-muted-foreground underline">Request return</button>
                    )}
                  </div>
                </div>
                {returningItemId === item.id && (
                  <div className="mt-5 border-t border-dashed border-border pt-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Eligible reasons</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={() => setReturnReason("wrong_item")} className={`border px-3 py-2 text-xs ${returnReason === "wrong_item" ? "border-foreground bg-secondary" : "border-border"}`}>Wrong item received</button>
                      <button onClick={() => setReturnReason("damaged")} className={`border px-3 py-2 text-xs ${returnReason === "damaged" ? "border-foreground bg-secondary" : "border-border"}`}>Damaged or defective</button>
                    </div>
                    <textarea value={returnDescription} onChange={event => setReturnDescription(event.target.value)} placeholder="Tell the vendor what happened…" className="mt-3 min-h-20 w-full border border-border bg-transparent p-3 text-sm outline-none focus:border-foreground" />
                    <div className="mt-3 flex justify-end"><button onClick={() => submitReturn(item.id)} disabled={returnSubmitting} className="bg-foreground px-4 py-2 text-xs font-bold uppercase tracking-widest text-background disabled:opacity-50">{returnSubmitting ? "Submitting…" : "Submit request"}</button></div>
                  </div>
                )}
                {customerReturns.filter(request => request.orderItemId === item.id && !["rejected", "cancelled"].includes(request.status)).map(request => (
                  <ReturnShippingConversation key={request.id} returnId={request.id} role="customer" onChange={() => void loadCustomerReturns()} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="flex justify-end">
          <div className="w-full md:w-80 bg-secondary/30 p-6 border border-border">
            <div className="space-y-4 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>₦{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Shipping</span>
                <span>Free</span>
              </div>
              {order.discountAmount ? (
                <div className="flex justify-between text-sm text-primary">
                  <span>Discount</span>
                  <span>- ₦{order.discountAmount.toLocaleString()}</span>
                </div>
              ) : null}
            </div>
            <div className="border-t border-border pt-4">
              <div className="flex justify-between items-end">
                <span className="text-sm font-bold tracking-widest uppercase">Total</span>
                <span className="text-2xl font-serif">₦{order.totalAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
