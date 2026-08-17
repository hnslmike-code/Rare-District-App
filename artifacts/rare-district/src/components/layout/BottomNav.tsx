import { House, ShoppingBag, DoorOpen, Tag, UserRound } from "lucide-react";
import { Link, useLocation } from "wouter";

interface BottomNavProps {
  isAuthenticated: boolean;
  isVendor: boolean;
  wardrobeCount: number;
}

export function BottomNav({ isAuthenticated, isVendor, wardrobeCount }: BottomNavProps) {
  const [location] = useLocation();
  const wardrobeHref = isAuthenticated ? "/wardrobe" : "/login";
  const vendorHref = isVendor ? "/vendor-dashboard" : "/vendor-dashboard/apply";
  const accountHref = isAuthenticated ? "/account" : "/login";

  const items = [
    { label: "Shop", href: "/", icon: House, testId: "link-bottom-shop" },
    { label: "Wardrobe", href: wardrobeHref, icon: ShoppingBag, count: wardrobeCount, testId: "link-bottom-wardrobe" },
    { label: "Showroom", href: "/shop?category=editorial", icon: DoorOpen, testId: "link-bottom-showroom" },
    { label: "Vendor Hub", href: vendorHref, icon: Tag, testId: "link-bottom-vendor-hub" },
    { label: "Me", href: accountHref, icon: UserRound, testId: "link-bottom-account" },
  ];

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    if (href === "/shop?category=editorial") {
      return location === "/shop" && window.location.search.includes("category=editorial");
    }
    return location === href || location.startsWith(`${href}/`);
  };

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-3 bottom-3 z-40 md:hidden rounded-sm border border-primary/25 bg-background/75 px-1.5 py-2 shadow-[0_14px_42px_hsl(228_35%_2%_/_0.55)] backdrop-blur-2xl backdrop-saturate-150"
      data-testid="nav-mobile-bottom"
    >
      <div className="grid grid-cols-5">
        {items.map(({ label, href, icon: Icon, count, testId }) => {
          const active = isActive(href);
          return (
            <Link
              key={label}
              href={href}
              aria-label={count ? `${label}, ${count} saved` : label}
              aria-current={active ? "page" : undefined}
              data-testid={testId}
              className={`relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-sm px-1 text-[9px] font-medium uppercase tracking-[0.12em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 ${
                active
                  ? "text-primary drop-shadow-[0_0_10px_hsl(41_61%_59%_/_0.45)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="relative">
                <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 1.8 : 1.45} aria-hidden="true" />
                {count ? (
                  <span
                    className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground"
                    data-testid="badge-bottom-wardrobe-count"
                  >
                    {count}
                  </span>
                ) : null}
              </span>
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}