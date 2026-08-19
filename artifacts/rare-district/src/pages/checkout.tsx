import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { 
  useGetWardrobe, 
  useCreateOrder, 
  useInitiatePaystackPayment,
  useValidateCoupon, 
  getGetWardrobeQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Tag, CreditCard, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const checkoutSchema = z.object({
  shippingAddress: z.string().min(5, "Address is required"),
  shippingCity: z.string().min(2, "City is required"),
  shippingState: z.string().min(2, "State is required"),
  shippingPhone: z.string().min(8, "Phone number is required"),
  paymentMethod: z.enum(["paystack", "flutterwave"] as const),
  couponCode: z.string().optional(),
});

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  const [couponApplied, setCouponApplied] = useState<{ code: string, discount: number } | null>(null);

  const { data: wardrobeItems, isLoading } = useGetWardrobe({
    query: {
      queryKey: getGetWardrobeQueryKey(),
      retry: false
    }
  });

  const form = useForm<z.infer<typeof checkoutSchema>>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      shippingAddress: "",
      shippingCity: "",
      shippingState: "",
      shippingPhone: "",
      paymentMethod: "paystack",
      couponCode: "",
    },
  });

  const createOrderMutation = useCreateOrder();
  const initiatePaystackMutation = useInitiatePaystackPayment();
  const validateCouponMutation = useValidateCoupon();

  const items = wardrobeItems || [];
  const linePrice = (item: typeof items[number]) => (item.product?.price || 0) + (item.variant?.priceAdjustment || 0);
  const subtotal = items.reduce((acc, item) => acc + (linePrice(item) * (item.quantity || 1)), 0);
  const total = subtotal - (couponApplied?.discount || 0);

  const applyCoupon = () => {
    const code = form.getValues("couponCode");
    if (!code) return;

    validateCouponMutation.mutate({
      data: { code, orderTotal: subtotal }
    }, {
      onSuccess: (data) => {
        if (data.valid) {
          setCouponApplied({ code, discount: data.discountAmount });
          toast({ title: "Coupon Applied", description: `Discount of ₦${data.discountAmount.toLocaleString()} applied.` });
        } else {
          toast({ title: "Invalid Coupon", description: "This coupon is invalid or expired.", variant: "destructive" });
        }
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to validate coupon.", variant: "destructive" });
      }
    });
  };

  const onSubmit = (values: z.infer<typeof checkoutSchema>) => {
    if (items.length === 0) {
      toast({ title: "Wardrobe Empty", description: "Cannot place order with no items.", variant: "destructive" });
      return;
    }
    const missingVariant = items.find(item => item.product?.variants?.length && !item.variantId);
    if (missingVariant) {
      toast({ title: "Choose a variation", description: `Select a size, color, or other variation for ${missingVariant.product?.name} before checkout.`, variant: "destructive" });
      return;
    }

    createOrderMutation.mutate({
      data: {
        items: items.map(item => ({
          productId: item.productId,
          quantity: item.quantity || 1,
          variantId: item.variantId || undefined,
          selectedSize: item.selectedSize || undefined
        })),
        shippingAddress: values.shippingAddress,
        shippingCity: values.shippingCity,
        shippingState: values.shippingState,
        shippingPhone: values.shippingPhone,
        couponCode: couponApplied?.code
      }
    }, {
      onSuccess: (order) => {
        queryClient.invalidateQueries({ queryKey: getGetWardrobeQueryKey() });

          if (values.paymentMethod === "paystack") {
            if (!currentUser?.email) {
              toast({
                title: "Payment unavailable",
                description: "Your account email is required to start Paystack checkout.",
                variant: "destructive",
              });
              return;
            }

            initiatePaystackMutation.mutate({
              data: {
                orderId: order.id,
                email: currentUser.email,
                callbackUrl: `${window.location.origin}/orders/${order.id}`,
              },
            }, {
              onSuccess: (payment) => {
                window.location.assign(payment.paymentUrl);
              },
              onError: (err: any) => {
                toast({
                  title: "Paystack checkout failed",
                  description: err?.message || "Could not start Paystack checkout. Your order is still pending.",
                  variant: "destructive",
                });
              },
            });
            return;
          }

          toast({ title: "Order Placed", description: "Your order has been secured." });
          setLocation(`/orders/${order.id}`);
      },
      onError: (err: any) => {
        toast({ title: "Checkout Failed", description: err?.message || "Could not complete your order.", variant: "destructive" });
      }
    });
  };

  if (isLoading) return <div className="min-h-[50vh] flex items-center justify-center">Loading...</div>;

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <h1 className="font-serif text-3xl font-bold mb-4">Your wardrobe is empty.</h1>
        <Button onClick={() => setLocation("/shop")} variant="outline" className="rounded-none border-foreground uppercase tracking-widest text-xs">Return to Shop</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 md:py-20 max-w-6xl">
      <h1 className="font-serif text-4xl font-bold tracking-tight mb-12">Secure Checkout</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
        
        {/* Form */}
        <div className="lg:col-span-7">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-12">
              
              {/* Shipping section */}
              <div>
                <h2 className="text-sm font-bold tracking-widest uppercase mb-6 pb-2 border-b border-border">1. Shipping Details</h2>
                <div className="space-y-5">
                  <FormField
                    control={form.control}
                    name="shippingAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Address</FormLabel>
                        <FormControl>
                          <Input placeholder="Street address" {...field} className="h-12 rounded-none border-border focus-visible:ring-primary focus-visible:border-primary bg-transparent" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-5">
                    <FormField
                      control={form.control}
                      name="shippingCity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">City</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Lagos" {...field} className="h-12 rounded-none border-border focus-visible:ring-primary focus-visible:border-primary bg-transparent" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="shippingState"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">State/Province</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Lagos State" {...field} className="h-12 rounded-none border-border focus-visible:ring-primary focus-visible:border-primary bg-transparent" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="shippingPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="+234 XXX XXX XXXX" {...field} className="h-12 rounded-none border-border focus-visible:ring-primary focus-visible:border-primary bg-transparent" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <h2 className="text-sm font-bold tracking-widest uppercase mb-6 pb-2 border-b border-border">2. Payment Method</h2>
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-4"
                        >
                          <FormItem className={`flex items-center space-x-3 space-y-0 p-4 border transition-colors ${field.value === 'paystack' ? 'border-foreground bg-secondary/20' : 'border-border'}`}>
                            <FormControl>
                              <RadioGroupItem value="paystack" />
                            </FormControl>
                            <div className="flex-1 flex justify-between items-center cursor-pointer">
                              <FormLabel className="font-medium cursor-pointer w-full text-base">Paystack</FormLabel>
                              <CreditCard className="w-5 h-5 text-muted-foreground" />
                            </div>
                          </FormItem>
                          <FormItem className={`flex items-center space-x-3 space-y-0 p-4 border transition-colors ${field.value === 'flutterwave' ? 'border-foreground bg-secondary/20' : 'border-border'}`}>
                            <FormControl>
                              <RadioGroupItem value="flutterwave" />
                            </FormControl>
                            <div className="flex-1 flex justify-between items-center cursor-pointer">
                              <FormLabel className="font-medium cursor-pointer w-full text-base">Flutterwave</FormLabel>
                              <ShieldCheck className="w-5 h-5 text-muted-foreground" />
                            </div>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button 
                type="submit" 
                disabled={createOrderMutation.isPending || initiatePaystackMutation.isPending}
                className="w-full h-16 rounded-none font-bold tracking-widest uppercase text-sm group"
              >
                {createOrderMutation.isPending || initiatePaystackMutation.isPending ? "Processing..." : "Confirm & Pay"}
                {!createOrderMutation.isPending && !initiatePaystackMutation.isPending && <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />}
              </Button>

            </form>
          </Form>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-5">
          <div className="bg-secondary/30 p-8 border border-border sticky top-32">
            <h2 className="font-serif text-2xl font-bold tracking-tight mb-8">Order Summary</h2>
            
            <div className="space-y-6 mb-8 max-h-[40vh] overflow-y-auto pr-2 no-scrollbar">
              {items.map(item => (
                <div key={item.id} className="flex gap-4">
                  <div className="w-16 aspect-[3/4] bg-secondary shrink-0 overflow-hidden">
                    {item.product?.images?.[0] && <img src={item.product.images[0]} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 text-sm">
                    <p className="font-serif font-medium line-clamp-1">{item.product?.name}</p>
                    <p className="text-muted-foreground text-xs uppercase tracking-widest mb-1">{item.product?.vendor?.brandName}</p>
                     {item.variant && <p className="text-muted-foreground text-xs mb-1">{Object.entries(item.variant.attributes).map(([key, value]) => `${key}: ${value}`).join(" · ")}</p>}
                    <p className="text-muted-foreground">Qty: {item.quantity}</p>
                  </div>
                  <div className="text-right text-sm">
                     <p>₦{(linePrice(item) * (item.quantity || 1)).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-6 border-t border-border mb-6">
              <div className="flex gap-2">
                <Input 
                  placeholder="Enter code" 
                  className="rounded-none border-border bg-transparent h-10"
                  {...form.register("couponCode")}
                />
                <Button 
                  onClick={applyCoupon} 
                  type="button" 
                  variant="outline" 
                  className="rounded-none border-border uppercase tracking-widest text-xs h-10"
                  disabled={validateCouponMutation.isPending}
                >
                  Apply
                </Button>
              </div>
              {couponApplied && (
                <p className="text-xs text-primary mt-2 flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Coupon '{couponApplied.code}' applied.
                </p>
              )}
            </div>
            
            <div className="space-y-4 mb-6 pt-6 border-t border-border">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>₦ {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Shipping</span>
                <span>Free (District Member)</span>
              </div>
              {couponApplied && (
                <div className="flex justify-between items-center text-sm text-primary">
                  <span>Discount</span>
                  <span>- ₦ {couponApplied.discount.toLocaleString()}</span>
                </div>
              )}
            </div>
            
            <div className="border-t border-border pt-6">
              <div className="flex justify-between items-end">
                <span className="text-sm font-bold tracking-widest uppercase">Total</span>
                <span className="text-2xl font-serif">₦ {total.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
