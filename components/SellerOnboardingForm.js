"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, FileCheck2, MapPin, ShieldCheck, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { slugify, storeUrl } from "@/lib/utils";
import { uploadDocument } from "@/lib/upload";
import AuthShell from "@/components/AuthShell";
import Link from "next/link";

const CATEGORIES = ["Fashion & clothing", "Food & drinks", "Beauty & hair", "Phones & electronics", "Home & kitchen", "Health & wellness", "Kids & babies", "Other"];

export default function SellerOnboardingForm({ userId, siteUrl, initialStore = null, initialBank = null }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: initialStore?.name || "",
    slug: initialStore?.slug || "",
    category: initialStore?.category || CATEGORIES[0],
    description: initialStore?.description || "",
    whatsapp: initialStore?.whatsapp || "",
    phone: initialStore?.phone || "",
    address: initialStore?.address || "",
    legalName: initialStore?.legal_name || "",
    nin: initialStore?.nin || "",
    cacNumber: initialStore?.cac_number || "",
    cacFileUrl: initialStore?.cac_file_url || "",
    bankName: initialBank?.bank_name || "",
    accountNumber: initialBank?.account_number || "",
    accountName: initialBank?.account_name || "",
  });
  const [slugEdited, setSlugEdited] = useState(Boolean(initialStore?.slug));
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateName(value) {
    setForm((current) => ({ ...current, name: value, ...(slugEdited ? {} : { slug: slugify(value) }) }));
  }

  async function uploadCac(file) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const url = await uploadDocument(file, userId, "verification");
      update("cacFileUrl", url);
    } catch (uploadError) {
      setError(uploadError.message);
    }
    setUploading(false);
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    const slug = slugify(form.slug);
    const nin = form.nin.replace(/\D/g, "");
    if (slug.length < 3) return setError("Your store link needs at least 3 letters or numbers.");
    if (!form.name.trim() || !form.legalName.trim()) return setError("Business name and legal name are required.");
    if (!form.address.trim()) return setError("A store or pickup address is required.");
    if (nin.length !== 11) return setError("Enter an 11-digit NIN. Sella Team will validate it during review.");
    if (!form.bankName.trim() || !form.accountNumber.trim() || !form.accountName.trim()) return setError("Payout bank name, account number, and account name are required.");
    if (!accepted) return setError("Please accept the Terms of Use and Privacy & Anti-Piracy Policy before submitting for verification.");
    setSaving(true);
    const supabase = createClient();
    const storePayload = {
      owner_id: userId,
      name: form.name.trim(),
      slug,
      category: form.category,
      description: form.description.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim(),
      legal_name: form.legalName.trim(),
      nin,
      nin_status: "pending",
      cac_number: form.cacNumber.trim() || null,
      cac_file_url: form.cacFileUrl || null,
      onboarding_submitted_at: new Date().toISOString(),
      is_published: false,
    };
    let storeId = initialStore?.id;
    let storeError;
    if (storeId) {
      const result = await supabase.from("stores").update({ ...storePayload, owner_id: undefined }).eq("id", storeId).eq("owner_id", userId).select("id").single();
      storeError = result.error;
    } else {
      const result = await supabase.from("stores").insert(storePayload).select("id").single();
      storeId = result.data?.id;
      storeError = result.error;
    }
    if (storeError) {
      setSaving(false);
      if (storeError.code === "23505") return setError("That store link is already taken. Choose another one.");
      return setError(storeError.message);
    }
    const bankResponse = await fetch("/api/ops", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "bank_account", storeId, bankName: form.bankName.trim(), accountNumber: form.accountNumber.trim(), accountName: form.accountName.trim() }) });
    const bankResult = await bankResponse.json().catch(() => ({}));
    setSaving(false);
    if (!bankResponse.ok) return setError(`Store saved, but payout details could not be saved: ${bankResult.error || "Please try again."}`);
    const { error: consentError } = await supabase.from("account_consents").upsert({ user_id: userId, terms_version: "2026-09-12", privacy_version: "2026-09-12", source: "seller-verification", accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (consentError) return setError(`Store saved, but your policy consent could not be recorded: ${consentError.message}`);
    await supabase.rpc("notify_platform_admins", { p_type: "verification", p_title: "New seller submission", p_body: `${form.name.trim()} is waiting for Sella verification.`, p_link: "/admin#approvals" });
    router.push("/dashboard?submitted=1");
    router.refresh();
  }

  const linkPreview = storeUrl(siteUrl, slugify(form.slug) || "your-store");
  const isResubmission = Boolean(initialStore?.id);
  return (
    <AuthShell title={isResubmission ? "Update your seller onboarding" : "Complete seller onboarding"} subtitle="Sella Team reviews your store before it can go live or accept orders.">
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[{ icon: Building2, label: "Store details" }, { icon: ShieldCheck, label: "Identity review" }, { icon: FileCheck2, label: "Payout setup" }].map(({ icon: Icon, label }) => <div key={label} className="flex items-center gap-2 rounded-2xl bg-kola-light px-3 py-3 text-xs font-bold text-kola"><Icon size={16} />{label}</div>)}
      </div>
      <form onSubmit={submit} className="space-y-6">
        <section className="space-y-4"><div><p className="eyebrow text-kola">01 · Store</p><h2 className="mt-1 text-xl font-extrabold">Tell buyers what you sell</h2></div><div className="grid gap-4 sm:grid-cols-2"><div><label className="label" htmlFor="name">Business name *</label><input id="name" required className="input" value={form.name} onChange={(e) => updateName(e.target.value)} placeholder="Ada's Closet" /></div><div><label className="label" htmlFor="category">Category *</label><select id="category" className="input" value={form.category} onChange={(e) => update("category", e.target.value)}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></div><div className="sm:col-span-2"><label className="label" htmlFor="slug">Store link *</label><input id="slug" required className="input" value={form.slug} onChange={(e) => { setSlugEdited(true); update("slug", e.target.value.toLowerCase()); }} /><p className="hint break-all">Your store will appear at {linkPreview}</p></div><div className="sm:col-span-2"><label className="label" htmlFor="description">Store description</label><textarea id="description" rows={4} className="input" value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="What makes your store useful to buyers?" /></div><div className="sm:col-span-2"><label className="label" htmlFor="address">Store or pickup address *</label><div className="relative"><MapPin size={17} className="pointer-events-none absolute left-4 top-4 text-muted" /><input id="address" required className="input pl-11" value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="Required for verification and fulfilment" /></div><p className="hint">A physical store address or pickup location is required.</p></div></div></section>
        <section className="space-y-4 border-t border-line pt-6"><div><p className="eyebrow text-kola">02 · Identity</p><h2 className="mt-1 text-xl font-extrabold">Verify the person behind the store</h2><p className="mt-2 text-sm leading-6 text-muted">Your NIN is required. Sella Team validates it during review. CAC details are optional.</p></div><div className="grid gap-4 sm:grid-cols-2"><div><label className="label" htmlFor="legalName">Legal name *</label><input id="legalName" required className="input" value={form.legalName} onChange={(e) => update("legalName", e.target.value)} placeholder="Name on your NIN" /></div><div><label className="label" htmlFor="nin">NIN *</label><input id="nin" required className="input" inputMode="numeric" minLength={11} maxLength={11} value={form.nin} onChange={(e) => update("nin", e.target.value.replace(/\D/g, "").slice(0, 11))} placeholder="11 digits" /><p className="hint">Status: pending Sella Team validation</p></div><div><label className="label" htmlFor="cacNumber">CAC number <span className="font-normal text-muted">(optional)</span></label><input id="cacNumber" className="input" value={form.cacNumber} onChange={(e) => update("cacNumber", e.target.value)} placeholder="If your business is registered" /></div><div><label className="label" htmlFor="cacUpload">CAC certificate <span className="font-normal text-muted">(optional)</span></label><label className="input flex cursor-pointer items-center gap-3"><Upload size={17} className="text-kola" /><span className="min-w-0 flex-1 truncate text-sm">{uploading ? "Uploading…" : form.cacFileUrl ? "Certificate uploaded" : "Upload PDF or image"}</span><input id="cacUpload" type="file" accept="application/pdf,image/*" className="sr-only" onChange={(e) => uploadCac(e.target.files?.[0])} disabled={uploading} /></label>{form.cacFileUrl && <p className="hint flex items-center gap-1 text-success"><CheckCircle2 size={14} /> CAC document attached</p>}</div></div></section>
        <section className="space-y-4 border-t border-line pt-6"><div><p className="eyebrow text-kola">03 · Payout</p><h2 className="mt-1 text-xl font-extrabold">Where should approved payouts go?</h2><p className="mt-2 text-sm leading-6 text-muted">These details are saved for Sella Team review and withdrawal processing.</p></div><div className="grid gap-4 sm:grid-cols-2"><div><label className="label" htmlFor="bankName">Bank name *</label><input id="bankName" required className="input" value={form.bankName} onChange={(e) => update("bankName", e.target.value)} placeholder="e.g. GTBank" /></div><div><label className="label" htmlFor="accountNumber">Account number *</label><input id="accountNumber" required className="input" inputMode="numeric" value={form.accountNumber} onChange={(e) => update("accountNumber", e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10 digits" /></div><div className="sm:col-span-2"><label className="label" htmlFor="accountName">Account name *</label><input id="accountName" required className="input" value={form.accountName} onChange={(e) => update("accountName", e.target.value)} placeholder="Name on the bank account" /></div><div><label className="label" htmlFor="whatsapp">WhatsApp number</label><input id="whatsapp" type="tel" className="input" value={form.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} placeholder="Optional customer contact" /></div><div><label className="label" htmlFor="phone">Phone number</label><input id="phone" type="tel" className="input" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="Optional" /></div></div></section>
        {error && <p className="error">{error}</p>}
        <div className="rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-warning"><strong>What happens next?</strong><br />Submit these details and your store will remain private while Sella Team validates your NIN and reviews the business. You cannot receive orders or publish products until approval.</div>
        <label className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-xs leading-5 text-muted"><input type="checkbox" className="mt-1 h-4 w-4 accent-kola" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} required /><span>I agree to Sella&apos;s <Link href="/terms" target="_blank" className="font-bold text-kola underline">Terms of Use</Link> and <Link href="/privacy" target="_blank" className="font-bold text-kola underline">Privacy & Anti-Piracy Policy</Link>, including the seller responsibility and anti-piracy rules.</span></label>
        <button className="btn-primary w-full" disabled={saving || uploading}>{saving ? "Submitting for review…" : isResubmission ? "Resubmit for verification" : "Submit for Sella verification"}</button>
      </form>
    </AuthShell>
  );
}
