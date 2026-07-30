import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { useRegisterUser, getGetMeQueryKey, UserRegistrationRole } from "@workspace/api-client-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  role: z.enum(["shopper", "vendor"] as const),
  referralCode: z.string().optional(),
});

export default function Register() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const searchParams = new URLSearchParams(window.location.search);
  const initialReferralCode = searchParams.get("ref") || "";

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "shopper",
      referralCode: initialReferralCode,
    },
  });

  const registerMutation = useRegisterUser();

  const onSubmit = (values: z.infer<typeof registerSchema>) => {
    registerMutation.mutate({ 
      data: {
        name: values.name,
        email: values.email,
        password: values.password,
        role: values.role as UserRegistrationRole,
        referralCode: values.referralCode || undefined
      } 
    }, {
      onSuccess: (data) => {
        login(data.token, data.user);
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        
        toast({ title: "Welcome to Rare District." });
        
        if (data.user.role === 'admin') setLocation('/admin');
        else if (data.user.role === 'vendor') setLocation('/vendor-dashboard/apply');
        else setLocation('/');
      },
      onError: (err: any) => {
        toast({
          title: "Registration Failed",
          description: err?.message || "Could not create account. Please try again.",
          variant: "destructive"
        });
      }
    });
  };

  return (
    <div className="min-h-[80vh] flex flex-col md:flex-row-reverse bg-background">
      {/* Visual side */}
      <div className="hidden md:flex w-1/2 bg-foreground relative overflow-hidden">
        <img 
          src="https://images.unsplash.com/photo-1539109136881-3be0616acf4b?q=80&w=2000&auto=format&fit=crop" 
          alt="Fashion Detail" 
          className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay grayscale-[30%]"
        />
        <div className="relative z-10 p-16 flex flex-col justify-end text-background w-full">
          <h2 className="font-serif text-5xl font-bold tracking-tight mb-6">Join The District.</h2>
          <p className="text-lg font-light text-primary-foreground/70 max-w-md leading-relaxed">
            Create an account to curate your wardrobe, access exclusive editorial drops, and connect with the vanguard of design.
          </p>
        </div>
      </div>
      
      {/* Form side */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8 md:p-16">
        <div className="w-full max-w-md">
          <div className="mb-10 text-center md:text-left">
            <h1 className="font-serif text-3xl md:text-4xl font-bold tracking-tight mb-2">Register</h1>
            <p className="text-muted-foreground">Create your account.</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} className="h-12 rounded-none border-border focus-visible:ring-primary focus-visible:border-primary bg-transparent" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                    <FormLabel className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} className="h-12 rounded-none border-border focus-visible:ring-primary focus-visible:border-primary bg-transparent" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem className="space-y-3 pt-2">
                    <FormLabel className="text-xs font-bold tracking-widest uppercase text-muted-foreground">I want to...</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0 p-3 border border-border cursor-pointer hover:bg-secondary/50 transition-colors">
                          <FormControl>
                            <RadioGroupItem value="shopper" />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer w-full">Shop the collection</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0 p-3 border border-border cursor-pointer hover:bg-secondary/50 transition-colors">
                          <FormControl>
                            <RadioGroupItem value="vendor" />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer w-full">Sell as a designer</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="referralCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Referral Code (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter code" {...field} className="h-12 rounded-none border-border focus-visible:ring-primary focus-visible:border-primary bg-transparent" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button 
                type="submit" 
                className="w-full h-14 rounded-none font-bold tracking-widest uppercase mt-6" 
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? "Creating Account..." : "Create Account"}
              </Button>
            </form>
          </Form>

          <div className="mt-8 text-center text-sm text-muted-foreground">
            <p>
              Already have an account?{' '}
              <Link href="/login" className="font-bold text-foreground hover:text-primary transition-colors underline underline-offset-4">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
