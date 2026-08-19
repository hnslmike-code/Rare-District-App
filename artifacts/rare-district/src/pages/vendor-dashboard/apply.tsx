import { ChangeEvent, CSSProperties, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApplyAsVendor, useGetMyVendorProfile } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ArrowDownRight, ArrowUpRight, Clock3, ImagePlus, Loader2, Sparkles, X } from "lucide-react";

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

type VendorJoinContent = {
  hero: { callLabel: string; eyebrow: string; intakeLabel: string; titleLine1: string; titleLine2: string; description: string; tags: string[] };
  brief: { kicker: string; headline: string; lookingForLabel: string; lookingFor: string[]; note: string };
  form: {
    eyebrow: string; title: string; progressLabel: string; contactLegend: string; contactAccent: string; fullNameLabel: string; fullNamePlaceholder: string;
    emailLabel: string; emailFallback: string; phoneLabel: string; phonePlaceholder: string; brandLegend: string; brandAccent: string;
    brandNameLabel: string; brandNamePlaceholder: string; categoryLabel: string; categoryPlaceholder: string; experienceLabel: string;
    experiencePlaceholder: string; bioLabel: string; bioPlaceholder: string; bioHint: string; proofLegend: string; proofAccent: string;
    socialLabel: string; socialPlaceholder: string; socialHint: string; samplesLabel: string; uploadTitle: string; uploadHint: string; uploadingLabel: string; uploadedSuffix: string; rules: { bioMinLength: number; minSamples: number; maxSamples: number; maxImageBytes: number };
    submitLabel: string; submittingLabel: string; legal: string;
  };
  status: { pendingLabel: string; pendingTitle: string; pendingDescription: string; rejectedLabel: string; rejectedTitle: string; rejectedDescription: string; backLabel: string; backHref: string };
  categoryOptions: Array<{ value: string; label: string }>;
  experienceOptions: Array<{ value: string; label: string }>;
  theme: { acid: string; pink: string; cyan: string; ink: string; backgroundStart: string; backgroundEnd: string; gridOpacity: string };
};

function normaliseSocialLink(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("@")) return `https://instagram.com/${trimmed.slice(1)}`;
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

function interpolate(text: string, values: Record<string, string>) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? "");
}

async function getVendorJoinContent() {
  const response = await fetch("/api/storefront/vendor-join");
  if (!response.ok) throw new Error("The vendor application page could not be loaded.");
  return response.json() as Promise<{ content: VendorJoinContent }>;
}

