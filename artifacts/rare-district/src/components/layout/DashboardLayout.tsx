import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Settings,
  LogOut,
  ChevronLeft,
  Store,
  CreditCard,
  Tag,
  Image,
  Activity,
  Menu,
  X,
} from "lucide-react";

export function DashboardLayout({
  children,
  isAdmin = false,
}: {
  children: React.ReactNode;
  isAdmin?: boolean;
}) {
  const { logout, currentUser } = useAuth();
  const [location, setLocation] = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  const vendorLinks = [
    { href: "/vendor-dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/vendor-dashboard/products", label: "Products", icon: Package },
    { href: "/vendor-dashboard/orders", label: "Orders", icon: ShoppingCart },
  ];

  const adminLinks = [
    { href: "/admin", label: "Platform Overview", icon: LayoutDashboard },
    { href: "/admin/merchandising", label: "Merchandising", icon: Image },
    { href: "/admin/operations", label: "Operations", icon: Activity },
    { href: "/admin/vendors", label: "Vendors", icon: Store },
    { href: "/admin/products", label: "Products", icon: Package },
    { href: "/admin/orders", label: "All Orders", icon: ShoppingCart },
    { href: "/admin/transactions", label: "Transactions", icon: CreditCard },
    { href: "/admin/coupons", label: "Coupons", icon: Tag },
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ];

  const links = isAdmin ? adminLinks : vendorLinks;

  const isActive = (href: string) => {
    if (href === "/admin" || href === "/vendor-dashboard") {
      return location === href;
    }
    return location.startsWith(href);
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full nebula-surface">
      {/* Logo */}
      <div className="p-6 border-b border-border/70 flex items-center justify-between">
        <Link
          href="/"
          className="font-serif text-xl font-bold tracking-widest uppercase text-foreground hover:text-primary transition-colors flex items-center gap-2"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <ChevronLeft className="w-4 h-4" />
          Storefront
        </Link>
        <button
          className="md:hidden text-muted-foreground hover:text-foreground"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <div className="flex-1 p-6 overflow-y-auto">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.2em] mb-4">
          {isAdmin ? "Admin Panel" : "Vendor Dashboard"}
        </p>
        <nav className="space-y-1">
          {links.map((link) => {
            const active = isActive(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileSidebarOpen(false)}
               className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors border-l-2 ${
                  active
                     ? "bg-primary/12 text-primary border-primary"
                     : "text-foreground border-transparent hover:bg-secondary hover:text-primary"
                }`}
                data-testid={`link-dashboard-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={active ? 2 : 1.5} />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User + Logout */}
      <div className="p-6 border-t border-border">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-secondary flex items-center justify-center font-serif text-lg flex-shrink-0">
            {currentUser?.name?.charAt(0) || currentUser?.email?.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-medium truncate">{currentUser?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{currentUser?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 w-full transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] flex bg-background">
      {/* ── Desktop Sidebar ── */}
       <aside className="w-64 bg-[hsl(229_25%_6%)] border-r border-border/70 hidden md:flex flex-col sticky top-0 h-[100dvh]">
        <SidebarContent />
      </aside>

      {/* ── Mobile Sidebar Overlay ── */}
      {mobileSidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-foreground/50 backdrop-blur-sm md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside className="fixed top-0 left-0 h-full w-72 bg-background z-50 flex flex-col shadow-2xl md:hidden">
            <SidebarContent />
          </aside>
        </>
      )}

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
         <div className="md:hidden flex items-center gap-4 px-4 h-16 bg-background/90 backdrop-blur-xl border-b border-border sticky top-0 z-30">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="text-foreground hover:text-primary transition-colors"
            aria-label="Open sidebar"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-serif text-lg font-bold tracking-widest uppercase">
            {isAdmin ? "Admin Panel" : "Vendor Dashboard"}
          </span>
        </div>

        <main className="flex-1 p-4 md:p-10 max-w-6xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
