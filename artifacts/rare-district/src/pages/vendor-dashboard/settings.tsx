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

  useEffect(() => {
    if (profile) setForm({
      brandName: profile.brandName ?? "", contactName: profile.contactName ?? "", phone: profile.phone ?? "",
      description: profile.description ?? "", category: profile.category ?? "", experienceLevel: profile.experienceLevel ?? "",
      socialLink: profile.socialLink ?? "", logoUrl: profile.logoUrl ?? "", website: profile.website ?? "",
    });
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
          <div className="border border-dashed border-border bg-secondary/30 p-4 text-xs text-muted-foreground">Shipping, returns, and payout lifecycle controls are intentionally kept separate from the public profile and are pending the next operations schema migration.</div>
        </section>
        <div className="md:col-span-2 flex justify-end border-t border-border pt-6"><Button type="submit" disabled={update.isPending} className="rounded-none px-8 uppercase tracking-widest">{update.isPending ? "Saving…" : "Save profile"}</Button></div>
      </form>
    </div>
  );
}