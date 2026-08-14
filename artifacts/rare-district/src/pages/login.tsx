import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { useLoginUser, getGetMeQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useLoginUser();

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    loginMutation.mutate({ data: values }, {
      onSuccess: (data) => {
        login(data.token, data.user);
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        
        toast({ title: "Welcome back to the district." });
        
        // Redirect based on role
        if (data.user.role === 'admin') setLocation('/admin');
        else if (data.user.role === 'vendor') setLocation('/vendor-dashboard');
        else setLocation('/');
      },
      onError: (err: any) => {
        toast({
          title: "Sign In Failed",
          description: err?.message || "Invalid credentials. Please try again.",
          variant: "destructive"
        });
      }
    });
  };

  return (
    <div className="min-h-[80vh] flex flex-col md:flex-row bg-background">
      {/* Visual side */}
      <div className="hidden md:flex w-1/2 bg-[hsl(229_25%_5%)] relative overflow-hidden starfield nebula-surface">
        <img 
          src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2000&auto=format&fit=crop" 
          alt="Fashion Detail" 
           className="absolute inset-0 w-full h-full object-cover opacity-35 mix-blend-luminosity grayscale-[30%]"
        />
        <div className="relative z-10 p-16 flex flex-col justify-end text-background w-full">
          <h2 className="font-serif text-5xl font-bold tracking-tight mb-6">Welcome Back.</h2>
          <p className="text-lg font-light text-primary-foreground/70 max-w-md leading-relaxed">
            Sign in to access your private wardrobe, track orders, and discover new pieces from the vanguard of design.
          </p>
        </div>
      </div>
      
      {/* Form side */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8 md:p-16">
         <div className="w-full max-w-md glass-panel p-7 md:p-10">
          <div className="mb-10 text-center md:text-left">
            <h1 className="font-serif text-3xl md:text-4xl font-bold tracking-tight mb-2">Sign In</h1>
            <p className="text-muted-foreground">Enter your credentials to continue.</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Email</FormLabel>
                    <FormControl>
                      <Input placeholder="you@example.com" {...field} className="h-12 rounded-none border-border focus-visible:ring-primary focus-visible:border-primary bg-transparent" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between items-center">
                      <FormLabel className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Password</FormLabel>
                      <Link href="/forgot-password" className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">Forgot?</Link>
                    </div>
                    <FormControl>
                       <Input type="password" placeholder="Enter your password" {...field} className="h-12 rounded-none border-border focus-visible:ring-primary focus-visible:border-primary bg-transparent" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button 
                type="submit" 
                className="w-full h-14 rounded-none font-bold tracking-widest uppercase mt-4" 
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Signing In..." : "Sign In"}
              </Button>
            </form>
          </Form>

          <div className="mt-8 text-center text-sm text-muted-foreground">
            <p>
              New to the district?{' '}
              <Link href="/register" className="font-bold text-foreground hover:text-primary transition-colors underline underline-offset-4">
                Create an Account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
