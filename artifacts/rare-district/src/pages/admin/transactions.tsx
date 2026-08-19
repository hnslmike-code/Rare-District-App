import { useListTransactions, useMarkVendorPayout, getListTransactionsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Activity } from "lucide-react";

const statusColors: Record<string, string> = {
  success: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  failed: "bg-red-100 text-red-800",
};

const transactionTypeLabel: Record<string, string> = {
  sale: "Sale",
  refund: "Refund",
  reversal: "Reversal",
};

export default function AdminTransactions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: transactions, isLoading } = useListTransactions({}, {
    query: { queryKey: getListTransactionsQueryKey() }
  });

  const markPayout = useMarkVendorPayout({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
        toast({ title: "Payout recorded." });
      }
    }
  });

  return (
    <div className="space-y-8" data-testid="admin-transactions">
      <div>
        <h1 className="font-serif text-4xl font-bold tracking-tight mb-2">Transactions</h1>
        <p className="text-muted-foreground">Payment ledger and vendor payout tracking.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : transactions && transactions.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-bold tracking-widest uppercase text-xs text-muted-foreground">ID</th>
                <th className="text-left py-3 px-4 font-bold tracking-widest uppercase text-xs text-muted-foreground">Order</th>
                <th className="text-left py-3 px-4 font-bold tracking-widest uppercase text-xs text-muted-foreground">Entry</th>
                <th className="text-left py-3 px-4 font-bold tracking-widest uppercase text-xs text-muted-foreground">Amount</th>
                <th className="text-left py-3 px-4 font-bold tracking-widest uppercase text-xs text-muted-foreground">Commission</th>
                <th className="text-left py-3 px-4 font-bold tracking-widest uppercase text-xs text-muted-foreground">Vendor</th>
                <th className="text-left py-3 px-4 font-bold tracking-widest uppercase text-xs text-muted-foreground">Processor</th>
                <th className="text-left py-3 px-4 font-bold tracking-widest uppercase text-xs text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => (
                <tr key={tx.id} className="border-b border-border hover:bg-secondary/30" data-testid={`tx-${tx.id}`}>
                  <td className="py-4 px-4 font-mono text-xs text-muted-foreground">#{tx.id}</td>
                  <td className="py-4 px-4 font-medium">Order #{tx.orderId}</td>
                  <td className="py-4 px-4">
                    <span className={tx.transactionType === "sale" ? "text-xs font-bold tracking-widest uppercase text-muted-foreground" : "text-xs font-bold tracking-widest uppercase text-amber-700"}>
                      {transactionTypeLabel[tx.transactionType] ?? tx.transactionType}
                    </span>
                  </td>
                  <td className="py-4 px-4 font-serif font-medium">₦{tx.amount.toLocaleString()}</td>
                  <td className="py-4 px-4 text-muted-foreground">₦{tx.commissionAmount.toLocaleString()} <span className="text-xs">({tx.commissionRate}%)</span></td>
                  <td className="py-4 px-4 font-medium">₦{tx.vendorAmount.toLocaleString()}</td>
                  <td className="py-4 px-4 capitalize text-muted-foreground">{tx.processor}</td>
                  <td className="py-4 px-4">
                    <span className={`text-xs font-bold tracking-widest uppercase px-2 py-1 rounded ${statusColors[tx.status] ?? "bg-secondary"}`}>
                      {tx.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-20 border border-border text-center text-muted-foreground">
          <Activity className="w-10 h-10 mx-auto mb-4" />
          <p className="font-serif text-2xl mb-2">No transactions yet.</p>
        </div>
      )}
    </div>
  );
}
