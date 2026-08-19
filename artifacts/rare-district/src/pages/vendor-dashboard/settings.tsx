import { useEffect, useState } from "react";
import { useGetMyVendorProfile, useUpdateMyVendorProfile } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function VendorSettings() {
  const { data: profile, isLoading } = useGetMyVendorProfile();
  const update = useUpdateMyVendorProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ brandName: "", contactName: "", phone: "", description: "", category: "", experienceLevel: "", socialLink: "", logoUrl: "", website: "" });
  const [operations, setOperations] = useState({ shippingRegions: "", processingDays: 5, returnWindowDays: 14, returnConditions: "", cancellationPolicy: "", orderAlerts: true, lowStockAlerts: true, payoutAlerts: true });
  const [opsSaving, setOpsSaving] = useState(false);

  useEffect(() => {
    if (profile) setForm({
      brandName: profile.brandName ?? "", contactName: profile.contactName ?? "", phone: profile.phone ?? "",
      description: profile.description ?? "", category: profile.category ?? "", experienceLevel: profile.experienceLevel ?? "",
      socialLink: profile.socialLink ?? "", logoUrl: profile.logoUrl ?? "", website: profile.website ?? "",
    });
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    fetch("/api/vendors/me/operations-settings", { headers: { Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` } })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (!data) return;
        setOperations({
          shippingRegions: (data.shippingRegions ?? []).join(", "),
          processingDays: data.processingDays ?? 5,
          returnWindowDays: data.returnWindowDays ?? 14,
          returnConditions: data.returnConditions ?? "",
          cancellationPolicy: data.cancellationPolicy ?? "",
          orderAlerts: data.notificationPreferences?.orderAlerts ?? true,
          lowStockAlerts: data.notificationPreferences?.lowStockAlerts ?? true,
          payoutAlerts: data.notificationPreferences?.payoutAlerts ?? true,
        });
      }).catch(() => undefined);
  }, [profile]);

  if (isLoading) return <div className="text-sm uppercase tracking-widest text-muted-foreground">Loading profile…</div>;
  const input = "mt-1 w-full border border-border bg-background px-3 py-3 text-sm outline-none focus:border-foreground";
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    update.mutate({ data: form }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/vendors/me"] });
        toast({ title: "Profile saved." });
      },
      onError: (error: any) => toast({ title: "Profile not saved", description: error?.message ?? "Review your details.", variant: "destructive" }),
    });
  };
  const saveOperations = async () => {
    setOpsSaving(true);
    try {
      const response = await fetch("/api/vendors/me/operations-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` },
        body: JSON.stringify({
          shippingRegions: operations.shippingRegions.split(",").map(value => value.trim()).filter(Boolean),
          processingDays: operations.processingDays,
          returnWindowDays: operations.returnWindowDays,
          returnConditions: operations.returnConditions,
          cancellationPolicy: operations.cancellationPolicy,
          notificationPreferences: { orderAlerts: operations.orderAlerts, lowStockAlerts: operations.lowStockAlerts, payoutAlerts: operations.payoutAlerts },
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save operations settings.");
      toast({ title: "Operations settings saved." });
    } catch (error) {
      toast({ title: "Operations settings not saved", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    } finally {
      setOpsSaving(false);
    }
  };
  return (
    <div className="max-w-4xl space-y-8">
      <div><h1 className="font-serif text-4xl font-bold tracking-tight mb-2">Profile & Settings</h1><p className="text-muted-foreground">Keep your public atelier profile current. Payout details remain private and are not displayed here.</p></div>
      <form onSubmit={save} className="grid gap-8 md:grid-cols-2">
        <section className="space-y-5 border border-border p-6">
          <h2 className="border-b border-border pb-3 text-xs font-bold uppercase tracking-widest">Public profile</h2>
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Brand name<input required value={form.brandName} onChange={e => setForm({ ...form, brandName: e.target.value })} className={input} /></label>
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">About the atelier<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={`${input} min-h-32`} /></label>
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Logo URL<input value={form.logoUrl} onChange={e => setForm({ ...form, logoUrl: e.target.value })} className={input} /></label>
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Website<input type="url" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} className={input} /></label>
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Social link<input type="url" value={form.socialLink} onChange={e => setForm({ ...form, socialLink: e.target.value })} className={input} /></label>
        </section>
        <section className="space-y-5 border border-border p-6">
          <h2 className="border-b border-border pb-3 text-xs font-bold uppercase tracking-widest">Contact & fulfilment</h2>
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Contact name<input required value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} className={input} /></label>
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Phone<input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={input} /></label>
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Category<input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={input} /></label>
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Experience level<input value={form.experienceLevel} onChange={e => setForm({ ...form, experienceLevel: e.target.value })} className={input} /></label>
           <div className="border border-dashed border-border bg-secondary/30 p-4 text-xs text-muted-foreground">Shipping and return policies are managed in the operations section below.</div>
        </section>
         <section className="md:col-span-2 space-y-5 border border-border p-6">
           <div><h2 className="border-b border-border pb-3 text-xs font-bold uppercase tracking-widest">Shipping & returns</h2><p className="mt-2 text-xs text-muted-foreground">These settings help customers understand how your atelier fulfills orders.</p></div>
           <div className="grid gap-5 md:grid-cols-3">
             <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground md:col-span-2">Shipping regions<input value={operations.shippingRegions} onChange={e => setOperations({ ...operations, shippingRegions: e.target.value })} placeholder="Lagos, Abuja, International" className={input} /><span className="mt-1 block text-[10px] normal-case tracking-normal">Separate regions with commas.</span></label>
             <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Processing days<input type="number" min={1} max={90} value={operations.processingDays} onChange={e => setOperations({ ...operations, processingDays: Number(e.target.value) })} className={input} /></label>
             <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Return window (days)<input type="number" min={0} max={90} value={operations.returnWindowDays} onChange={e => setOperations({ ...operations, returnWindowDays: Number(e.target.value) })} className={input} /></label>
           </div>
           <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Return conditions<textarea value={operations.returnConditions} onChange={e => setOperations({ ...operations, returnConditions: e.target.value })} className={`${input} min-h-24`} placeholder="Items must be unworn with tags attached." /></label>
           <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Cancellation policy<textarea value={operations.cancellationPolicy} onChange={e => setOperations({ ...operations, cancellationPolicy: e.target.value })} className={`${input} min-h-24`} placeholder="Orders can be cancelled before dispatch." /></label>
           <div className="grid gap-3 sm:grid-cols-3">{[["orderAlerts", "New order alerts"], ["lowStockAlerts", "Low-stock alerts"], ["payoutAlerts", "Payout alerts"]].map(([key, label]) => <label key={key} className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={operations[key as keyof typeof operations] as boolean} onChange={e => setOperations({ ...operations, [key]: e.target.checked })} />{label}</label>)}</div>
           <div className="flex justify-end border-t border-border pt-4"><Button type="button" onClick={saveOperations} disabled={opsSaving} variant="outline" className="rounded-none uppercase tracking-widest">{opsSaving ? "Saving…" : "Save operations settings"}</Button></div>
         </section>
        <div className="md:col-span-2 flex justify-end border-t border-border pt-6"><Button type="submit" disabled={update.isPending} className="rounded-none px-8 uppercase tracking-widest">{update.isPending ? "Saving…" : "Save profile"}</Button></div>
      </form>
    </div>
  );
}