import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { useLoginUser } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Loader2 } from "lucide-react";

const schema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

type FormValues = z.infer<typeof schema>;

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { login, isAdmin, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  // If already logged in as admin, redirect immediately
  useEffect(() => {
    if (!authLoading && isAuthenticated && isAdmin) {
      setLocation("/admin");
    }
  }, [authLoading, isAuthenticated, isAdmin, setLocation]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const loginMutation = useLoginUser();

  const onSubmit = (values: FormValues) => {
    loginMutation.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          if (data.user.role !== "admin") {
            setError("email", { message: "This account does not have admin access." });
            return;
          }
          login(data.token, data.user);
          toast({ title: "Welcome to the Admin Panel." });
          setLocation("/admin");
        },
        onError: () => {
          setError("password", { message: "Invalid credentials. Please try again." });
        },
      }
    );
  };

  const isPending = loginMutation.isPending || isSubmitting;

  return (
    <div className="min-h-screen bg-foreground flex flex-col items-center justify-center px-4">
      {/* Back link */}
      <Link
        href="/"
        className="absolute top-6 left-6 text-xs text-background/40 hover:text-background/70 uppercase tracking-widest transition-colors"
      >
        ← Storefront
      </Link>

      <div className="w-full max-w-sm">
        {/* Icon + heading */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 border border-background/20 mb-6">
            <ShieldCheck className="w-7 h-7 text-primary" strokeWidth={1.5} />
          </div>
          <h1 className="font-serif text-3xl font-bold text-background tracking-tight mb-2">
            Admin Access
          </h1>
          <p className="text-sm text-background/40 tracking-wide">
            Restricted to authorised personnel only.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-background/40 mb-2">
              Email Address
            </label>
            <input
              type="email"
              autoComplete="email"
              placeholder="admin@example.com"
              {...register("email")}
              className="w-full bg-transparent border border-background/20 focus:border-primary outline-none text-background text-sm px-4 py-3 placeholder:text-background/25 transition-colors"
            />
            {errors.email && (
              <p className="text-xs text-red-400 mt-1.5">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-background/40 mb-2">
              Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••••"
              {...register("password")}
              className="w-full bg-transparent border border-background/20 focus:border-primary outline-none text-background text-sm px-4 py-3 placeholder:text-background/25 transition-colors"
            />
            {errors.password && (
              <p className="text-xs text-red-400 mt-1.5">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground text-sm font-bold tracking-widest uppercase py-3.5 hover:opacity-90 disabled:opacity-50 transition-opacity mt-2"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying…
              </>
            ) : (
              "Sign In to Admin Panel"
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="mt-10 pt-6 border-t border-background/10 text-center">
          <Link
            href="/login"
            className="text-xs text-background/30 hover:text-background/50 tracking-widest uppercase transition-colors"
          >
            Customer login →
          </Link>
        </div>
      </div>
    </div>
  );
}
