import { Link } from "wouter";
import { ArrowRight, UserRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Account() {
  const { currentUser, isAuthenticated } = useAuth();

  return (
    <section className="min-h-[60vh] bg-background px-4 py-16 md:px-6 md:py-24 nebula-surface">
      <div className="container mx-auto max-w-4xl">
        <p className="mb-4 text-xs uppercase tracking-[0.3em] text-primary">Rare District / Account</p>
        <h1 className="mb-6 font-serif text-4xl font-medium tracking-tight md:text-6xl">Your district.</h1>
        {isAuthenticated ? (
          <div className="glass-panel max-w-2xl p-6 md:p-8" data-testid="panel-account-signed-in">
            <div className="mb-8 flex items-center gap-4 border-b border-border/60 pb-6">
              <div className="flex h-12 w-12 items-center justify-center bg-secondary text-primary">
                <UserRound className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Signed in as</p>
                <p className="mt-1 text-lg font-medium" data-testid="text-account-identity">{currentUser?.name || currentUser?.email}</p>
                <p className="text-sm text-muted-foreground">{currentUser?.email}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link href="/orders" className="flex items-center justify-between border border-border px-4 py-4 text-sm uppercase tracking-widest transition-colors hover:border-primary hover:text-primary" data-testid="link-account-orders">
                Orders <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/rewards" className="flex items-center justify-between border border-border px-4 py-4 text-sm uppercase tracking-widest transition-colors hover:border-primary hover:text-primary" data-testid="link-account-rewards">
                Rewards <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/wardrobe" className="flex items-center justify-between border border-border px-4 py-4 text-sm uppercase tracking-widest transition-colors hover:border-primary hover:text-primary" data-testid="link-account-wardrobe">
                Wardrobe <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="glass-panel max-w-xl p-6 md:p-8" data-testid="panel-account-signed-out">
            <p className="mb-6 text-muted-foreground">Sign in to view your orders, rewards, and saved wardrobe.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/login" className="chrome-button inline-flex items-center gap-3 px-5 py-3 text-xs font-bold uppercase tracking-widest" data-testid="link-account-sign-in">
                Sign In <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/register" className="inline-flex items-center border border-border px-5 py-3 text-xs font-bold uppercase tracking-widest transition-colors hover:border-primary hover:text-primary" data-testid="link-account-register">
                Register
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}