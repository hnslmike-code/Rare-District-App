import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useApplyAsVendor, useGetMyVendorProfile } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Check, Clock3, ImagePlus, Loader2, Sparkles, X } from "lucide-react";

type ApplicationValues = {
  contactName: string;
  phone: string;
  brandName: string;
  category: string;
  description: string;
  experienceLevel: string;
  socialLink: string;
  sampleImages: string[];
};

const categoryOptions = ["Streetwear", "Luxury", "Accessories", "Footwear"];
const experienceOptions = ["Just starting", "Under 1 year", "1–3 years", "3+ years"];

function normaliseSocialLink(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("@")) return `https://instagram.com/${trimmed.slice(1)}`;
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

export default function VendorApply() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useGetMyVendorProfile({ query: { queryKey: ["/api/vendors/me"], retry: false, enabled: !!currentUser } });
  const [form, setForm] = useState<ApplicationValues>({
    contactName: currentUser?.name ?? "",
    phone: "",
    brandName: "",
    category: "",
    description: "",
    experienceLevel: "",
    socialLink: "",
    sampleImages: [],
  });
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (currentUser?.name) setForm(current => current.contactName ? current : { ...current, contactName: currentUser.name ?? "" });
  }, [currentUser?.name]);
  useEffect(() => {
    if (profile?.status === "approved") setLocation("/vendor-dashboard");
  }, [profile?.status, setLocation]);

  const applyMutation = useApplyAsVendor();
  const applicationReady = useMemo(() => (
    form.contactName.trim().length >= 2 &&
    form.phone.trim().length >= 7 &&
    form.brandName.trim().length >= 2 &&
    Boolean(form.category) &&
    form.description.trim().length >= 20 &&
    Boolean(form.experienceLevel) &&
    form.socialLink.trim().length >= 2 &&
    form.sampleImages.length >= 3
  ), [form]);

  const update = <K extends keyof ApplicationValues>(key: K, value: ApplicationValues[K]) => setForm(current => ({ ...current, [key]: value }));

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    const available = 5 - form.sampleImages.length;
    if (!selected.length) return;
    if (selected.length > available) toast({ title: `Choose up to ${available} more images.`, variant: "destructive" });
    const accepted = selected.slice(0, Math.max(0, available));
    if (accepted.some(file => !file.type.startsWith("image/") || file.size > 1_500_000)) {
      toast({ title: "Use image files smaller than 1.5 MB.", description: "PNG, JPG, WEBP, and similar image formats work best.", variant: "destructive" });
    }
    const valid = accepted.filter(file => file.type.startsWith("image/") && file.size <= 1_500_000);
    if (!valid.length) return;
    const token = localStorage.getItem("token");
    if (!token) {
      toast({ title: "Sign in to upload samples.", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    try {
      const uploadedPaths = await Promise.all(valid.map(async (file) => {
        const request = await fetch("/api/storage/uploads/request-url", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
        });
        if (!request.ok) throw new Error("Could not prepare an image upload.");
        const { uploadURL, objectPath } = await request.json() as { uploadURL: string; objectPath: string };
        const upload = await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
        if (!upload.ok) throw new Error("Could not upload an image.");
        return objectPath;
      }));
      update("sampleImages", [...form.sampleImages, ...uploadedPaths]);
    } catch (error) {
      toast({ title: "Sample upload failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
    event.target.value = "";
  };

  const removeImage = (index: number) => {
    update("sampleImages", form.sampleImages.filter((_, imageIndex) => imageIndex !== index));
  };

  const onSubmit = () => {
    if (!applicationReady) {
      toast({ title: "Complete the application first.", description: "We need every field and at least three samples to review your label.", variant: "destructive" });
      return;
    }
    applyMutation.mutate({
      data: {
        ...form,
        socialLink: normaliseSocialLink(form.socialLink),
      },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/vendors/me"] });
        toast({ title: "Application sent.", description: "The curation team has your work in the queue." });
      },
      onError: (error: Error) => toast({ title: "Application not sent", description: error.message || "Please try again.", variant: "destructive" }),
    });
  };

  if (isLoading) return <div className="min-h-[50vh] flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (profile?.status === "pending") return <ApplicationStatus title="Your signal is in." description={`We’re reviewing ${profile.brandName} now. Expect a real answer, not a black hole.`} label="In review" />;
  if (profile?.status === "rejected") return <ApplicationStatus title="Not this drop." description={profile.adminNote || "The current edit wasn’t the right fit. Keep building—new calls happen."} label="Application closed" />;

  return (
    <main className="vanguard-app min-h-screen overflow-hidden bg-[#08070d] pb-16 text-white">
      <style>{`
        .vanguard-app { --acid:#dfff00; --pink:#ff3cac; --cyan:#3cf3ff; --ink:#08070d; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; background-image: radial-gradient(circle at 14% 9%, rgba(255,60,172,.22), transparent 26rem), radial-gradient(circle at 84% 19%, rgba(60,243,255,.18), transparent 30rem), linear-gradient(135deg, #0d0917 0%, #08070d 55%, #150714 100%); }
        .vanguard-app * { box-sizing:border-box; }
        .vanguard-app .vanguard-grid { background-image: linear-gradient(rgba(255,255,255,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.055) 1px, transparent 1px); background-size: 28px 28px; }
        .vanguard-app .vanguard-display { font-family: Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif; letter-spacing:-.055em; text-transform:uppercase; line-height:.79; }
        .vanguard-app .glitch { position:relative; text-shadow: 3px 0 var(--pink), -3px 0 var(--cyan); animation:vanguard-glitch 4s steps(2,end) infinite; }
        .vanguard-app .glitch:hover { animation:vanguard-glitch .35s steps(2,end) infinite; }
        .vanguard-app .marker { color:var(--acid); }
        .vanguard-app .vanguard-input, .vanguard-app .vanguard-select, .vanguard-app .vanguard-textarea { width:100%; border:1px solid rgba(255,255,255,.38); background:rgba(4,4,8,.68); padding:.8rem .9rem; color:#fff; outline:0; border-radius:0; font-size:.9rem; transition:transform .16s, border-color .16s, box-shadow .16s; }
        .vanguard-app .vanguard-input:focus, .vanguard-app .vanguard-select:focus, .vanguard-app .vanguard-textarea:focus { border-color:var(--acid); box-shadow:4px 4px 0 var(--pink); transform:translate(-2px,-2px); }
        .vanguard-app .vanguard-input:disabled { color:rgba(255,255,255,.5); cursor:not-allowed; }
        .vanguard-app .vanguard-select option { background:#15131d; }
        .vanguard-app .vanguard-button { border:2px solid var(--acid); background:var(--acid); color:#08070d; transition:transform .15s, box-shadow .15s, background .15s; }
        .vanguard-app .vanguard-button:hover:not(:disabled) { transform:translate(-4px,-4px); box-shadow:7px 7px 0 var(--pink); }
        .vanguard-app .vanguard-button:disabled { cursor:not-allowed; opacity:.4; }
        .vanguard-app .photo-slot:hover { border-color:var(--cyan); background:rgba(60,243,255,.08); }
        @keyframes vanguard-glitch { 0%, 88%, 100% { transform:translate(0); } 89% { transform:translate(3px,-1px); } 91% { transform:translate(-3px,2px); } 93% { transform:translate(1px,0); } }
      `}</style>

      <section className="vanguard-grid relative border-b border-white/15 px-4 pb-10 pt-12 sm:px-8 md:pb-16 md:pt-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 flex items-center justify-between text-[10px] font-bold uppercase tracking-[.18em] text-white/65">
            <span className="rounded-full border border-white/20 px-3 py-1.5">Rare District / Vendor Call</span>
            <span className="flex items-center gap-2 text-[#dfff00]"><Sparkles className="h-3.5 w-3.5" /> 2026 intake open</span>
          </div>
          <div className="grid gap-8 md:grid-cols-[1.35fr_.65fr] md:items-end">
            <div>
              <p className="mb-4 text-xs font-bold uppercase tracking-[.2em] text-[#3cf3ff]">For the labels with receipts</p>
              <h1 className="vanguard-display glitch max-w-4xl text-[clamp(4.3rem,14vw,10.5rem)]">Join the<br /><span className="marker">Vanguard.</span></h1>
            </div>
            <p className="max-w-sm border-l-2 border-[#ff3cac] pl-4 text-sm leading-relaxed text-white/76">You make the pieces people ask about in the group chat. Put your work in front of a district that knows the difference.</p>
          </div>
          <div className="mt-12 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[.14em]"><span className="border border-white/25 px-3 py-2">Lagos → London → everywhere</span><span className="border border-white/25 px-3 py-2">Curated, not crowded</span><span className="border border-white/25 px-3 py-2">Your label. Your pace.</span></div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-8 md:grid-cols-[.72fr_1.28fr] md:py-16">
        <aside className="space-y-7 md:sticky md:top-24 md:self-start">
          <div className="border-2 border-[#ff3cac] bg-[#ff3cac] p-5 text-[#08070d]"><p className="text-[10px] font-bold uppercase tracking-[.18em]">01 / The brief</p><h2 className="vanguard-display mt-5 text-5xl">Show the work,<br />not the pitch deck.</h2></div>
          <div className="border border-white/20 p-5 text-sm leading-relaxed text-white/70"><p className="mb-3 text-xs font-bold uppercase tracking-[.17em] text-[#dfff00]">What we’re looking for</p><ul className="space-y-3"><li>↗ A clear point of view</li><li>↗ Pieces that hold up offline</li><li>↗ A brand ready for its next room</li></ul></div>
          <p className="text-xs leading-relaxed text-white/45">No bank or payout details here. If your application is approved, those are handled privately in onboarding.</p>
        </aside>

        <div className="border border-white/25 bg-black/40 p-4 shadow-[10px_10px_0_rgba(60,243,255,.22)] sm:p-7">
          <div className="mb-8 flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#3cf3ff]">Vendor application</p><h2 className="vanguard-display mt-3 text-5xl">Drop your signal.</h2></div><span className="rounded-full border border-[#dfff00] px-2 py-1 text-[10px] font-bold text-[#dfff00]">{String(Math.min(4, Math.ceil(Object.values(form).filter(value => Array.isArray(value) ? value.length : value).length / 2))).padStart(2, "0")} / 04</span></div>

          <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }} className="space-y-9">
            <fieldset className="grid gap-5"><legend className="mb-4 text-[10px] font-bold uppercase tracking-[.2em] text-white/55">Contact <span className="text-[#ff3cac]">/ who’s behind it</span></legend><div className="grid gap-5 sm:grid-cols-2"><Field label="Full name"><input required value={form.contactName} onChange={event => update("contactName", event.target.value)} className="vanguard-input" placeholder="Your name" /></Field><Field label="Email"><input value={currentUser?.email ?? "Your Rare District account"} disabled className="vanguard-input" /></Field></div><Field label="Phone / WhatsApp"><input required value={form.phone} onChange={event => update("phone", event.target.value)} className="vanguard-input" placeholder="+234 / +44 / ..." /></Field></fieldset>

            <fieldset className="grid gap-5 border-t border-white/15 pt-8"><legend className="mb-4 text-[10px] font-bold uppercase tracking-[.2em] text-white/55">Brand file <span className="text-[#ff3cac]">/ the context</span></legend><Field label="Brand name"><input required value={form.brandName} onChange={event => update("brandName", event.target.value)} className="vanguard-input" placeholder="The label on the tag" /></Field><div className="grid gap-5 sm:grid-cols-2"><Field label="Primary category"><select required value={form.category} onChange={event => update("category", event.target.value)} className="vanguard-select"><option value="">Choose your lane</option>{categoryOptions.map(category => <option key={category} value={category}>{category}</option>)}</select></Field><Field label="How long have you been operating?"><select required value={form.experienceLevel} onChange={event => update("experienceLevel", event.target.value)} className="vanguard-select"><option value="">Pick one</option>{experienceOptions.map(option => <option key={option} value={option}>{option}</option>)}</select></Field></div><Field label="Short brand bio"><textarea required minLength={20} value={form.description} onChange={event => update("description", event.target.value)} className="vanguard-textarea min-h-32 resize-y" placeholder="What do you make? What makes it yours? Give us the short version." /><p className="mt-2 text-[10px] text-white/40">Minimum 20 characters. Be specific.</p></Field></fieldset>

            <fieldset className="grid gap-5 border-t border-white/15 pt-8"><legend className="mb-4 text-[10px] font-bold uppercase tracking-[.2em] text-white/55">Proof of work <span className="text-[#ff3cac]">/ make it visual</span></legend><Field label="Instagram handle, portfolio, or website"><input required value={form.socialLink} onChange={event => update("socialLink", event.target.value)} className="vanguard-input" placeholder="@yourlabel or https://yourlabel.com" /><p className="mt-2 text-[10px] text-white/40">Required. This is how the curation team meets the work.</p></Field><div><div className="mb-3 flex items-end justify-between"><label className="text-[10px] font-bold uppercase tracking-[.16em] text-white/70">3–5 product samples</label><span className={`text-[10px] font-bold ${form.sampleImages.length >= 3 ? "text-[#dfff00]" : "text-white/40"}`}>{isUploading ? "Uploading…" : `${form.sampleImages.length}/5 uploaded`}</span></div><label className="photo-slot flex min-h-36 cursor-pointer flex-col items-center justify-center border border-dashed border-white/35 p-5 text-center transition"><ImagePlus className="mb-3 h-7 w-7 text-[#3cf3ff]" /><span className="text-sm font-bold">Drop images here or tap to upload</span><span className="mt-1 text-[10px] text-white/45">3–5 JPG, PNG or WEBP files · 1.5 MB each</span><input type="file" accept="image/*" multiple onChange={handleFiles} disabled={isUploading || form.sampleImages.length >= 5} className="sr-only" /></label>{form.sampleImages.length ? <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">{form.sampleImages.map((image, index) => <div className="relative aspect-square overflow-hidden border border-white/20" key={`${image}-${index}`}><img src={`/api/storage${image}`} alt={`Sample ${index + 1}`} className="h-full w-full object-cover" /><button type="button" onClick={() => removeImage(index)} className="absolute right-1 top-1 grid h-6 w-6 place-items-center bg-black/80 text-white hover:bg-[#ff3cac]" aria-label={`Remove sample ${index + 1}`}><X className="h-3.5 w-3.5" /></button></div>)}</div> : null}</div></fieldset>

            <div className="border-t border-white/15 pt-6"><button type="submit" disabled={!applicationReady || applyMutation.isPending} className="vanguard-button flex w-full items-center justify-between px-5 py-4 text-sm font-black uppercase tracking-[.16em]">{applyMutation.isPending ? "Sending signal…" : "Submit for curation"} {applyMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUpRight className="h-5 w-5" />}</button><p className="mt-4 text-center text-[10px] leading-relaxed text-white/45">By submitting, you confirm the samples are your work and agree to a curated review. No financial information is collected at this stage.</p></div>
          </form>
        </div>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-[10px] font-bold uppercase tracking-[.16em] text-white/70"><span className="mb-2 block">{label}</span>{children}</label>;
}

function ApplicationStatus({ title, description, label }: { title: string; description: string; label: string }) {
  return <main className="vanguard-app flex min-h-[70vh] items-center justify-center bg-[#08070d] p-5 text-white"><style>{`.vanguard-app { font-family:ui-monospace,monospace; } .vanguard-display { font-family:Impact,Haettenschweiler,'Arial Narrow Bold',sans-serif; letter-spacing:-.055em; line-height:.8; text-transform:uppercase; }`}</style><div className="max-w-xl border border-white/25 bg-black/35 p-8 text-center shadow-[10px_10px_0_rgba(255,60,172,.4)]"><Clock3 className="mx-auto h-7 w-7 text-[#dfff00]" /><p className="mt-7 text-[10px] font-bold uppercase tracking-[.2em] text-[#3cf3ff]">{label}</p><h1 className="vanguard-display mt-4 text-6xl">{title}</h1><p className="mt-6 text-sm leading-relaxed text-white/70">{description}</p><a href="/shop" className="mt-8 inline-flex items-center gap-2 border border-[#dfff00] px-4 py-3 text-xs font-bold uppercase tracking-widest text-[#dfff00] hover:bg-[#dfff00] hover:text-black">Back to the district <ArrowDownRight className="h-4 w-4" /></a></div></main>;
}