import { useEffect, useRef } from "react";
import { Link } from "wouter";
import { useListProducts, type Product } from "@workspace/api-client-react";
import { ArrowRight, X } from "lucide-react";

interface DistrictSidebarProps {
  open: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
  isVendor: boolean;
  isAdmin: boolean;
  currentUserName?: string | null;
  currentUserEmail?: string | null;
  onSignOut: () => void;
}

function SidebarLink({ href, children, badge }: { href: string; children: string; badge?: number | "loading" }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between border-b border-border/40 py-3 text-sm font-medium uppercase tracking-[0.14em] text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
      data-testid={`link-sidebar-${children.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
    >
      <span className="flex items-center gap-2">
        {children}
        {badge !== undefined ? (
          badge === "loading" ? (
            <span className="inline-block h-4 w-7 animate-pulse rounded-full bg-secondary" aria-label="Loading new arrivals count" />
          ) : (
            <span className="rounded-full border border-primary/35 px-1.5 py-0.5 text-[9px] leading-none text-primary" data-testid="badge-sidebar-new-in">
              {badge}
            </span>
          )
        ) : null}
      </span>
      <ArrowRight className="h-4 w-4 opacity-30" aria-hidden="true" />
    </Link>
  );
}

export function DistrictSidebar({
  open,
  onClose,
  isAuthenticated,
  isVendor,
  isAdmin,
  currentUserName,
  currentUserEmail,
  onSignOut,
}: DistrictSidebarProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { data: productsData, isLoading: productsLoading } = useListProducts(
    { sortBy: "newest", limit: 100 },
    { query: { queryKey: ["products", "mobile-sidebar-new-in"] } },
  );

  const newInCount = (productsData?.items ?? []).filter((product: Product) => {
    const createdAt = new Date(product.createdAt).getTime();
    return Number.isFinite(createdAt) && Date.now() - createdAt <= 7 * 24 * 60 * 60 * 1000 && createdAt <= Date.now();
  }).length;

  const wardrobeHref = isAuthenticated ? "/wardrobe" : "/login";
  const vendorHref = isVendor ? "/vendor-dashboard" : "/vendor-dashboard/apply";

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])"),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[55] bg-foreground/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
        data-testid="sidebar-backdrop"
      />
      <aside
        ref={drawerRef}
        className="fixed left-0 top-0 z-[60] flex h-[100dvh] w-[min(88vw,360px)] flex-col border-r border-primary/20 bg-background/95 shadow-2xl backdrop-blur-xl animate-in slide-in-from-left duration-300"
        aria-label="Rare District menu"
        aria-modal="true"
        role="dialog"
        data-testid="sidebar-district"
      >
        <div className="flex h-20 shrink-0 items-center justify-between border-b border-border px-6">
          <Link
            href="/"
            onClick={onClose}
            className="flex items-center gap-2.5 text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            data-testid="link-sidebar-brand"
          >
            <img src="/brand/rd-mark.png" alt="Rare District symbol" className="rd-mobile-mark" />
            <span className="font-serif text-base font-bold uppercase tracking-[0.16em]">Rare District</span>
          </Link>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close menu"
            data-testid="button-close-menu"
            className="rounded-sm p-2 text-foreground transition-colors hover:bg-foreground/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-6 py-6" aria-label="District menu links">
          <Link
            href="/vendor-dashboard/apply"
            onClick={onClose}
            className="mb-8 flex items-center justify-between border border-primary/50 bg-primary/10 px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80"
            data-testid="link-sidebar-sell-with-us"
          >
            Sell With Us
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>

          <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Shopping</p>
          <SidebarLink href="/shop?category=new" badge={productsLoading ? "loading" : newInCount}>New In</SidebarLink>
          <SidebarLink href="/price-drops" badge={0}>Price Drops</SidebarLink>
          <SidebarLink href="/shop?category=mens">Men's</SidebarLink>
          <SidebarLink href="/shop?category=womens">Women's</SidebarLink>
          <SidebarLink href="/shop?category=designers">Brands</SidebarLink>
          {/* TODO: Add a price-drop API field before replacing the truthful zero badge above. */}

          <p className="mb-3 mt-8 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Selling</p>
          <SidebarLink href="/how-to-sell">How To Sell?</SidebarLink>
          <SidebarLink href={vendorHref}>Vendor Hub</SidebarLink>

          <p className="mb-3 mt-8 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Account</p>
          <SidebarLink href={wardrobeHref}>Wardrobe/Favourites</SidebarLink>
          <SidebarLink href="/account">Me / Account settings</SidebarLink>

          {isAuthenticated ? (
            <>
              <p className="mb-3 mt-8 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Your district</p>
              <SidebarLink href="/orders">My Orders</SidebarLink>
              <SidebarLink href="/rewards">My Rewards</SidebarLink>
              {isVendor ? <SidebarLink href="/vendor-dashboard">Vendor Dashboard</SidebarLink> : null}
              {isAdmin ? <SidebarLink href="/admin">Admin Panel</SidebarLink> : null}
            </>
          ) : (
            <>
              <p className="mb-3 mt-8 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Sign in</p>
              <SidebarLink href="/login">Sign In</SidebarLink>
              <SidebarLink href="/register">Register</SidebarLink>
            </>
          )}
        </nav>

        {isAuthenticated ? (
          <div className="shrink-0 border-t border-border px-6 py-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-secondary font-serif text-base" aria-hidden="true">
                {(currentUserName || currentUserEmail || "?").charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="truncate text-sm font-medium" data-testid="text-sidebar-user-name">{currentUserName || currentUserEmail}</p>
                <p className="truncate text-xs text-muted-foreground" data-testid="text-sidebar-user-email">{currentUserEmail}</p>
              </div>
            </div>
            <button
              onClick={onSignOut}
              className="w-full text-left text-xs font-medium uppercase tracking-widest text-destructive transition-colors hover:text-destructive/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/70"
              data-testid="button-sidebar-sign-out"
            >
              Sign Out
            </button>
          </div>
        ) : null}
      </aside>
    </>
  );
}