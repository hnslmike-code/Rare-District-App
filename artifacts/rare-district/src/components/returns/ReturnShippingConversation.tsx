import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Send, ShieldCheck, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Proposal = {
  id: number;
  proposedBy: number;
  payer: "vendor" | "customer" | "shared";
  amount: string | number;
  instructions?: string | null;
  note?: string | null;
  status: "proposed" | "accepted" | "declined" | "countered";
  createdAt: string;
};
type Conversation = {
  request: { customerId: number; vendorId: number; status: string; shippingDecision: string; shippingAgreementProposalId?: number | null; shippingInstructions?: string | null };
  messages: { id: number; senderId: number; body: string; createdAt: string }[];
  proposals: Proposal[];
  audit: { id: number; action: string; details: Record<string, unknown>; createdAt: string }[];
};
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` });

export function ReturnShippingConversation({ returnId, role, onChange }: { returnId: number; role: "customer" | "vendor"; onChange?: () => void }) {
  const { toast } = useToast();
  const [data, setData] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [payer, setPayer] = useState<Proposal["payer"]>(role === "vendor" ? "vendor" : "customer");
  const [amount, setAmount] = useState("0");
  const [instructions, setInstructions] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/returns/${returnId}/conversation`, { headers: headers() });
      if (response.ok) setData(await response.json());
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [returnId]);

  const activeProposal = useMemo(() => data?.proposals.find(proposal => proposal.status === "proposed"), [data]);
  const acceptedProposal = useMemo(() => data?.proposals.find(proposal => proposal.id === data?.request.shippingAgreementProposalId), [data]);
  const proposalOwnedByViewer = activeProposal && (
    role === "customer"
      ? activeProposal.proposedBy === data?.request.customerId
      : activeProposal.proposedBy !== data?.request.customerId
  );
  const request = async (url: string, body: unknown) => {
    setBusy(true);
    try {
      const response = await fetch(url, { method: "POST", headers: { ...headers(), "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not update the return.");
      await load(); onChange?.();
      return true;
    } catch (error) {
      toast({ title: "Return conversation not updated", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
      return false;
    } finally { setBusy(false); }
  };
  const submitProposal = async (parentProposalId?: number) => {
    const payload = { payer, amount: Number(amount), instructions, note };
    const ok = parentProposalId
      ? await request(`/api/returns/${returnId}/shipping-proposals/${parentProposalId}/respond`, { action: "counter", ...payload })
      : await request(`/api/returns/${returnId}/shipping-proposals`, payload);
    if (ok) { setInstructions(""); setNote(""); }
  };
  const sendMessage = async () => {
    if (!message.trim()) return;
    const ok = await request(`/api/returns/${returnId}/messages`, { body: message });
    if (ok) setMessage("");
  };
  const proposalText = (proposal: Proposal) => `${proposal.payer === "shared" ? "Shared" : proposal.payer === "vendor" ? "Vendor" : "Customer"} pays ₦${Number(proposal.amount).toLocaleString()}`;

  if (loading) return <div className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">Loading return conversation…</div>;
  if (!data) return <div className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">Return conversation is unavailable.</div>;

  return <div className="mt-6 space-y-5 border-t border-border pt-5">
    <div className="flex items-start gap-3"><Truck className="mt-0.5 h-4 w-4 text-muted-foreground" /><div><p className="text-xs font-bold uppercase tracking-widest">Return shipping agreement</p><p className="mt-1 text-xs text-muted-foreground">{data.request.shippingDecision === "undecided" ? "Agree on shipping before the vendor can approve this return." : `${data.request.shippingDecision === "vendor" ? "Vendor" : data.request.shippingDecision === "customer" ? "Customer" : "Both parties"} will cover shipping${acceptedProposal ? ` · ₦${Number(acceptedProposal.amount).toLocaleString()}` : ""}.`}</p>{(acceptedProposal?.instructions || data.request.shippingInstructions) && <p className="mt-2 border-l-2 border-primary pl-3 text-sm">{acceptedProposal?.instructions || data.request.shippingInstructions}</p>}</div></div>
    {data.request.status === "requested" && data.request.shippingDecision === "undecided" && !activeProposal && (
      <div className="grid gap-3 border border-border bg-secondary/20 p-4 md:grid-cols-[1fr_110px]">
        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Who pays<select value={payer} onChange={event => setPayer(event.target.value as Proposal["payer"])} className="mt-2 h-10 w-full border border-border bg-background px-2 text-sm font-normal normal-case tracking-normal"><option value="vendor">Vendor</option><option value="customer">Customer</option><option value="shared">Shared</option></select></label>
        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Amount<input type="number" min="0" value={amount} onChange={event => setAmount(event.target.value)} className="mt-2 h-10 w-full border border-border bg-background px-2 text-sm font-normal" /></label>
        <label className="md:col-span-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Return instructions<textarea value={instructions} onChange={event => setInstructions(event.target.value)} placeholder="Courier, address, deadline, or label instructions…" className="mt-2 min-h-20 w-full border border-border bg-background p-2 text-sm font-normal normal-case tracking-normal" /></label>
        <label className="md:col-span-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Note (optional)<input value={note} onChange={event => setNote(event.target.value)} className="mt-2 h-10 w-full border border-border bg-background px-2 text-sm font-normal normal-case tracking-normal" /></label>
        <div className="md:col-span-2 flex justify-end"><button disabled={busy} onClick={() => submitProposal()} className="bg-foreground px-4 py-2 text-xs font-bold uppercase tracking-widest text-background disabled:opacity-50">Propose terms</button></div>
      </div>
    )}
    {activeProposal && (
      <div className="border border-primary/30 bg-primary/5 p-4"><p className="text-xs font-bold uppercase tracking-widest">{proposalOwnedByViewer ? "Awaiting their response" : "Awaiting your response"}</p><p className="mt-2 text-sm">{proposalText(activeProposal)}</p>{activeProposal.instructions && <p className="mt-2 text-sm text-muted-foreground">{activeProposal.instructions}</p>}{activeProposal.note && <p className="mt-2 text-xs text-muted-foreground">Note: {activeProposal.note}</p>}{!proposalOwnedByViewer && <><div className="mt-4 flex flex-wrap gap-2"><button disabled={busy} onClick={() => request(`/api/returns/${returnId}/shipping-proposals/${activeProposal.id}/respond`, { action: "accept" })} className="bg-foreground px-3 py-2 text-xs font-bold uppercase tracking-widest text-background">Accept</button><button disabled={busy} onClick={() => request(`/api/returns/${returnId}/shipping-proposals/${activeProposal.id}/respond`, { action: "decline" })} className="border border-border px-3 py-2 text-xs font-bold uppercase tracking-widest">Decline</button><button disabled={busy} onClick={() => { setPayer(activeProposal.payer); setAmount(String(activeProposal.amount)); }} className="border border-border px-3 py-2 text-xs font-bold uppercase tracking-widest">Set counter terms below</button></div><div className="mt-4 border-t border-border pt-4"><p className="text-xs text-muted-foreground">Change the terms below, then submit a counter-proposal.</p><div className="mt-2 grid gap-2 sm:grid-cols-2"><select value={payer} onChange={event => setPayer(event.target.value as Proposal["payer"])} className="h-10 border border-border bg-background px-2 text-sm"><option value="vendor">Vendor pays</option><option value="customer">Customer pays</option><option value="shared">Shared</option></select><input type="number" min="0" value={amount} onChange={event => setAmount(event.target.value)} className="h-10 border border-border bg-background px-2 text-sm" /></div><textarea value={instructions} onChange={event => setInstructions(event.target.value)} placeholder="Updated instructions…" className="mt-2 min-h-16 w-full border border-border bg-background p-2 text-sm" /><button disabled={busy} onClick={() => submitProposal(activeProposal.id)} className="mt-2 border border-border px-3 py-2 text-xs font-bold uppercase tracking-widest">Counter-propose</button></div></>}</div>
    )}
    <div className="grid gap-4 lg:grid-cols-2">
      <div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest"><MessageCircle className="h-3.5 w-3.5" /> Messages</p><div className="mt-3 max-h-48 space-y-2 overflow-y-auto border border-border p-3">{data.messages.length ? data.messages.map(entry => <p key={entry.id} className="text-sm" title={new Date(entry.createdAt).toLocaleString()}>{entry.body}</p>) : <p className="text-xs text-muted-foreground">No messages yet.</p>}</div><div className="mt-2 flex gap-2"><input value={message} onChange={event => setMessage(event.target.value)} onKeyDown={event => { if (event.key === "Enter") void sendMessage(); }} placeholder="Message the other party…" className="h-10 min-w-0 flex-1 border border-border bg-background px-3 text-sm" /><button onClick={() => void sendMessage()} disabled={busy} className="grid h-10 w-10 place-items-center bg-foreground text-background"><Send className="h-4 w-4" /></button></div></div>
      <div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest"><ShieldCheck className="h-3.5 w-3.5" /> Audit trail</p><div className="mt-3 max-h-48 space-y-2 overflow-y-auto border border-border p-3">{data.audit.map(event => <p key={event.id} className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{event.action.replaceAll("_", " ")}</span> · {new Date(event.createdAt).toLocaleString()}</p>)}</div></div>
    </div>
  </div>;
}