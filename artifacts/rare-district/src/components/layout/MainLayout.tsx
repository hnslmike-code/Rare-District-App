import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Search, ShoppingBag, User as UserIcon, Menu, X, ArrowRight } from "lucide-react";
import { useGetWardrobe } from "@workspace/api-client-react";
import { CursorGlow } from "@/components/visuals/CursorGlow";

const NAV_LINKS = [
  { href: "/shop", label: "Shop" },
  { href: "/shop?category=new", label: "New Arrivals" },
  { href: "/shop?category=designers", label: "Designers" },
  { href: "/shop?category=editorial", label: "Editorial" },
];

export function MainLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, currentUser, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const { data: wardrobe } = useGetWardrobe({
    query: {
      enabled: isAuthenticated,
      queryKey: ["wardrobe"],
    },
  });

  // API returns WardrobeItem[] directly
  const wardrobeCount = Array.isArray(wardrobe) ? wardrobe.length : 0;

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setSearchOpen(false);
    setUserMenuOpen(false);
  }, [location]);

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  // Close user menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen]);

  // Prevent body scroll when mobile menu or search is open
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen || searchOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen, searchOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setSearchOpen(false);
      setSearchQuery("");
      setLocation(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const isNavActive = (href: string) => {
    if (href === "/shop" && !href.includes("?")) {
      return location === "/shop";
    }
    return location.startsWith(href.split("?")[0]) && location === "/shop" && href.includes("?") 
      ? window.location.search.includes(href.split("?")[1]) 
      : false;
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-primary/20 nebula-surface">
      <CursorGlow />
      {/* ── Top Header ── */}
      <header className="sticky top-0 z-50 w-full glass-header">
        <div className="container mx-auto px-4 md:px-6 h-20 flex items-center justify-between gap-4">
          {/* Left: hamburger + logo */}
          <div className="flex min-w-0 items-center gap-3 md:gap-4">
            <button
              className="md:hidden shrink-0 rounded-sm p-2 text-foreground hover:bg-foreground/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 transition-colors"
              aria-label="Open menu"
              data-testid="button-open-menu"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <Link
              href="/"
              aria-label="Rare District home"
              className="group flex min-w-0 items-center gap-2.5 text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              data-testid="link-brand"
            >
              <img
                src="/brand/rd-mark.png"
                alt="Rare District symbol"
                className="rd-header-mark shrink-0"
              />
              <span className="hidden truncate font-serif text-xl font-bold uppercase tracking-[0.16em] md:inline md:text-2xl md:tracking-[0.18em]">
                Rare District
              </span>
            </Link>
          </div>

          {/* Centre: desktop nav */}
          <nav className="hidden md:flex items-center gap-8 text-sm uppercase tracking-widest font-medium">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`transition-colors border-b-2 pb-0.5 ${
                  location === link.href.split("?")[0] && link.href === "/shop" && !link.href.includes("?")
                    ? "text-foreground border-foreground"
                    : "text-muted-foreground hover:text-foreground border-transparent hover:border-foreground/30"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right: actions */}
          <div className="flex items-center gap-4 md:gap-5">
            {/* Search */}
             <button
              className="text-foreground hover:text-primary transition-colors"
               aria-label="Search"
               data-testid="button-open-search"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="w-5 h-5" strokeWidth={1.5} />
            </button>

            {isAuthenticated ? (
              <>
                {/* Wardrobe */}
                <Link
                  href="/wardrobe"
                  className="relative text-foreground hover:text-primary transition-colors"
                   aria-label="Wardrobe"
                   data-testid="link-wardrobe"
                >
                  <ShoppingBag className="w-5 h-5" strokeWidth={1.5} />
                  {wardrobeCount > 0 && (
                    <span className="absolute -top-2 -right-2 w-4 h-4 flex items-center justify-center bg-primary text-primary-foreground text-[10px] font-bold rounded-full">
                      {wardrobeCount}
                    </span>
                  )}
                </Link>

                {/* User menu */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    className="text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                    onClick={() => setUserMenuOpen((v) => !v)}
                    aria-label="Account"
                    aria-expanded={userMenuOpen}
                  >
                    <UserIcon className="w-5 h-5" strokeWidth={1.5} />
                  </button>

                  {userMenuOpen && (
                     <div className="absolute right-0 top-full mt-3 w-52 glass-panel z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="px-4 py-3 border-b border-border">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Signed in as</p>
                        <p className="text-sm font-medium truncate">{currentUser?.name || currentUser?.email}</p>
                        <p className="text-xs text-muted-foreground capitalize tracking-widest">{currentUser?.role}</p>
                      </div>
                      <div className="py-1">
                        <Link href="/orders" className="block px-4 py-2.5 text-sm hover:bg-secondary transition-colors">
                          My Orders
                        </Link>
                        <Link href="/rewards" className="block px-4 py-2.5 text-sm hover:bg-secondary transition-colors">
                          My Rewards
                        </Link>
                        <Link href="/wardrobe" className="block px-4 py-2.5 text-sm hover:bg-secondary transition-colors">
                          My Wardrobe
                        </Link>
                        {currentUser?.role === "vendor" && (
                          <Link href="/vendor-dashboard" className="block px-4 py-2.5 text-sm hover:bg-secondary transition-colors border-t border-border mt-1 pt-2.5">
                            Vendor Dashboard
                          </Link>
                        )}
                        {currentUser?.role === "admin" && (
                          <Link href="/admin" className="block px-4 py-2.5 text-sm hover:bg-secondary transition-colors text-primary font-medium border-t border-border mt-1 pt-2.5">
                            Admin Panel
                          </Link>
                        )}
                      </div>
                      <div className="border-t border-border py-1">
                        <button
                          onClick={() => { logout(); setLocation("/"); setUserMenuOpen(false); }}
                          className="w-full text-left px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link
                href="/login"
                className="text-sm uppercase tracking-widest font-medium hover:text-primary transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ── Search Overlay ── */}
      {searchOpen && (
          <div
            className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-xl starfield flex flex-col items-center justify-center px-6 animate-in fade-in duration-200"
          onClick={(e) => { if (e.target === e.currentTarget) setSearchOpen(false); }}
        >
          <button
            className="absolute top-6 right-6 text-foreground hover:text-primary transition-colors"
            onClick={() => setSearchOpen(false)}
            aria-label="Close search"
          >
            <X className="w-7 h-7" />
          </button>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-8">Search the District</p>
           <form onSubmit={handleSearch} className="w-full max-w-xl" data-testid="form-search">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                 placeholder="Search products, designers…"
                 data-testid="input-search"
                className="w-full bg-transparent border-0 border-b-2 border-foreground/30 focus:border-foreground outline-none font-serif text-3xl md:text-4xl py-3 pr-12 placeholder:text-muted-foreground/40 text-foreground transition-colors"
              />
              <button type="submit" className="absolute right-0 top-1/2 -translate-y-1/2 text-foreground hover:text-primary transition-colors">
                <ArrowRight className="w-7 h-7" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Mobile Menu ── */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[55] bg-foreground/50 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Drawer */}
             <div className="fixed top-0 left-0 h-full w-[280px] bg-background/95 backdrop-blur-xl z-[60] flex flex-col shadow-2xl animate-in slide-in-from-left duration-300">
             <div className="flex h-20 items-center justify-between border-b border-border px-6">
               <Link
                 href="/"
                 className="flex items-center gap-2.5 text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                 data-testid="link-mobile-brand"
               >
                 <img src="/brand/rd-mark.png" alt="Rare District symbol" className="rd-mobile-mark" />
                 <span className="font-serif text-base font-bold uppercase tracking-[0.16em]">Rare District</span>
               </Link>
               <button
                 onClick={() => setMobileMenuOpen(false)}
                 aria-label="Close menu"
                 data-testid="button-close-menu"
                 className="rounded-sm p-2 text-foreground transition-colors hover:bg-foreground/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
               >
                <X className="w-6 h-6" />
              </button>
            </div>

            <nav className="flex-1 px-6 py-8 space-y-1 overflow-y-auto">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-4">Shop</p>
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between py-3 text-base font-medium uppercase tracking-widest text-foreground hover:text-primary border-b border-border/40 transition-colors"
                >
                  {link.label}
                  <ArrowRight className="w-4 h-4 opacity-30" />
                </Link>
              ))}

              {isAuthenticated && (
                <>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-8 mb-4">Account</p>
                  <Link href="/orders" className="flex items-center justify-between py-3 text-base font-medium uppercase tracking-widest text-foreground hover:text-primary border-b border-border/40 transition-colors">
                    My Orders <ArrowRight className="w-4 h-4 opacity-30" />
                  </Link>
                  <Link href="/wardrobe" className="flex items-center justify-between py-3 text-base font-medium uppercase tracking-widest text-foreground hover:text-primary border-b border-border/40 transition-colors">
                    My Wardrobe <ArrowRight className="w-4 h-4 opacity-30" />
                  </Link>
                  <Link href="/rewards" className="flex items-center justify-between py-3 text-base font-medium uppercase tracking-widest text-foreground hover:text-primary border-b border-border/40 transition-colors">
                    My Rewards <ArrowRight className="w-4 h-4 opacity-30" />
                  </Link>
                  {currentUser?.role === "vendor" && (
                    <Link href="/vendor-dashboard" className="flex items-center justify-between py-3 text-base font-medium uppercase tracking-widest text-foreground hover:text-primary border-b border-border/40 transition-colors">
                      Vendor Dashboard <ArrowRight className="w-4 h-4 opacity-30" />
                    </Link>
                  )}
                  {currentUser?.role === "admin" && (
                    <Link href="/admin" className="flex items-center justify-between py-3 text-base font-medium uppercase tracking-widest text-primary border-b border-border/40 transition-colors">
                      Admin Panel <ArrowRight className="w-4 h-4 opacity-50" />
                    </Link>
                  )}
                </>
              )}

              {!isAuthenticated && (
                <>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-8 mb-4">Account</p>
                  <Link href="/login" className="flex items-center justify-between py-3 text-base font-medium uppercase tracking-widest text-foreground hover:text-primary border-b border-border/40 transition-colors">
                    Sign In <ArrowRight className="w-4 h-4 opacity-30" />
                  </Link>
                  <Link href="/register" className="flex items-center justify-between py-3 text-base font-medium uppercase tracking-widest text-foreground hover:text-primary border-b border-border/40 transition-colors">
                    Register <ArrowRight className="w-4 h-4 opacity-30" />
                  </Link>
                </>
              )}
            </nav>

            {isAuthenticated && (
              <div className="px-6 py-6 border-t border-border">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 bg-secondary flex items-center justify-center font-serif text-base flex-shrink-0">
                    {currentUser?.name?.charAt(0) || currentUser?.email?.charAt(0)}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-medium truncate">{currentUser?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{currentUser?.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => { logout(); setLocation("/"); setMobileMenuOpen(false); }}
                  className="w-full text-left text-sm text-destructive hover:text-destructive/80 font-medium transition-colors uppercase tracking-widest"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <main className="flex-1">{children}</main>

      {/* ── Footer ── */}
       <footer className="rd-footer mt-auto border-t border-primary/25 bg-[hsl(229_25%_5%)] py-16 text-foreground md:py-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="md:col-span-2">
               <img
                 src="/brand/rd-footer-lockup.png"
                 alt="Rare District — Built Different. Made Rare. Lagos, worldwide."
                 className="rd-footer-lockup mb-7"
               />
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
                <li><button className="hover:text-primary transition-colors">Shipping &amp; Returns</button></li>
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
