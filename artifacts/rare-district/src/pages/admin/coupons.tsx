import { useState } from "react";
import { useListCoupons, useCreateCoupon, useUpdateCoupon, useDeleteCoupon, getListCouponsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Ticket, Plus, Trash2, X } from "lucide-react";

export default function AdminCoupons() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: "", type: "percentage", value: "", minOrderAmount: "", maxUses: "", expiresAt: "" });

  const { data: coupons, isLoading } = useListCoupons({ query: { queryKey: getListCouponsQueryKey() } });
  const createCoupon = useCreateCoupon({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCouponsQueryKey() });
        setShowForm(false);
        setForm({ code: "", type: "percentage", value: "", minOrderAmount: "", maxUses: "", expiresAt: "" });
        toast({ title: "Coupon created." });
      }
    }
  });
  const deleteCoupon = useDeleteCoupon({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCouponsQueryKey() });
        toast({ title: "Coupon deleted." });
      }
    }
  });
  const updateCoupon = useUpdateCoupon({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCouponsQueryKey() });
        toast({ title: "Coupon updated." });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCoupon.mutate({
      data: {
        code: form.code.toUpperCase(),
        type: form.type as "percentage" | "fixed",
        value: Number(form.value),
        minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : undefined,
        maxUses: form.maxUses ? Number(form.maxUses) : undefined,
        expiresAt: form.expiresAt || undefined,
      }
    });
  };

  return (
    <div className="space-y-8" data-testid="admin-coupons">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-4xl font-bold tracking-tight mb-2">Coupons</h1>
          <p className="text-muted-foreground">Manage discount codes and promotional offers.</p>
        </div>
        <Button
          className="rounded-none bg-foreground text-background hover:bg-foreground/90"
          onClick={() => setShowForm(v => !v)}
          data-testid="create-coupon-btn"
        >
          {showForm ? <><X className="w-4 h-4 mr-2" /> Cancel</> : <><Plus className="w-4 h-4 mr-2" /> New Coupon</>}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="border border-border p-6 space-y-4" data-testid="coupon-form">
          <h2 className="font-serif text-xl font-bold">New Coupon</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold tracking-widest uppercase">Code</Label>
              <Input required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="e.g. SUMMER20" className="rounded-none" data-testid="coupon-code-input" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold tracking-widest uppercase">Type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed Amount (₦)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold tracking-widest uppercase">Value</Label>
              <Input required type="number" min="0" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder={form.type === "percentage" ? "10 (%)" : "5000 (₦)"} className="rounded-none" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold tracking-widest uppercase">Min Order (₦)</Label>
              <Input type="number" min="0" value={form.minOrderAmount} onChange={e => setForm(f => ({ ...f, minOrderAmount: e.target.value }))} placeholder="Optional" className="rounded-none" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold tracking-widest uppercase">Max Uses</Label>
              <Input type="number" min="1" value={form.maxUses} onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))} placeholder="Unlimited" className="rounded-none" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold tracking-widest uppercase">Expires At</Label>
              <Input type="datetime-local" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} className="rounded-none" />
            </div>
          </div>
          <Button type="submit" className="rounded-none bg-foreground text-background hover:bg-foreground/90" disabled={createCoupon.isPending} data-testid="submit-coupon-btn">
            {createCoupon.isPending ? "Creating..." : "Create Coupon"}
          </Button>
        </form>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
      ) : coupons && coupons.length > 0 ? (
        <div className="space-y-3">
          {coupons.map(coupon => (
            <div key={coupon.id} className="border border-border p-5 flex items-center justify-between" data-testid={`coupon-${coupon.id}`}>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-mono font-bold text-base tracking-widest">{coupon.code}</span>
                  <span className={`text-xs font-bold tracking-widest uppercase px-1.5 py-0.5 rounded ${coupon.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {coupon.isActive ? "Active" : "Inactive"}
                  </span>
                  {coupon.isReferral && <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold uppercase">Referral</span>}
                </div>
                <p className="text-sm text-muted-foreground">
                  {coupon.type === "percentage" ? `${coupon.value}% off` : `₦${Number(coupon.value).toLocaleString()} off`}
                  {coupon.minOrderAmount ? ` · Min ₦${Number(coupon.minOrderAmount).toLocaleString()}` : ""}
                  {coupon.maxUses ? ` · ${coupon.usedCount}/${coupon.maxUses} used` : ` · ${coupon.usedCount} uses`}
                  {coupon.expiresAt ? ` · Expires ${new Date(coupon.expiresAt).toLocaleDateString()}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-none h-8"
                  onClick={() => updateCoupon.mutate({ id: coupon.id, data: { isActive: !coupon.isActive } })}
                  disabled={updateCoupon.isPending}
                >
                  {coupon.isActive ? "Deactivate" : "Activate"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                  onClick={() => { if (window.confirm("Delete this coupon?")) deleteCoupon.mutate({ id: coupon.id }); }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-20 border border-border text-center text-muted-foreground">
          <Ticket className="w-10 h-10 mx-auto mb-4" />
          <p className="font-serif text-2xl mb-2">No coupons yet.</p>
        </div>
      )}
    </div>
  );
}
