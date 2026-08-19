import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, Eye, Loader2, Palette, Save, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { adminJson } from "@/lib/admin-control";

type PageContent = {
  hero: { callLabel: string; eyebrow: string; intakeLabel: string; titleLine1: string; titleLine2: string; description: string; tags: string[] };
  brief: { kicker: string; headline: string; lookingForLabel: string; lookingFor: string[]; note: string };
  form: Record<"eyebrow" | "title" | "progressLabel" | "contactLegend" | "contactAccent" | "fullNameLabel" | "fullNamePlaceholder" | "emailLabel" | "emailFallback" | "phoneLabel" | "phonePlaceholder" | "brandLegend" | "brandAccent" | "brandNameLabel" | "brandNamePlaceholder" | "categoryLabel" | "categoryPlaceholder" | "experienceLabel" | "experiencePlaceholder" | "bioLabel" | "bioPlaceholder" | "bioHint" | "proofLegend" | "proofAccent" | "socialLabel" | "socialPlaceholder" | "socialHint" | "samplesLabel" | "uploadTitle" | "uploadHint" | "uploadingLabel" | "uploadedSuffix" | "submitLabel" | "submittingLabel" | "legal", string> & { rules: { bioMinLength: number; minSamples: number; maxSamples: number; maxImageBytes: number } };
  status: { pendingLabel: string; pendingTitle: string; pendingDescription: string; rejectedLabel: string; rejectedTitle: string; rejectedDescription: string; backLabel: string; backHref: string };
  categoryOptions: Array<{ value: string; label: string }>;
  experienceOptions: Array<{ value: string; label: string }>;
  theme: { acid: string; pink: string; cyan: string; ink: string; backgroundStart: string; backgroundEnd: string; gridOpacity: string };
};
type PageConfig = { id: number; draftContent: PageContent; publishedContent: PageContent | null; scheduledContent: PageContent | null; scheduledAt: string | null; publishedAt: string | null; updatedAt: string };
type FormTextKey = Exclude<keyof PageContent["form"], "rules">;

const inputClass = "mt-1 w-full border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-foreground";
const labelClass = "text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground";
const formFields: Array<[string, FormTextKey, boolean?]> = [
  ["Form eyebrow", "eyebrow"], ["Form title", "title"], ["Progress total", "progressLabel"],
  ["Contact heading", "contactLegend"], ["Contact accent", "contactAccent"], ["Full name label", "fullNameLabel"], ["Full name placeholder", "fullNamePlaceholder"],
  ["Email label", "emailLabel"], ["Email fallback", "emailFallback"], ["Phone label", "phoneLabel"], ["Phone placeholder", "phonePlaceholder"],
  ["Brand heading", "brandLegend"], ["Brand accent", "brandAccent"], ["Brand name label", "brandNameLabel"], ["Brand name placeholder", "brandNamePlaceholder"],
  ["Category label", "categoryLabel"], ["Category placeholder", "categoryPlaceholder"], ["Experience label", "experienceLabel"], ["Experience placeholder", "experiencePlaceholder"],
  ["Bio label", "bioLabel"], ["Bio placeholder", "bioPlaceholder", true], ["Bio helper", "bioHint"],
  ["Proof heading", "proofLegend"], ["Proof accent", "proofAccent"], ["Social label", "socialLabel"], ["Social placeholder", "socialPlaceholder"], ["Social helper", "socialHint"],
  ["Sample label", "samplesLabel"], ["Upload title", "uploadTitle"], ["Upload helper", "uploadHint"], ["Uploading label", "uploadingLabel"], ["Uploaded suffix", "uploadedSuffix"], ["Submit label", "submitLabel"], ["Submitting label", "submittingLabel"], ["Legal note", "legal", true],
];

