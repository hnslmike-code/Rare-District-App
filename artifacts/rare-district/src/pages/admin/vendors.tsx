import { useState } from "react";
import { useListAdminVendors, useUpdateVendorStatus, getListAdminVendorsQueryKey, type ListAdminVendorsStatus, type VendorStatusUpdateStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock } from "lucide-react";

const statusColors: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  rejected: "bg-red-100 text-red-800",
};

export default function AdminVendors() {
  const [filter, setFilter] = useState<"all" | ListAdminVendorsStatus>("all");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: vendors, isLoading } = useListAdminVendors(
    filter !== "all" ? { status: filter } : {},
    { query: { queryKey: getListAdminVendorsQueryKey(filter !== "all" ? { status: filter } : {}) } }
  );

  const updateStatus = useUpdateVendorStatus({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminVendorsQueryKey() });
        toast({ title: "Vendor status updated." });
      },
    }
  });

  const handleStatusChange = (vendorId: number, status: VendorStatusUpdateStatus) => {
    updateStatus.mutate({ id: vendorId, data: { status } });
  };

  return (
    <div className="space-y-8" data-testid="admin-vendors">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-4xl font-bold tracking-tight mb-2">Vendor Applications</h1>
          <p className="text-muted-foreground">Review and approve atelier applications.</p>
        </div>
        <Select value={filter} onValueChange={(value) => setFilter(value as "all" | ListAdminVendorsStatus)}>
          <SelectTrigger className="w-40 rounded-none">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : vendors && vendors.length > 0 ? (
        <div className="space-y-3">
          {vendors.map(vendor => (
            <div key={vendor.id} className="border border-border p-6 flex flex-col md:flex-row items-start md:items-center gap-4 justify-between" data-testid={`vendor-row-${vendor.id}`}>
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center font-serif text-lg font-bold text-muted-foreground flex-shrink-0">
                  {vendor.brandName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-base">{vendor.brandName}</p>
                  <p className="text-sm text-muted-foreground truncate">{vendor.user?.email}</p>
                  {vendor.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{vendor.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`text-xs font-bold tracking-widest uppercase px-2 py-1 rounded ${statusColors[vendor.status] ?? "bg-secondary"}`}>
                  {vendor.status}
                </span>
                {vendor.status === "pending" && (
                  <>
                    <Button
                      size="sm"
                      className="rounded-none h-8 bg-foreground text-background hover:bg-foreground/90"
                      onClick={() => handleStatusChange(vendor.id, "approved")}
                      disabled={updateStatus.isPending}
                      data-testid={`approve-vendor-${vendor.id}`}
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-none h-8"
                      onClick={() => handleStatusChange(vendor.id, "rejected")}
                      disabled={updateStatus.isPending}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                    </Button>
                  </>
                )}
                {vendor.status === "approved" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-none h-8"
                    onClick={() => handleStatusChange(vendor.id, "rejected")}
                    disabled={updateStatus.isPending}
                  >
                    Suspend
                  </Button>
                )}
                {vendor.status === "rejected" && (
                  <Button
                    size="sm"
                    className="rounded-none h-8 bg-foreground text-background hover:bg-foreground/90"
                    onClick={() => handleStatusChange(vendor.id, "approved")}
                    disabled={updateStatus.isPending}
                  >
                    Reinstate
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-20 border border-border text-center text-muted-foreground">
          <Clock className="w-10 h-10 mx-auto mb-4" />
          <p className="font-serif text-2xl mb-2">No vendors found.</p>
        </div>
      )}
    </div>
  );
}
