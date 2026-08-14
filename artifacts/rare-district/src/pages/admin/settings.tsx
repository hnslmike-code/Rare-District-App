import { useState, useEffect } from "react";
import { useGetAdminSettings, useUpdateAdminSettings, getGetAdminSettingsQueryKey, type AdminSettingsUpdateReferralRewardType, type AdminSettingsUpdateShareRewardType } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Settings } from "lucide-react";

export default function AdminSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: settings, isLoading } = useGetAdminSettings({ query: { queryKey: getGetAdminSettingsQueryKey() } });
  const updateSettings = useUpdateAdminSettings({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAdminSettingsQueryKey() });
        toast({ title: "Settings saved." });
      }
    }
  });

  const [form, setForm] = useState({
    defaultCommissionRate: "5",
    referralRewardType: "fixed" as AdminSettingsUpdateReferralRewardType,
    referralRewardValue: "500",
    shareRewardType: "fixed" as AdminSettingsUpdateShareRewardType,
    shareRewardValue: "250",
  });

  useEffect(() => {
    if (settings) {
      setForm({
        defaultCommissionRate: String(settings.defaultCommissionRate),
         referralRewardType: (settings.referralRewardType ?? "fixed") as AdminSettingsUpdateReferralRewardType,
        referralRewardValue: String(settings.referralRewardValue),
         shareRewardType: (settings.shareRewardType ?? "fixed") as AdminSettingsUpdateShareRewardType,
        shareRewardValue: String(settings.shareRewardValue),
      });
    }
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings.mutate({
      data: {
        defaultCommissionRate: Number(form.defaultCommissionRate),
        referralRewardType: form.referralRewardType,
        referralRewardValue: Number(form.referralRewardValue),
        shareRewardType: form.shareRewardType,
        shareRewardValue: Number(form.shareRewardValue),
      }
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-48" />
        <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="admin-settings">
      <div>
        <h1 className="font-serif text-4xl font-bold tracking-tight mb-2">Platform Settings</h1>
        <p className="text-muted-foreground">Configure commissions and rewards for Rare District.</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-xl space-y-8">
        {/* Commission */}
        <div className="border border-border p-6 space-y-4">
          <h2 className="font-serif text-xl font-bold">Commission</h2>
          <div className="space-y-2">
            <Label className="text-xs font-bold tracking-widest uppercase">Default Commission Rate (%)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={form.defaultCommissionRate}
              onChange={e => setForm(f => ({ ...f, defaultCommissionRate: e.target.value }))}
              className="rounded-none"
              data-testid="commission-rate-input"
            />
            <p className="text-xs text-muted-foreground">Percentage of each sale taken as platform commission. Vendors receive the remainder.</p>
          </div>
        </div>

        {/* Referral Rewards */}
        <div className="border border-border p-6 space-y-4">
          <h2 className="font-serif text-xl font-bold">Referral Rewards</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold tracking-widest uppercase">Type</Label>
               <Select value={form.referralRewardType} onValueChange={v => setForm(f => ({ ...f, referralRewardType: v as AdminSettingsUpdateReferralRewardType }))}>
                <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed (₦)</SelectItem>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold tracking-widest uppercase">Value</Label>
              <Input
                type="number"
                min="0"
                value={form.referralRewardValue}
                onChange={e => setForm(f => ({ ...f, referralRewardValue: e.target.value }))}
                className="rounded-none"
              />
            </div>
          </div>
        </div>

        {/* Share Rewards */}
        <div className="border border-border p-6 space-y-4">
          <h2 className="font-serif text-xl font-bold">Share & Earn Rewards</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold tracking-widest uppercase">Type</Label>
               <Select value={form.shareRewardType} onValueChange={v => setForm(f => ({ ...f, shareRewardType: v as AdminSettingsUpdateShareRewardType }))}>
                <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed (₦)</SelectItem>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold tracking-widest uppercase">Value</Label>
              <Input
                type="number"
                min="0"
                value={form.shareRewardValue}
                onChange={e => setForm(f => ({ ...f, shareRewardValue: e.target.value }))}
                className="rounded-none"
              />
            </div>
          </div>
        </div>

        <Button type="submit" className="rounded-none bg-foreground text-background hover:bg-foreground/90 w-full" disabled={updateSettings.isPending} data-testid="save-settings-btn">
          {updateSettings.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </form>
    </div>
  );
}