export default function VendorApply() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const publicConfig = useQuery({ queryKey: ["storefront-vendor-join"], queryFn: getVendorJoinContent });
  const { data: profile, isLoading: isLoadingProfile } = useGetMyVendorProfile({ query: { queryKey: ["/api/vendors/me"], retry: false, enabled: !!currentUser } });
  const [form, setForm] = useState<ApplicationValues>({ contactName: currentUser?.name ?? "", phone: "", brandName: "", category: "", description: "", experienceLevel: "", socialLink: "", sampleImages: [] });
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (currentUser?.name) setForm(current => current.contactName ? current : { ...current, contactName: currentUser.name ?? "" });
  }, [currentUser?.name]);
  useEffect(() => {
    if (profile?.status === "approved") setLocation("/vendor-dashboard");
  }, [profile?.status, setLocation]);

  const applyMutation = useApplyAsVendor();
  const applicationReady = useMemo(() => publicConfig.data && form.contactName.trim().length >= 2 && form.phone.trim().length >= 7 && form.brandName.trim().length >= 2 && Boolean(form.category) && form.description.trim().length >= publicConfig.data.content.form.rules.bioMinLength && Boolean(form.experienceLevel) && form.socialLink.trim().length >= 2 && form.sampleImages.length >= publicConfig.data.content.form.rules.minSamples, [form, publicConfig.data]);
  const update = <K extends keyof ApplicationValues>(key: K, value: ApplicationValues[K]) => setForm(current => ({ ...current, [key]: value }));

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    const rules = publicConfig.data?.content.form.rules;
    if (!rules) return;
    const available = rules.maxSamples - form.sampleImages.length;
    if (!selected.length) return;
    if (selected.length > available) toast({ title: `Choose up to ${available} more images.`, variant: "destructive" });
    const valid = selected.slice(0, Math.max(0, available)).filter(file => file.type.startsWith("image/") && file.size <= rules.maxImageBytes);
    if (valid.length !== Math.min(selected.length, available)) toast({ title: `Use image files smaller than ${(rules.maxImageBytes / 1_000_000).toFixed(1)} MB.`, description: "PNG, JPG, WEBP, and similar image formats work best.", variant: "destructive" });
    if (!valid.length) return;
    const token = localStorage.getItem("token");
    if (!token) {
      toast({ title: "Sign in to upload samples.", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    try {
      const paths = await Promise.all(valid.map(async file => {
        const request = await fetch("/api/storage/uploads/request-url", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }) });
        if (!request.ok) throw new Error("Could not prepare an image upload.");
        const { uploadURL, objectPath } = await request.json() as { uploadURL: string; objectPath: string };
        const upload = await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
        if (!upload.ok) throw new Error("Could not upload an image.");
        return objectPath;
      }));
      update("sampleImages", [...form.sampleImages, ...paths]);
    } catch (error) {
      toast({ title: "Sample upload failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const onSubmit = () => {
    if (!applicationReady) {
      toast({ title: "Complete the application first.", description: `We need every field and at least ${content.form.rules.minSamples} samples to review your label.`, variant: "destructive" });
      return;
    }
    applyMutation.mutate({ data: { ...form, socialLink: normaliseSocialLink(form.socialLink) } }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/vendors/me"] }); toast({ title: "Application sent.", description: "The curation team has your work in the queue." }); },
      onError: (error: Error) => toast({ title: "Application not sent", description: error.message || "Please try again.", variant: "destructive" }),
    });
  };

  if (publicConfig.isLoading || isLoadingProfile) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!publicConfig.data) return <div className="mx-auto flex min-h-[50vh] max-w-xl items-center justify-center p-6 text-center text-sm">The vendor application page is unavailable right now. Please refresh and try again.</div>;
  const content = publicConfig.data.content;
  if (profile?.status === "pending") return <ApplicationStatus content={content} title={content.status.pendingTitle} description={interpolate(content.status.pendingDescription, { brandName: profile.brandName })} label={content.status.pendingLabel} />;
  if (profile?.status === "rejected") return <ApplicationStatus content={content} title={content.status.rejectedTitle} description={profile.adminNote || content.status.rejectedDescription} label={content.status.rejectedLabel} />;

  const themeStyle = {
    "--acid": content.theme.acid, "--pink": content.theme.pink, "--cyan": content.theme.cyan, "--ink": content.theme.ink,
    "--background-start": content.theme.backgroundStart, "--background-end": content.theme.backgroundEnd, "--grid-opacity": content.theme.gridOpacity,
  } as CSSProperties;
  const completedSections = [form.contactName && form.phone, form.brandName && form.category && form.description.length >= content.form.rules.bioMinLength && form.experienceLevel, form.socialLink && form.sampleImages.length >= content.form.rules.minSamples].filter(Boolean).length;

  return (
    <main className="vanguard-app min-h-screen overflow-hidden pb-16 text-white" style={themeStyle}>
      <style>{`
        .vanguard-app { font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; background-image:radial-gradient(circle at 14% 9%,color-mix(in srgb,var(--pink) 22%,transparent),transparent 26rem),radial-gradient(circle at 84% 19%,color-mix(in srgb,var(--cyan) 18%,transparent),transparent 30rem),linear-gradient(135deg,var(--background-start) 0%,var(--ink) 55%,var(--background-end) 100%); background-color:var(--ink); }
        .vanguard-app * { box-sizing:border-box; }.vanguard-app .vanguard-grid { background-image:linear-gradient(rgb(255 255 255 / var(--grid-opacity)) 1px,transparent 1px),linear-gradient(90deg,rgb(255 255 255 / var(--grid-opacity)) 1px,transparent 1px);background-size:28px 28px; }.vanguard-app .vanguard-display { font-family:Impact,Haettenschweiler,'Arial Narrow Bold',sans-serif;letter-spacing:-.055em;text-transform:uppercase;line-height:.79; }.vanguard-app .vanguard-brief-headline { line-height:.98;letter-spacing:-.045em; }.vanguard-app .glitch { text-shadow:3px 0 var(--pink),-3px 0 var(--cyan);animation:vanguard-glitch 4s steps(2,end) infinite; }.vanguard-app .marker { color:var(--acid); }.vanguard-app .vanguard-input,.vanguard-app .vanguard-select,.vanguard-app .vanguard-textarea { width:100%;border:1px solid rgb(255 255 255 / .38);background:rgb(4 4 8 / .68);padding:.8rem .9rem;color:#fff;outline:0;border-radius:0;font-size:.9rem; }.vanguard-app .vanguard-input:focus,.vanguard-app .vanguard-select:focus,.vanguard-app .vanguard-textarea:focus { border-color:var(--acid);box-shadow:4px 4px 0 var(--pink);transform:translate(-2px,-2px); }.vanguard-app .vanguard-input:disabled { color:rgb(255 255 255 / .5);cursor:not-allowed; }.vanguard-app .vanguard-select option { background:#15131d; }.vanguard-app .vanguard-button { border:2px solid var(--acid);background:var(--acid);color:var(--ink);transition:transform .15s,box-shadow .15s; }.vanguard-app .vanguard-button:hover:not(:disabled) { transform:translate(-4px,-4px);box-shadow:7px 7px 0 var(--pink); }.vanguard-app .vanguard-button:disabled { cursor:not-allowed;opacity:.4; }.vanguard-app .photo-slot:hover { border-color:var(--cyan);background:color-mix(in srgb,var(--cyan) 8%,transparent); }@keyframes vanguard-glitch { 0%,88%,100%{transform:translate(0)}89%{transform:translate(3px,-1px)}91%{transform:translate(-3px,2px)}93%{transform:translate(1px,0)} }
      `}</style>
      <section className="vanguard-grid relative border-b border-white/15 px-4 pb-10 pt-12 sm:px-8 md:pb-16 md:pt-16"><div className="mx-auto max-w-6xl"><div className="mb-12 flex items-center justify-between text-[10px] font-bold uppercase tracking-[.18em] text-white/65"><span className="rounded-full border border-white/20 px-3 py-1.5">{content.hero.callLabel}</span><span className="flex items-center gap-2 marker"><Sparkles className="h-3.5 w-3.5" /> {content.hero.intakeLabel}</span></div><div className="grid gap-8 md:grid-cols-[1.35fr_.65fr] md:items-end"><div><p className="mb-4 text-xs font-bold uppercase tracking-[.2em]" style={{ color: "var(--cyan)" }}>{content.hero.eyebrow}</p><h1 className="vanguard-display glitch max-w-4xl text-[clamp(4.3rem,14vw,10.5rem)]">{content.hero.titleLine1}<br /><span className="marker">{content.hero.titleLine2}</span></h1></div><p className="max-w-sm border-l-2 pl-4 text-sm leading-relaxed text-white/76" style={{ borderColor: "var(--pink)" }}>{content.hero.description}</p></div><div className="mt-12 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[.14em]">{content.hero.tags.map(tag => <span key={tag} className="border border-white/25 px-3 py-2">{tag}</span>)}</div></div></section>
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-8 md:grid-cols-[.72fr_1.28fr] md:py-16"><aside className="space-y-7 md:sticky md:top-24 md:self-start"><div className="border-2 p-5" style={{ borderColor: "var(--pink)", backgroundColor: "var(--pink)", color: "var(--ink)" }}><p className="text-[10px] font-bold uppercase tracking-[.18em]">{content.brief.kicker}</p><h2 className="vanguard-display vanguard-brief-headline mt-5 whitespace-pre-line text-5xl">{content.brief.headline}</h2></div><div className="border border-white/20 p-5 text-sm leading-relaxed text-white/70"><p className="mb-3 text-xs font-bold uppercase tracking-[.17em] marker">{content.brief.lookingForLabel}</p><ul className="space-y-3">{content.brief.lookingFor.map(item => <li key={item}>↗ {item}</li>)}</ul></div><p className="text-xs leading-relaxed text-white/45">{content.brief.note}</p></aside>
        <div className="border border-white/25 bg-black/40 p-4 shadow-[10px_10px_0_color-mix(in_srgb,var(--cyan)_22%,transparent)] sm:p-7"><div className="mb-8 flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.18em]" style={{ color: "var(--cyan)" }}>{content.form.eyebrow}</p><h2 className="vanguard-display mt-3 text-5xl">{content.form.title}</h2></div><span className="rounded-full border px-2 py-1 text-[10px] font-bold marker" style={{ borderColor: "var(--acid)" }}>{String(Math.min(4, Math.max(0, completedSections + 1))).padStart(2, "0")} / {content.form.progressLabel}</span></div>
          <form onSubmit={event => { event.preventDefault(); onSubmit(); }} className="space-y-9">
            <fieldset className="grid gap-5"><legend className="mb-4 text-[10px] font-bold uppercase tracking-[.2em] text-white/55">{content.form.contactLegend} <span style={{ color: "var(--pink)" }}>{content.form.contactAccent}</span></legend><div className="grid gap-5 sm:grid-cols-2"><Field label={content.form.fullNameLabel}><input required value={form.contactName} onChange={event => update("contactName", event.target.value)} className="vanguard-input" placeholder={content.form.fullNamePlaceholder} /></Field><Field label={content.form.emailLabel}><input value={currentUser?.email ?? content.form.emailFallback} disabled className="vanguard-input" /></Field></div><Field label={content.form.phoneLabel}><input required value={form.phone} onChange={event => update("phone", event.target.value)} className="vanguard-input" placeholder={content.form.phonePlaceholder} /></Field></fieldset>
            <fieldset className="grid gap-5 border-t border-white/15 pt-8"><legend className="mb-4 text-[10px] font-bold uppercase tracking-[.2em] text-white/55">{content.form.brandLegend} <span style={{ color: "var(--pink)" }}>{content.form.brandAccent}</span></legend><Field label={content.form.brandNameLabel}><input required value={form.brandName} onChange={event => update("brandName", event.target.value)} className="vanguard-input" placeholder={content.form.brandNamePlaceholder} /></Field><div className="grid gap-5 sm:grid-cols-2"><Field label={content.form.categoryLabel}><select required value={form.category} onChange={event => update("category", event.target.value)} className="vanguard-select"><option value="">{content.form.categoryPlaceholder}</option>{content.categoryOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field><Field label={content.form.experienceLabel}><select required value={form.experienceLevel} onChange={event => update("experienceLevel", event.target.value)} className="vanguard-select"><option value="">{content.form.experiencePlaceholder}</option>{content.experienceOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field></div><Field label={content.form.bioLabel}><textarea required minLength={content.form.rules.bioMinLength} value={form.description} onChange={event => update("description", event.target.value)} className="vanguard-textarea min-h-32 resize-y" placeholder={content.form.bioPlaceholder} /><p className="mt-2 text-[10px] text-white/40">{content.form.bioHint}</p></Field></fieldset>
            <fieldset className="grid gap-5 border-t border-white/15 pt-8"><legend className="mb-4 text-[10px] font-bold uppercase tracking-[.2em] text-white/55">{content.form.proofLegend} <span style={{ color: "var(--pink)" }}>{content.form.proofAccent}</span></legend><Field label={content.form.socialLabel}><input required value={form.socialLink} onChange={event => update("socialLink", event.target.value)} className="vanguard-input" placeholder={content.form.socialPlaceholder} /><p className="mt-2 text-[10px] text-white/40">{content.form.socialHint}</p></Field><div><div className="mb-3 flex items-end justify-between"><label className="text-[10px] font-bold uppercase tracking-[.16em] text-white/70">{content.form.samplesLabel}</label><span className={`text-[10px] font-bold ${form.sampleImages.length >= content.form.rules.minSamples ? "marker" : "text-white/40"}`}>{isUploading ? content.form.uploadingLabel : `${form.sampleImages.length}/${content.form.rules.maxSamples} ${content.form.uploadedSuffix}`}</span></div><label className="photo-slot flex min-h-36 cursor-pointer flex-col items-center justify-center border border-dashed border-white/35 p-5 text-center transition"><ImagePlus className="mb-3 h-7 w-7" style={{ color: "var(--cyan)" }} /><span className="text-sm font-bold">{content.form.uploadTitle}</span><span className="mt-1 text-[10px] text-white/45">{content.form.uploadHint}</span><input type="file" accept="image/*" multiple onChange={handleFiles} disabled={isUploading || form.sampleImages.length >= content.form.rules.maxSamples} className="sr-only" /></label>{form.sampleImages.length ? <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">{form.sampleImages.map((image, index) => <div className="relative aspect-square overflow-hidden border border-white/20" key={`${image}-${index}`}><img src={`/api/storage${image}`} alt={`Sample ${index + 1}`} className="h-full w-full object-cover" /><button type="button" onClick={() => update("sampleImages", form.sampleImages.filter((_, imageIndex) => imageIndex !== index))} className="absolute right-1 top-1 grid h-6 w-6 place-items-center bg-black/80 text-white hover:bg-pink-500" aria-label={`Remove sample ${index + 1}`}><X className="h-3.5 w-3.5" /></button></div>)}</div> : null}</div></fieldset>
            <div className="border-t border-white/15 pt-6"><button type="submit" disabled={!applicationReady || applyMutation.isPending} className="vanguard-button flex w-full items-center justify-between px-5 py-4 text-sm font-black uppercase tracking-[.16em]">{applyMutation.isPending ? content.form.submittingLabel : content.form.submitLabel}{applyMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUpRight className="h-5 w-5" />}</button><p className="mt-4 text-center text-[10px] leading-relaxed text-white/45">{content.form.legal}</p></div>
          </form></div></section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-[10px] font-bold uppercase tracking-[.16em] text-white/70"><span className="mb-2 block">{label}</span>{children}</label>;
}

function ApplicationStatus({ content, title, description, label }: { content: VendorJoinContent; title: string; description: string; label: string }) {
  const style = { "--acid": content.theme.acid, "--pink": content.theme.pink, "--cyan": content.theme.cyan, "--ink": content.theme.ink } as CSSProperties;
  return <main className="vanguard-app flex min-h-[70vh] items-center justify-center p-5 text-white" style={{ ...style, backgroundColor: content.theme.ink }}><style>{`.vanguard-display{font-family:Impact,Haettenschweiler,'Arial Narrow Bold',sans-serif;letter-spacing:-.055em;line-height:.8;text-transform:uppercase}.marker{color:var(--acid)}`}</style><div className="max-w-xl border border-white/25 bg-black/35 p-8 text-center" style={{ boxShadow: "10px 10px 0 var(--pink)" }}><Clock3 className="mx-auto h-7 w-7 marker" /><p className="mt-7 text-[10px] font-bold uppercase tracking-[.2em]" style={{ color: "var(--cyan)" }}>{label}</p><h1 className="vanguard-display mt-4 text-6xl">{title}</h1><p className="mt-6 text-sm leading-relaxed text-white/70">{description}</p><a href={content.status.backHref} className="mt-8 inline-flex items-center gap-2 border px-4 py-3 text-xs font-bold uppercase tracking-widest marker hover:bg-white hover:text-black" style={{ borderColor: "var(--acid)" }}>{content.status.backLabel}<ArrowDownRight className="h-4 w-4" /></a></div></main>;
}