export default function AdminVendorJoin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<PageContent | null>(null);
  const [savedDraft, setSavedDraft] = useState<PageContent | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const config = useQuery({ queryKey: ["admin-vendor-join"], queryFn: () => adminJson<PageConfig>("/api/admin/vendor-join") });

  useEffect(() => {
    if (config.data?.draftContent) {
      setDraft(config.data.draftContent);
      setSavedDraft(config.data.draftContent);
    }
    if (config.data?.scheduledAt) setScheduleAt(config.data.scheduledAt.slice(0, 16));
  }, [config.data]);

  const saveDraft = useMutation({
    mutationFn: (content: PageContent) => adminJson<PageConfig>("/api/admin/vendor-join", { method: "PATCH", body: JSON.stringify(content) }),
    onSuccess: updated => { setDraft(updated.draftContent); setSavedDraft(updated.draftContent); queryClient.invalidateQueries({ queryKey: ["admin-vendor-join"] }); toast({ title: "Vendor join draft saved." }); },
    onError: (error: Error) => toast({ title: "Draft not saved", description: error.message, variant: "destructive" }),
  });
  const publish = useMutation({
    mutationFn: (payload: { mode: "now" | "schedule"; scheduledAt?: string }) => adminJson<PageConfig>("/api/admin/vendor-join/publish", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-vendor-join"] });
      queryClient.invalidateQueries({ queryKey: ["storefront-vendor-join"] });
      toast({ title: variables.mode === "now" ? "Vendor join page published." : "Vendor join page scheduled." });
    },
    onError: (error: Error) => toast({ title: "Publish not completed", description: error.message, variant: "destructive" }),
  });

  const updateHero = <K extends keyof PageContent["hero"]>(key: K, value: PageContent["hero"][K]) => setDraft(current => current ? { ...current, hero: { ...current.hero, [key]: value } } : current);
  const updateBrief = <K extends keyof PageContent["brief"]>(key: K, value: PageContent["brief"][K]) => setDraft(current => current ? { ...current, brief: { ...current.brief, [key]: value } } : current);
  const updateForm = (key: FormTextKey, value: string) => setDraft(current => current ? { ...current, form: { ...current.form, [key]: value } } : current);
  const updateRules = (key: keyof PageContent["form"]["rules"], value: number) => setDraft(current => current ? { ...current, form: { ...current.form, rules: { ...current.form.rules, [key]: value } } } : current);
  const updateStatus = <K extends keyof PageContent["status"]>(key: K, value: PageContent["status"][K]) => setDraft(current => current ? { ...current, status: { ...current.status, [key]: value } } : current);
  const updateTheme = <K extends keyof PageContent["theme"]>(key: K, value: PageContent["theme"][K]) => setDraft(current => current ? { ...current, theme: { ...current.theme, [key]: value } } : current);
  const updateList = (area: "tags" | "lookingFor", index: number, value: string) => setDraft(current => current ? {
    ...current,
    ...(area === "tags" ? { hero: { ...current.hero, tags: current.hero.tags.map((item, itemIndex) => itemIndex === index ? value : item) } } : { brief: { ...current.brief, lookingFor: current.brief.lookingFor.map((item, itemIndex) => itemIndex === index ? value : item) } }),
  } : current);
  const updateOptions = (area: "categoryOptions" | "experienceOptions", index: number, key: "value" | "label", value: string) => setDraft(current => current ? ({ ...current, [area]: current[area].map((option, optionIndex) => optionIndex === index ? { ...option, [key]: value } : option) }) : current);
  const addOption = (area: "categoryOptions" | "experienceOptions") => setDraft(current => current && current[area].length < 12 ? ({ ...current, [area]: [...current[area], { label: "New option", value: "new-option" }] }) : current);
  const removeOption = (area: "categoryOptions" | "experienceOptions", index: number) => setDraft(current => current && current[area].length > 1 ? ({ ...current, [area]: current[area].filter((_, optionIndex) => optionIndex !== index) }) : current);

  if (config.isLoading || !draft) return <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading vendor join studio…</div>;
  const isDirty = JSON.stringify(draft) !== JSON.stringify(savedDraft);
  const requireSavedDraft = () => {
    if (!isDirty) return true;
    toast({ title: "Save the draft before publishing.", description: "Publishing always uses the most recently saved draft.", variant: "destructive" });
    return false;
  };
  return <div className="space-y-8" data-testid="admin-vendor-join">
    <div className="flex flex-col justify-between gap-4 border-b border-border pb-6 lg:flex-row lg:items-end"><div><p className="eyebrow">Vendor recruitment control</p><h1 className="mt-2 font-serif text-4xl font-medium tracking-tight">Vendor join studio</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Edit every visible part of the Join the Vanguard page, then save a draft, publish it, or schedule the next intake.</p>{isDirty ? <p className="mt-2 text-xs font-semibold text-amber-700">Unsaved changes — save this draft before publishing or scheduling.</p> : null}</div><div className="flex flex-wrap gap-2"><a href="/vendor-dashboard/apply" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-border px-3 py-2 text-xs font-bold uppercase tracking-widest hover:bg-secondary"><Eye className="h-3.5 w-3.5" /> View live page</a><button onClick={() => saveDraft.mutate(draft)} disabled={saveDraft.isPending || !isDirty} className="inline-flex items-center gap-2 border border-foreground px-3 py-2 text-xs font-bold uppercase tracking-widest hover:bg-secondary disabled:opacity-50"><Save className="h-3.5 w-3.5" /> Save draft</button><button onClick={() => { if (requireSavedDraft()) publish.mutate({ mode: "now" }); }} disabled={publish.isPending || isDirty} className="inline-flex items-center gap-2 bg-foreground px-4 py-2 text-xs font-bold uppercase tracking-widest text-background hover:bg-foreground/85 disabled:opacity-50"><Send className="h-3.5 w-3.5" /> Publish now</button></div></div>

    <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]"><div className="space-y-6">
      <EditorSection title="Hero and campaign">
        <TwoCol label="Call label" value={draft.hero.callLabel} onChange={value => updateHero("callLabel", value)} rightLabel="Intake label" rightValue={draft.hero.intakeLabel} onRightChange={value => updateHero("intakeLabel", value)} />
        <TextInput label="Hero eyebrow" value={draft.hero.eyebrow} onChange={value => updateHero("eyebrow", value)} />
        <TwoCol label="Headline line one" value={draft.hero.titleLine1} onChange={value => updateHero("titleLine1", value)} rightLabel="Headline line two" rightValue={draft.hero.titleLine2} onRightChange={value => updateHero("titleLine2", value)} />
        <TextArea label="Hero description" value={draft.hero.description} onChange={value => updateHero("description", value)} />
        <ListInputs title="Campaign tags" items={draft.hero.tags} onChange={(index, value) => updateList("tags", index, value)} />
      </EditorSection>
      <EditorSection title="Brief and guidance">
        <TwoCol label="Brief kicker" value={draft.brief.kicker} onChange={value => updateBrief("kicker", value)} rightLabel="What we’re looking for label" rightValue={draft.brief.lookingForLabel} onRightChange={value => updateBrief("lookingForLabel", value)} />
        <TextArea label="Brief headline" value={draft.brief.headline} onChange={value => updateBrief("headline", value)} />
        <ListInputs title="Curation points" items={draft.brief.lookingFor} onChange={(index, value) => updateList("lookingFor", index, value)} />
        <TextArea label="Payout / onboarding note" value={draft.brief.note} onChange={value => updateBrief("note", value)} />
      </EditorSection>
      <EditorSection title="Application form copy"><div className="grid gap-4 md:grid-cols-2">{formFields.map(([label, key, multiline]) => multiline ? <TextArea key={key} label={label} value={draft.form[key]} onChange={value => updateForm(key, value)} /> : <TextInput key={key} label={label} value={draft.form[key]} onChange={value => updateForm(key, value)} />)}</div><div className="mt-6 border-t border-border pt-5"><p className={labelClass}>Published form rules</p><p className="mt-1 text-xs text-muted-foreground">These values control the live applicant form and server validation.</p><div className="mt-3 grid gap-4 md:grid-cols-2"><NumberInput label="Minimum bio characters" value={draft.form.rules.bioMinLength} onChange={value => updateRules("bioMinLength", value)} min={20} max={1000} /><NumberInput label="Minimum sample images" value={draft.form.rules.minSamples} onChange={value => updateRules("minSamples", value)} min={1} max={10} /><NumberInput label="Maximum sample images" value={draft.form.rules.maxSamples} onChange={value => updateRules("maxSamples", value)} min={1} max={10} /><NumberInput label="Maximum image bytes" value={draft.form.rules.maxImageBytes} onChange={value => updateRules("maxImageBytes", value)} min={100000} max={10000000} /></div></div></EditorSection>
      <EditorSection title="Application status messages"><p className="text-xs text-muted-foreground">Use <code>{"{{brandName}}"}</code> inside the pending message to include the applicant’s brand name.</p><div className="mt-4 grid gap-4 md:grid-cols-2"><TextInput label="Pending label" value={draft.status.pendingLabel} onChange={value => updateStatus("pendingLabel", value)} /><TextInput label="Pending title" value={draft.status.pendingTitle} onChange={value => updateStatus("pendingTitle", value)} /><TextArea label="Pending message" value={draft.status.pendingDescription} onChange={value => updateStatus("pendingDescription", value)} /><TextInput label="Rejected label" value={draft.status.rejectedLabel} onChange={value => updateStatus("rejectedLabel", value)} /><TextInput label="Rejected title" value={draft.status.rejectedTitle} onChange={value => updateStatus("rejectedTitle", value)} /><TextArea label="Rejected message" value={draft.status.rejectedDescription} onChange={value => updateStatus("rejectedDescription", value)} /><TextInput label="Back link label" value={draft.status.backLabel} onChange={value => updateStatus("backLabel", value)} /><TextInput label="Back link path" value={draft.status.backHref} onChange={value => updateStatus("backHref", value)} /></div></EditorSection>
    </div>
      <aside className="space-y-6">
        <EditorSection title="Draft preview"><div className="overflow-hidden border p-5 text-white" style={{ background: `linear-gradient(135deg, ${draft.theme.backgroundStart}, ${draft.theme.ink} 55%, ${draft.theme.backgroundEnd})` }}><p className="text-[10px] font-bold uppercase tracking-[.2em]" style={{ color: draft.theme.cyan }}>{draft.hero.eyebrow}</p><h2 className="mt-4 font-serif text-4xl font-black uppercase leading-none" style={{ textShadow: `2px 0 ${draft.theme.pink}, -2px 0 ${draft.theme.cyan}` }}>{draft.hero.titleLine1}<br /><span style={{ color: draft.theme.acid }}>{draft.hero.titleLine2}</span></h2><p className="mt-5 border-l-2 pl-3 text-xs leading-relaxed text-white/75" style={{ borderColor: draft.theme.pink }}>{draft.hero.description}</p><div className="mt-5 flex flex-wrap gap-1.5">{draft.hero.tags.map(tag => <span key={tag} className="border border-white/30 px-2 py-1 text-[8px] uppercase">{tag}</span>)}</div></div><p className="mt-3 text-xs text-muted-foreground">This reflects your current unsaved draft. Use “View live page” to check the published version.</p></EditorSection>
        <EditorSection title="Form select options"><OptionEditor title="Categories" options={draft.categoryOptions} onChange={(index, key, value) => updateOptions("categoryOptions", index, key, value)} onAdd={() => addOption("categoryOptions")} onRemove={index => removeOption("categoryOptions", index)} /><OptionEditor title="Experience levels" options={draft.experienceOptions} onChange={(index, key, value) => updateOptions("experienceOptions", index, key, value)} onAdd={() => addOption("experienceOptions")} onRemove={index => removeOption("experienceOptions", index)} /></EditorSection>
        <EditorSection title="Visual accents"><div className="space-y-3">{([["acid", "Lime accent"], ["pink", "Magenta accent"], ["cyan", "Cyan accent"], ["ink", "Ink base"], ["backgroundStart", "Background start"], ["backgroundEnd", "Background end"]] as Array<[keyof PageContent["theme"], string]>).map(([key, label]) => <label key={key} className={labelClass}>{label}<span className="mt-1 flex border border-border bg-background"><input type="color" value={draft.theme[key]} onChange={event => updateTheme(key, event.target.value)} className="h-10 w-12 cursor-pointer border-0 bg-transparent p-1" /><input value={draft.theme[key]} onChange={event => updateTheme(key, event.target.value)} className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none" /></span></label>)}<TextInput label="Grid opacity (0 to 1)" value={draft.theme.gridOpacity} onChange={value => updateTheme("gridOpacity", value)} /></div></EditorSection>
        <div className="border border-border bg-secondary/40 p-5 md:p-6"><div className="flex items-center gap-2"><Clock3 className="h-4 w-4" /><h2 className="font-serif text-2xl">Schedule an intake</h2></div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">The current published vendor page stays live until the scheduled moment, then the saved draft becomes public.</p><input type="datetime-local" value={scheduleAt} onChange={event => setScheduleAt(event.target.value)} className={`${inputClass} mt-4`} /><button onClick={() => { if (!scheduleAt) { toast({ title: "Choose a publish time first.", variant: "destructive" }); return; } if (requireSavedDraft()) publish.mutate({ mode: "schedule", scheduledAt: new Date(scheduleAt).toISOString() }); }} disabled={publish.isPending || isDirty} className="mt-3 flex w-full items-center justify-center gap-2 bg-foreground px-4 py-3 text-xs font-bold uppercase tracking-widest text-background disabled:opacity-50"><Clock3 className="h-3.5 w-3.5" /> Schedule saved draft</button>{config.data?.scheduledAt ? <p className="mt-3 text-xs text-muted-foreground">Scheduled: {new Date(config.data.scheduledAt).toLocaleString()}</p> : null}</div>
      </aside>
    </div>
  </div>;
}

function EditorSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="border border-border p-5 md:p-6"><div className="mb-5 flex items-center gap-2"><Palette className="h-4 w-4" /><h2 className="font-serif text-2xl">{title}</h2></div>{children}</section>; }
function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className={labelClass}>{label}<input value={value} onChange={event => onChange(event.target.value)} className={inputClass} /></label>; }
function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className={`${labelClass} block`}>{label}<textarea value={value} onChange={event => onChange(event.target.value)} className={`${inputClass} min-h-24 resize-y`} /></label>; }
function NumberInput({ label, value, onChange, min, max }: { label: string; value: number; onChange: (value: number) => void; min: number; max: number }) { return <label className={labelClass}>{label}<input type="number" min={min} max={max} value={value} onChange={event => onChange(Number(event.target.value))} className={inputClass} /></label>; }
function TwoCol({ label, value, onChange, rightLabel, rightValue, onRightChange }: { label: string; value: string; onChange: (value: string) => void; rightLabel: string; rightValue: string; onRightChange: (value: string) => void }) { return <div className="grid gap-4 md:grid-cols-2"><TextInput label={label} value={value} onChange={onChange} /><TextInput label={rightLabel} value={rightValue} onChange={onRightChange} /></div>; }
function ListInputs({ title, items, onChange }: { title: string; items: string[]; onChange: (index: number, value: string) => void }) { return <div className="mt-4"><p className={labelClass}>{title}</p><div className="mt-2 space-y-2">{items.map((item, index) => <input key={index} value={item} onChange={event => onChange(index, event.target.value)} className={inputClass} />)}</div></div>; }
function OptionEditor({ title, options, onChange, onAdd, onRemove }: { title: string; options: Array<{ value: string; label: string }>; onChange: (index: number, key: "value" | "label", value: string) => void; onAdd: () => void; onRemove: (index: number) => void }) { return <div className="mb-6 last:mb-0"><div className="flex items-center justify-between gap-3"><p className={labelClass}>{title}</p><button type="button" onClick={onAdd} disabled={options.length >= 12} className="border border-border px-2 py-1 text-[10px] font-bold uppercase tracking-wider hover:bg-secondary disabled:opacity-40">Add option</button></div><div className="mt-2 space-y-2">{options.map((option, index) => <div key={`${option.value}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><input value={option.label} onChange={event => onChange(index, "label", event.target.value)} className={inputClass} aria-label={`${title} label ${index + 1}`} /><input value={option.value} onChange={event => onChange(index, "value", event.target.value)} className={inputClass} aria-label={`${title} value ${index + 1}`} /><button type="button" onClick={() => onRemove(index)} disabled={options.length <= 1} className="mt-1 border border-border px-2 text-xs hover:bg-destructive/10 disabled:opacity-40" aria-label={`Remove ${title} option ${index + 1}`}>×</button></div>)}</div><p className="mt-2 text-[10px] text-muted-foreground">Left: visible label · Right: submitted value</p></div>; }