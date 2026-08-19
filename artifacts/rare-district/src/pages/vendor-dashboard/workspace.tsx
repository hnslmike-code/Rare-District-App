import { useEffect, useState } from "react";
import { Link } from "wouter";

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` });
const copy: Record<string, { title: string; eyebrow: string; description: string }> = {
  payouts: { title: "Payouts", eyebrow: "Workspace / Payouts", description: "Track payout requests, review states, and settlement references." },
  analytics: { title: "Analytics", eyebrow: "Workspace / Analytics", description: "Sales, units, refunds, and vendor earnings belong here. Choose a date range to understand what is moving." },
  notifications: { title: "Notifications", eyebrow: "Workspace / Notifications", description: "Keep order, return, inventory, and payout actions in one calm queue." },
};

export default function VendorWorkspace({ section }: { section: "payouts" | "analytics" | "notifications" }) {
  const [items, setItems] = useState<any[]>([]);
  const content = copy[section];
  useEffect(() => {
    if (section === "payouts") fetch("/api/vendors/me/payouts", { headers: authHeaders() }).then(response => response.ok ? response.json() : []).then(setItems);
    if (section === "notifications") fetch("/api/notifications", { headers: authHeaders() }).then(response => response.ok ? response.json() : []).then(setItems);
  }, [section]);
  return <div className="space-y-8">
    <header><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{content.eyebrow}</p><h1 className="mt-2 font-serif text-4xl font-bold tracking-tight">{content.title}</h1><p className="mt-2 max-w-2xl text-muted-foreground">{content.description}</p></header>
    {section === "analytics" ? <div className="grid gap-4 md:grid-cols-3"><div className="border border-border p-6"><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Reporting range</p><p className="mt-3 font-serif text-2xl">Last 6 months</p></div><Link href="/vendor-dashboard" className="border border-border p-6 hover:bg-secondary"><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Revenue</p><p className="mt-3 font-serif text-2xl">Open overview chart →</p></Link><Link href="/vendor-dashboard/inventory" className="border border-border p-6 hover:bg-secondary"><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Stock health</p><p className="mt-3 font-serif text-2xl">Open inventory →</p></Link></div> : items.length === 0 ? <div className="border border-dashed border-border p-12 text-center text-sm text-muted-foreground">Nothing to show yet.</div> : <div className="space-y-3">{items.map(item => <div key={item.id} className="flex flex-col justify-between gap-3 border border-border bg-background p-5 sm:flex-row sm:items-center"><div><p className="font-medium">{section === "notifications" ? item.title : `Payout #${item.id}`}</p><p className="mt-1 text-xs text-muted-foreground">{section === "notifications" ? item.body : `₦${Number(item.amount).toLocaleString()} · ${item.reference || "Awaiting reference"}`}</p></div><span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{item.status || "unread"}</span></div>)}</div>}
  </div>;
}