import { useEffect } from "react";
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import NotFound from '@/pages/not-found';

// Layouts
import { MainLayout } from '@/components/layout/MainLayout';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

// Pages
import Home from '@/pages/home';
import Shop from '@/pages/shop';
import ProductDetail from '@/pages/product';
import VendorPage from '@/pages/vendor';
import Lookbook from '@/pages/lookbook';
import Wardrobe from '@/pages/wardrobe';
import Checkout from '@/pages/checkout';
import Login from '@/pages/login';
import Register from '@/pages/register';
import Orders from '@/pages/orders';
import OrderDetail from '@/pages/order-detail';
import Rewards from '@/pages/rewards';
import Account from '@/pages/account';
import HowToSell from '@/pages/how-to-sell';
import PriceDrops from '@/pages/price-drops';

// Vendor Dashboard
import VendorDashboard from '@/pages/vendor-dashboard/index';
import VendorApply from '@/pages/vendor-dashboard/apply';
import VendorProducts from '@/pages/vendor-dashboard/products/index';
import VendorNewProduct from '@/pages/vendor-dashboard/products/new';

// Admin
import AdminLogin from '@/pages/admin/login';
import AdminDashboard from '@/pages/admin/index';
import AdminVendors from '@/pages/admin/vendors';
import AdminProducts from '@/pages/admin/products';
import AdminOrders from '@/pages/admin/orders';
import AdminTransactions from '@/pages/admin/transactions';
import AdminCoupons from '@/pages/admin/coupons';
import AdminSettings from '@/pages/admin/settings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Guard components
const AdminRoute = ({ component: Component }: { component: React.ComponentType }) => {
  const { isAdmin, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAdmin) setLocation("/admin/login");
  }, [isAdmin, isLoading, setLocation]);

  if (isLoading || !isAdmin) return <div className="h-screen flex items-center justify-center text-muted-foreground text-sm tracking-widest uppercase">Loading...</div>;

  return (
    <DashboardLayout isAdmin>
      <Component />
    </DashboardLayout>
  );
};

const VendorRoute = ({ component: Component }: { component: React.ComponentType }) => {
  const { isVendor, isLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isVendor, isLoading, isAuthenticated, setLocation]);

  if (isLoading) return <div className="h-screen flex items-center justify-center text-muted-foreground text-sm tracking-widest uppercase">Loading...</div>;

  return (
    <DashboardLayout>
      <Component />
    </DashboardLayout>
  );
};

const PublicRoute = ({ component: Component }: { component: React.ComponentType }) => {
  return (
    <MainLayout>
      <Component />
    </MainLayout>
  );
};

const ProtectedRoute = ({ component: Component }: { component: React.ComponentType }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) setLocation("/login");
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading || !isAuthenticated) return <div className="h-screen flex items-center justify-center text-muted-foreground text-sm tracking-widest uppercase">Loading...</div>;

  return (
    <MainLayout>
      <Component />
    </MainLayout>
  );
};

function Router() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/" component={() => <PublicRoute component={Home} />} />
      <Route path="/shop" component={() => <PublicRoute component={Shop} />} />
      <Route path="/product/:id" component={() => <PublicRoute component={ProductDetail} />} />
      <Route path="/vendor/:id" component={() => <PublicRoute component={VendorPage} />} />
      <Route path="/lookbook/:id" component={() => <PublicRoute component={Lookbook} />} />
      <Route path="/login" component={() => <PublicRoute component={Login} />} />
      <Route path="/register" component={() => <PublicRoute component={Register} />} />
      <Route path="/account" component={() => <PublicRoute component={Account} />} />
      <Route path="/how-to-sell" component={() => <PublicRoute component={HowToSell} />} />
      <Route path="/price-drops" component={() => <PublicRoute component={PriceDrops} />} />

      {/* Protected Shopper */}
      <Route path="/wardrobe" component={() => <ProtectedRoute component={Wardrobe} />} />
      <Route path="/checkout" component={() => <ProtectedRoute component={Checkout} />} />
      <Route path="/orders" component={() => <ProtectedRoute component={Orders} />} />
      <Route path="/orders/:id" component={() => <ProtectedRoute component={OrderDetail} />} />
      <Route path="/rewards" component={() => <ProtectedRoute component={Rewards} />} />

      {/* Vendor Dashboard */}
      <Route path="/vendor-dashboard/apply" component={() => <PublicRoute component={VendorApply} />} />
      <Route path="/vendor-dashboard/products/new" component={() => <VendorRoute component={VendorNewProduct} />} />
      <Route path="/vendor-dashboard/products" component={() => <VendorRoute component={VendorProducts} />} />
      <Route path="/vendor-dashboard" component={() => <VendorRoute component={VendorDashboard} />} />

      {/* Admin */}
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin/vendors" component={() => <AdminRoute component={AdminVendors} />} />
      <Route path="/admin/products" component={() => <AdminRoute component={AdminProducts} />} />
      <Route path="/admin/orders" component={() => <AdminRoute component={AdminOrders} />} />
      <Route path="/admin/transactions" component={() => <AdminRoute component={AdminTransactions} />} />
      <Route path="/admin/coupons" component={() => <AdminRoute component={AdminCoupons} />} />
      <Route path="/admin/settings" component={() => <AdminRoute component={AdminSettings} />} />
      <Route path="/admin" component={() => <AdminRoute component={AdminDashboard} />} />

      <Route component={() => <PublicRoute component={NotFound} />} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
