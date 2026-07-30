import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Settings,
  LogOut,
  ChevronLeft,
  Store
} from "lucide-react";

export function DashboardLayout({ children, isAdmin = false }: { children: React.ReactNode, isAdmin?: boolean }) {
  const { logout, currentUser } = useAuth();
  const [location, setLocation] = useLocation();

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
    { href: "/admin/vendors", label: "Vendors", icon: Store },
    { href: "/admin/products", label: "Products", icon: Package },
    { href: "/admin/orders", label: "All Orders", icon: ShoppingCart },
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ];

  const links = isAdmin ? adminLinks : vendorLinks;

  return (
    <div className="min-h-[100dvh] flex bg-muted/30">
      {/* Sidebar */}
      <aside className="w-64 bg-background border-r border-border flex flex-col hidden md:flex sticky top-0 h-[100dvh]">
        <div className="p-6 border-b border-border">
          <Link href="/" className="font-serif text-xl font-bold tracking-widest uppercase text-foreground hover:text-primary transition-colors flex items-center gap-2">
            <ChevronLeft className="w-4 h-4" />
            Storefront
          </Link>
        </div>
        <div className="p-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            {isAdmin ? 'Admin Panel' : 'Vendor Dashboard'}
          </p>
          <nav className="space-y-2">
            {links.map((link) => {
              const isActive = location === link.href || (location.startsWith(link.href) && link.href !== '/admin' && link.href !== '/vendor-dashboard');
              const Icon = link.icon;
              return (
                <Link 
                  key={link.href} 
                  href={link.href}
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                    isActive 
                      ? 'bg-primary text-primary-foreground shadow-sm' 
                      : 'text-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4" strokeWidth={isActive ? 2 : 1.5} />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="mt-auto p-6 border-t border-border">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-secondary flex items-center justify-center font-serif text-lg">
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
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 max-w-6xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
