import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { vendorJson } from "@/lib/vendor-control";

const copy: Record<string, { title: string; eyebrow: string; description: string }> = {
  payouts: { title: "Payouts", eyebrow: "Workspace / Payouts", description: "Track payout requests, review states, and settlement references." },
  analytics: { title: "Analytics", eyebrow: "Workspace / Analytics", description: "Sales, units, refunds, and vendor earnings belong here. Choose a date range to understand what is moving." },
  notifications: { title: "Notifications", eyebrow: "Workspace / Notifications", description: "Keep order, return, inventory, and payout actions in one calm queue." },
};

type Notification = {
  id: number;
  title: string;
  body: string;
  href: string | null;
  type: string;
  readAt: string | null;
  createdAt: string;
};
type Payout = { id: number; amount: number; reference: string | null; status: string };

export default function VendorWorkspace({ section }: { section: "payouts" | "analytics" | "notifications" }) {
  const content = copy[section];
  const queryClient = useQueryClient();
  const notifications = useQuery({
    queryKey: ["/api/notifications"],
    queryFn: () => vendorJson<Notification[]>("/api/notifications"),
    enabled: section === "notifications",
  });
  const payouts = useQuery({
    queryKey: ["/api/vendors/me/payouts"],
    queryFn: () => vendorJson<Payout[]>("/api/vendors/me/payouts"),
    enabled: section === "payouts",
  });
  const items = section === "notifications" ? notifications.data ?? [] : payouts.data ?? [];
  const loading = section === "notifications" ? notifications.isLoading : payouts.isLoading;
  const refreshNotifications = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] }),
  ]);
  const changeNotificationReadState = async (id: number, read: boolean) => {
    await vendorJson(`/api/notifications/${id}/${read ? "read" : "unread"}`, { method: "PATCH" });
    await refreshNotifications();
  };
  const markAllRead = async () => {
    await vendorJson("/api/notifications/read-all", { method: "PATCH" });
    await refreshNotifications();
  };
  return <div className="space-y-8">
    <header><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{content.eyebrow}</p><h1 className="mt-2 font-serif text-4xl font-bold tracking-tight">{content.title}</h1><p className="mt-2 max-w-2xl text-muted-foreground">{content.description}</p></header>
    {section === "analytics" ? <div className="grid gap-4 md:grid-cols-3"><div className="border border-border p-6"><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Reporting range</p><p className="mt-3 font-serif text-2xl">Last 6 months</p></div><Link href="/vendor-dashboard" className="border border-border p-6 hover:bg-secondary"><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Revenue</p><p className="mt-3 font-serif text-2xl">Open overview chart →</p></Link><Link href="/vendor-dashboard/inventory" className="border border-border p-6 hover:bg-secondary"><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Stock health</p><p className="mt-3 font-serif text-2xl">Open inventory →</p></Link></div> : loading ? <div className="border border-dashed border-border p-12 text-center text-sm text-muted-foreground">Loading workspace…</div> : items.length === 0 ? <div className="border border-dashed border-border p-12 text-center text-sm text-muted-foreground">Nothing to show yet.</div> : section === "notifications" ? <section className="space-y-3"><div className="flex justify-end"><button onClick={() => void markAllRead()} className="text-xs font-bold uppercase tracking-widest underline">Mark all as read</button></div>{(items as Notification[]).map(item => {
      const safeHref = item.href?.startsWith("/vendor-dashboard/") ? item.href : null;
      return <div key={item.id} className={`flex flex-col justify-between gap-3 border bg-background p-5 sm:flex-row sm:items-center ${item.readAt ? "border-border" : "border-primary/50"}`}><div><p className="font-medium">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.body}</p><p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{item.type} · {new Date(item.createdAt).toLocaleString()}</p></div><div className="flex shrink-0 items-center gap-3">{safeHref && <Link href={safeHref} onClick={() => { if (!item.readAt) void changeNotificationReadState(item.id, true); }} className="text-xs font-bold uppercase tracking-widest underline">Open</Link>}<button onClick={() => void changeNotificationReadState(item.id, !item.readAt)} className="text-xs font-bold uppercase tracking-widest underline">{item.readAt ? "Mark unread" : "Mark read"}</button></div></div>;
    })}</section> : <div className="space-y-3">{(items as Payout[]).map(item => <div key={item.id} className="flex flex-col justify-between gap-3 border border-border bg-background p-5 sm:flex-row sm:items-center"><div><p className="font-medium">Payout #{item.id}</p><p className="mt-1 text-xs text-muted-foreground">₦{Number(item.amount).toLocaleString()} · {item.reference || "Awaiting reference"}</p></div><span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{item.status}</span></div>)}</div>}
  </div>;
}