import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Search, ShoppingBag, User as UserIcon, Menu } from "lucide-react";
import { useGetWardrobe } from "@workspace/api-client-react";

export function MainLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, currentUser, logout } = useAuth();
  const [, setLocation] = useLocation();

  // Guard query carefully - if it fails for unauthenticated users, it's fine, we disable it.
  const { data: wardrobe } = useGetWardrobe({
    query: {
      enabled: isAuthenticated,
      queryKey: ["wardrobe"]
    }
  });

  const wardrobeCount = wardrobe?.items?.length || 0;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-primary/20">
      <header className="sticky top-0 z-50 w-full bg-background/90 backdrop-blur-md border-b border-border/50 transition-all duration-300">
        <div className="container mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button className="md:hidden text-foreground hover:text-primary transition-colors">
              <Menu className="w-6 h-6" />
            </button>
            <Link href="/" className="font-serif text-2xl md:text-3xl font-bold tracking-widest uppercase text-foreground hover:text-primary transition-colors">
              Rare District
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm uppercase tracking-widest font-medium">
            <Link href="/shop" className="text-foreground hover:text-primary transition-colors">Shop</Link>
            <Link href="/shop?category=new" className="text-foreground hover:text-primary transition-colors">New Arrivals</Link>
            <Link href="/shop?category=designers" className="text-foreground hover:text-primary transition-colors">Designers</Link>
            <Link href="/shop?category=editorial" className="text-foreground hover:text-primary transition-colors">Editorial</Link>
          </nav>

          <div className="flex items-center gap-5">
            <button className="text-foreground hover:text-primary transition-colors">
              <Search className="w-5 h-5" strokeWidth={1.5} />
            </button>
            
            {isAuthenticated ? (
              <>
                <Link href="/wardrobe" className="relative text-foreground hover:text-primary transition-colors">
                  <ShoppingBag className="w-5 h-5" strokeWidth={1.5} />
                  {wardrobeCount > 0 && (
                    <span className="absolute -top-2 -right-2 w-4 h-4 flex items-center justify-center bg-primary text-primary-foreground text-[10px] font-bold rounded-full">
                      {wardrobeCount}
                    </span>
                  )}
                </Link>
                <div className="group relative">
                  <button className="text-foreground hover:text-primary transition-colors flex items-center gap-2">
                    <UserIcon className="w-5 h-5" strokeWidth={1.5} />
                  </button>
                  <div className="absolute right-0 top-full pt-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-48 z-50">
                    <div className="bg-background border border-border p-2 shadow-xl flex flex-col">
                      <div className="px-4 py-2 border-b border-border/50 mb-2">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Signed in as</p>
                        <p className="text-sm font-medium truncate">{currentUser?.name || currentUser?.email}</p>
                      </div>
                      <Link href="/orders" className="px-4 py-2 text-sm hover:bg-secondary transition-colors">My Orders</Link>
                      <Link href="/rewards" className="px-4 py-2 text-sm hover:bg-secondary transition-colors">My Rewards</Link>
                      {currentUser?.role === 'vendor' && (
                        <Link href="/vendor-dashboard" className="px-4 py-2 text-sm hover:bg-secondary transition-colors">Vendor Dashboard</Link>
                      )}
                      {currentUser?.role === 'admin' && (
                        <Link href="/admin" className="px-4 py-2 text-sm hover:bg-secondary transition-colors text-primary">Admin Panel</Link>
                      )}
                      <button 
                        onClick={() => { logout(); setLocation("/"); }}
                        className="px-4 py-2 text-sm hover:bg-secondary transition-colors text-left text-destructive mt-2"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <Link href="/login" className="text-sm uppercase tracking-widest font-medium hover:text-primary transition-colors">
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="bg-foreground text-background py-16 md:py-24 mt-auto">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="md:col-span-2">
              <h2 className="font-serif text-3xl font-bold tracking-widest uppercase mb-6">Rare District</h2>
              <p className="text-muted text-sm max-w-sm leading-relaxed">
                Curating the absolute vanguard of contemporary Nigerian fashion. A private district for the discerning eye.
              </p>
            </div>
            <div>
              <h3 className="font-serif text-lg mb-6 text-primary-foreground">The District</h3>
              <ul className="space-y-4 text-sm text-muted">
                <li><Link href="/shop" className="hover:text-primary transition-colors">Shop All</Link></li>
                <li><Link href="/shop?category=designers" className="hover:text-primary transition-colors">Designers</Link></li>
                <li><Link href="/vendor-dashboard/apply" className="hover:text-primary transition-colors">Become a Vendor</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-serif text-lg mb-6 text-primary-foreground">Assistance</h3>
              <ul className="space-y-4 text-sm text-muted">
                <li><button className="hover:text-primary transition-colors">Contact Us</button></li>
                <li><button className="hover:text-primary transition-colors">Shipping & Returns</button></li>
                <li><button className="hover:text-primary transition-colors">Terms of Service</button></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-background/20 mt-16 pt-8 flex flex-col md:flex-row items-center justify-between text-xs text-muted">
            <p>&copy; {new Date().getFullYear()} Rare District. All rights reserved.</p>
            <div className="flex gap-4 mt-4 md:mt-0">
              <span>Lagos</span>
              <span>•</span>
              <span>London</span>
              <span>•</span>
              <span>New York</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
