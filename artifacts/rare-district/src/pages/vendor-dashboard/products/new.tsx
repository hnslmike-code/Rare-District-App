import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { useCreateProduct, useGetMyVendorProfile } from "@workspace/api-client-react";
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
import { ArrowLeft, ImagePlus, X } from "lucide-react";

// Just a basic form, image upload logic is tricky without the real endpoint but we can mock the array
const productSchema = z.object({
  name: z.string().min(2, "Product name is required"),
  description: z.string().optional(),
  price: z.coerce.number().min(1, "Price must be greater than 0"),
  category: z.string().optional(),
  sizes: z.string().optional(), // We'll split this by comma
  stock: z.coerce.number().min(0, "Stock cannot be negative"),
});

export default function VendorNewProduct() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: profile } = useGetMyVendorProfile();

  const [images, setImages] = useState<string[]>([]);
  // We simulate image upload URL
  const [imageUrlInput, setImageUrlInput] = useState("");

  const form = useForm<z.infer<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      category: "",
      sizes: "S, M, L",
      stock: 1,
    },
  });

  const createMutation = useCreateProduct();

  const addImage = () => {
    if (imageUrlInput) {
      setImages([...images, imageUrlInput]);
      setImageUrlInput("");
    }
  };

  const removeImage = (idx: number) => {
    setImages(images.filter((_, i) => i !== idx));
  };

  const onSubmit = (values: z.infer<typeof productSchema>) => {
    createMutation.mutate({
      data: {
        name: values.name,
        description: values.description,
        price: values.price,
        category: values.category,
        stock: values.stock,
        sizes: values.sizes ? values.sizes.split(',').map(s => s.trim()).filter(Boolean) : [],
        images: images.length > 0 ? images : undefined
      }
    }, {
      onSuccess: () => {
        if (profile?.id) {
          queryClient.invalidateQueries({ queryKey: ["vendor-products", profile.id] });
        }
        toast({ title: "Piece added successfully" });
        setLocation("/vendor-dashboard/products");
      },
      onError: (err: any) => {
        toast({
          title: "Failed to add piece",
          description: err?.message || "An error occurred.",
          variant: "destructive"
        });
      }
    });
  };

  return (
    <div className="space-y-8 max-w-4xl pb-24">
      <div className="flex items-center gap-4">
        <Link href="/vendor-dashboard/products" className="text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Add New Piece</h1>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-8">
              <div className="p-6 border border-border bg-background space-y-6">
                <h2 className="text-sm font-bold tracking-widest uppercase mb-4 border-b border-border pb-2">Basic Information</h2>
                
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Product Name</FormLabel>
                      <FormControl>
                        <Input {...field} className="h-12 rounded-none border-border focus-visible:ring-primary bg-transparent" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          className="min-h-[150px] rounded-none border-border focus-visible:ring-primary bg-transparent"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="p-6 border border-border bg-background space-y-6">
                <h2 className="text-sm font-bold tracking-widest uppercase mb-4 border-b border-border pb-2">Pricing & Inventory</h2>
                
                <div className="grid grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Price (₦)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} className="h-12 rounded-none border-border focus-visible:ring-primary bg-transparent font-serif text-lg" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="stock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Stock Quantity</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} className="h-12 rounded-none border-border focus-visible:ring-primary bg-transparent" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="p-6 border border-border bg-background space-y-6">
                <h2 className="text-sm font-bold tracking-widest uppercase mb-4 border-b border-border pb-2">Organization</h2>
                
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Category</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Dresses" {...field} className="h-12 rounded-none border-border focus-visible:ring-primary bg-transparent" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sizes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Sizes (Comma separated)</FormLabel>
                      <FormControl>
                        <Input placeholder="S, M, L, XL" {...field} className="h-12 rounded-none border-border focus-visible:ring-primary bg-transparent" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="p-6 border border-border bg-background space-y-4">
                <h2 className="text-sm font-bold tracking-widest uppercase mb-4 border-b border-border pb-2">Media</h2>
                
                <div className="space-y-3">
                  {images.map((img, i) => (
                    <div key={i} className="flex items-center gap-3 bg-secondary/50 p-2 border border-border">
                      <div className="w-10 h-10 bg-secondary shrink-0 overflow-hidden">
                        <img src={img} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 text-xs truncate text-muted-foreground">{img}</div>
                      <button type="button" onClick={() => removeImage(i)} className="p-1 hover:text-destructive transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Image URL" 
                      value={imageUrlInput}
                      onChange={e => setImageUrlInput(e.target.value)}
                      className="h-10 rounded-none border-border bg-transparent text-xs" 
                    />
                    <Button type="button" onClick={addImage} variant="outline" className="h-10 rounded-none border-border px-3">
                      <ImagePlus className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">In a full production environment, this would use the pre-signed URL upload flow to GCS.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4 border-t border-border pt-6">
            <Link href="/vendor-dashboard/products">
              <Button type="button" variant="outline" className="h-12 rounded-none border-border font-bold tracking-widest uppercase text-xs px-8">
                Cancel
              </Button>
            </Link>
            <Button 
              type="submit" 
              disabled={createMutation.isPending}
              className="h-12 rounded-none font-bold tracking-widest uppercase text-xs px-8"
            >
              {createMutation.isPending ? "Saving..." : "Save Piece"}
            </Button>
          </div>

        </form>
      </Form>
    </div>
  );
}
