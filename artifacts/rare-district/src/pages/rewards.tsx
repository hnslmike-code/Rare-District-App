import { useGetMyReferralStats, useGetMyRewards, useGenerateShareLink } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Check, Gift, Users, Share2, Award } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export default function RewardsPage() {
  const { currentUser } = useAuth();
  const { data: stats, isLoading: statsLoading } = useGetMyReferralStats();
  const { data: rewards, isLoading: rewardsLoading } = useGetMyRewards();
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const copyLink = () => {
    if (stats?.referralLink) {
      navigator.clipboard.writeText(stats.referralLink);
      setCopied(true);
      toast({ title: "Copied", description: "Your referral link is copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (statsLoading) {
    return (
      <div className="container mx-auto px-4 py-24 max-w-4xl">
        <Skeleton className="h-10 w-48 mb-4" />
        <Skeleton className="h-4 w-80 mb-16" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-20" />
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    issued: "bg-green-100 text-green-800",
    redeemed: "bg-gray-100 text-gray-600",
  };

  const rewardTypeLabels: Record<string, string> = {
    referral_signup: "Referral Sign-up Bonus",
    referral_purchase: "Referral Purchase Bonus",
    share_purchase: "Share & Earn Bonus",
  };

  return (
    <div className="min-h-screen bg-background">
      <section className="py-24 border-b border-border">
        <div className="container mx-auto px-4 max-w-4xl">
          <p className="text-xs font-bold tracking-widest uppercase text-muted-foreground mb-3">Your Rewards</p>
          <h1 className="font-serif text-5xl font-bold tracking-tight mb-4">The Privilege Programme</h1>
          <p className="text-lg text-muted-foreground max-w-xl">
            Earn rewards for sharing the district. When your connections shop, you benefit.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4 max-w-4xl space-y-12">

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="rounded-none border-border shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground flex items-center gap-2">
                  <Users className="w-3.5 h-3.5" /> Referrals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-serif text-4xl font-bold">{stats?.totalReferrals ?? 0}</div>
                <p className="text-sm text-muted-foreground mt-1">{stats?.successfulReferrals ?? 0} converted</p>
              </CardContent>
            </Card>
            <Card className="rounded-none border-border shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground flex items-center gap-2">
                  <Award className="w-3.5 h-3.5" /> Rewards Earned
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-serif text-4xl font-bold">{stats?.totalRewards ?? 0}</div>
                <p className="text-sm text-muted-foreground mt-1">{stats?.pendingRewards ?? 0} pending</p>
              </CardContent>
            </Card>
            <Card className="rounded-none border-border shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold tracking-widest uppercase text-muted-foreground flex items-center gap-2">
                  <Share2 className="w-3.5 h-3.5" /> Your Code
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-serif text-2xl font-bold tracking-widest">{stats?.referralCode ?? currentUser?.referralCode ?? "—"}</div>
              </CardContent>
            </Card>
          </div>

          {/* Referral Link */}
          <div className="border border-border p-8">
            <h2 className="font-serif text-2xl font-bold mb-4">Your Referral Link</h2>
            <p className="text-muted-foreground text-sm mb-6">Share this link. When someone registers and makes their first purchase, you both receive a reward coupon.</p>
            <div className="flex gap-3 flex-col sm:flex-row">
              <div className="flex-1 border border-border px-4 py-3 text-sm font-mono bg-secondary text-muted-foreground truncate">
                {stats?.referralLink ?? `${window.location.origin}/register?ref=${currentUser?.referralCode}`}
              </div>
              <Button
                onClick={copyLink}
                variant="outline"
                className="rounded-none flex items-center gap-2"
                data-testid="copy-referral-link"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied" : "Copy Link"}
              </Button>
            </div>
          </div>

          {/* Rewards List */}
          <div>
            <h2 className="font-serif text-2xl font-bold mb-6">Reward History</h2>
            {rewardsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : rewards && rewards.length > 0 ? (
              <div className="space-y-3">
                {rewards.map(reward => (
                  <div key={reward.id} className="flex items-center justify-between border border-border p-5" data-testid={`reward-${reward.id}`}>
                    <div className="flex items-center gap-4">
                      <Gift className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="font-medium text-sm">{rewardTypeLabels[reward.type] ?? reward.type}</p>
                        {reward.couponCode && (
                          <p className="text-xs font-mono text-muted-foreground mt-0.5">Code: {reward.couponCode}</p>
                        )}
                        {reward.couponValue && (
                          <p className="text-xs text-muted-foreground mt-0.5">Value: ₦{reward.couponValue.toLocaleString()}</p>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs font-bold tracking-widest uppercase px-2 py-1 rounded ${statusColors[reward.status] ?? "bg-secondary text-muted-foreground"}`}>
                      {reward.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center border border-border">
                <Gift className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
                <p className="font-serif text-2xl text-muted-foreground mb-2">No rewards yet.</p>
                <p className="text-sm text-muted-foreground">Share your referral link to start earning.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
