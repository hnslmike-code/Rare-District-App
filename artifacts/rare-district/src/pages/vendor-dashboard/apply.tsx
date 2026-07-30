import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useApplyAsVendor, useGetMyVendorProfile } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Store, Clock } from "lucide-react";
import { useEffect } from "react";

const applicationSchema = z.object({
  brandName: z.string().min(2, "Brand name must be at least 2 characters."),
  description: z.string().optional(),
  website: z.string().url("Must be a valid URL if provided.").optional().or(z.literal("")),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  accountName: z.string().optional(),
});

export default function VendorApply() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useGetMyVendorProfile({
    query: {
      retry: false
    }
  });

  const form = useForm<z.infer<typeof applicationSchema>>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      brandName: "",
      description: "",
      website: "",
      bankName: "",
      accountNumber: "",
      accountName: "",
    },
  });

  const applyMutation = useApplyAsVendor();

  const onSubmit = (values: z.infer<typeof applicationSchema>) => {
    applyMutation.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/vendors/me"] });
        toast({ title: "Application Submitted", description: "Our curation team will review your brand." });
      },
      onError: (err: any) => {
        toast({
          title: "Submission Failed",
          description: err?.message || "Could not submit application.",
          variant: "destructive"
        });
      }
    });
  };

  useEffect(() => {
    if (profile?.status === 'approved') {
      setLocation("/vendor-dashboard");
    }
  }, [profile, setLocation]);

  if (isLoading) return <div className="min-h-[50vh] flex items-center justify-center">Loading...</div>;

  if (profile?.status === 'pending') {
    return (
      <div className="container mx-auto px-4 py-24 max-w-2xl text-center">
        <Clock className="w-16 h-16 text-muted-foreground mx-auto mb-6 opacity-50" />
        <h1 className="font-serif text-4xl font-bold tracking-tight mb-4">Under Review</h1>
        <p className="text-muted-foreground text-lg mb-8 max-w-lg mx-auto">
          Your application for <span className="font-bold text-foreground">{profile.brandName}</span> is currently being reviewed by our curation team. This process typically takes 48-72 hours.
        </p>
        <p className="text-sm font-medium tracking-widest uppercase border border-border inline-block px-6 py-3 bg-secondary/30">
          Status: Pending Approval
        </p>
      </div>
    );
  }

  if (profile?.status === 'rejected') {
    return (
      <div className="container mx-auto px-4 py-24 max-w-2xl text-center">
        <h1 className="font-serif text-4xl font-bold tracking-tight mb-4 text-destructive">Application Declined</h1>
        <p className="text-muted-foreground text-lg mb-8 max-w-lg mx-auto">
          Unfortunately, your brand does not fit the current editorial direction of Rare District. 
        </p>
        {profile.adminNote && (
          <div className="p-6 bg-secondary/30 border border-border text-sm text-left mb-8">
            <p className="font-bold tracking-widest uppercase text-xs mb-2">Note from Curation Team</p>
            <p className="italic">"{profile.adminNote}"</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 md:py-20 max-w-3xl">
      <div className="mb-12">
        <Store className="w-8 h-8 mb-6 text-primary" />
        <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight mb-4">Join The Vanguard</h1>
        <p className="text-muted-foreground text-lg">
          Submit your brand for consideration. We partner exclusively with designers who represent the pinnacle of contemporary fashion.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          
          <div className="p-8 border border-border bg-secondary/10 space-y-6">
            <h2 className="text-sm font-bold tracking-widest uppercase mb-4 border-b border-border pb-2">Brand Identity</h2>
            
            <FormField
              control={form.control}
              name="brandName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Brand Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your brand's name" {...field} className="h-12 rounded-none border-border focus-visible:ring-primary bg-background" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Website / Portfolio</FormLabel>
                  <FormControl>
                    <Input placeholder="https://" {...field} className="h-12 rounded-none border-border focus-visible:ring-primary bg-background" />
                  </FormControl>
                  <FormDescription className="text-xs">Where can we view your collections?</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Brand Story</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe your design philosophy, materials used, and brand history." 
                      className="min-h-[120px] rounded-none border-border focus-visible:ring-primary bg-background"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="p-8 border border-border bg-secondary/10 space-y-6">
            <h2 className="text-sm font-bold tracking-widest uppercase mb-4 border-b border-border pb-2">Payout Information (Optional)</h2>
            <p className="text-xs text-muted-foreground mb-4">You can set this up later if approved.</p>
            
            <FormField
              control={form.control}
              name="bankName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Bank Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. GTBank" {...field} className="h-12 rounded-none border-border focus-visible:ring-primary bg-background" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="accountNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Account Number</FormLabel>
                    <FormControl>
                      <Input placeholder="10 digit number" {...field} className="h-12 rounded-none border-border focus-visible:ring-primary bg-background" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="accountName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Account Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Name on account" {...field} className="h-12 rounded-none border-border focus-visible:ring-primary bg-background" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <Button 
            type="submit" 
            disabled={applyMutation.isPending}
            className="w-full md:w-auto md:px-12 h-14 rounded-none font-bold tracking-widest uppercase text-sm"
          >
            {applyMutation.isPending ? "Submitting..." : "Submit Application"}
          </Button>

        </form>
      </Form>
    </div>
  );
}
