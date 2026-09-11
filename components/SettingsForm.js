"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadImage } from "@/lib/upload";
import { slugify } from "@/lib/utils";

const COLOURS = ["#0E5E4A", "#1F3A93", "#7A1F5C", "#9A3412", "#111827", "#5B21B6"];

export default function SettingsForm({ store, userId, siteUrl }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: store.name || "",
    slug: store.slug || "",
    description: store.description || "",
    whatsapp: store.whatsapp || "",
    phone: store.phone || "",
    address: store.address || "",
    brand_color: store.brand_color || "#0E5E4A",
    logo_url: store.logo_url || "",
    is_published: store.is_published,
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const update = (key) => (e) => {
    setSaved(false);
    setForm({ ...form, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  };

  async function onLogo(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const url = await uploadImage(file, userId, "logo");
      setForm((f) => ({ ...f, logo_url: url }));
      setSaved(false);
    } catch (err) {
      setError(err.message);
    }
    setUploading(false);
  }

  async function save(e) {
    e.preventDefault();
    const slug = slugify(form.slug);
    if (slug.length < 3) return setError("Your store link needs at least 3 letters or numbers.");
    setSaving(true);
    setError("");
    const { error: dbError } = await createClient()
      .from("stores")
      .update({
        name: form.name.trim(),
        slug,
        description: form.description.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        brand_color: form.brand_color,
        logo_url: form.logo_url || null,
        is_published: form.is_published,
      })
      .eq("id", store.id);
    setSaving(false);
    if (dbError) {
      if (dbError.code === "23505") return setError("That store link is taken. Try a different one.");
      return setError(`Settings weren't saved: ${dbError.message}`);
    }
    setForm((f) => ({ ...f, slug }));
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="panel space-y-4">
        <h2 className="font-semibold">Brand</h2>
        <div className="flex items-center gap-4">
          {form.logo_url ? (
            <img src={form.logo_url} alt="Store logo" className="h-16 w-16 rounded-2xl object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold text-white" style={{ background: form.brand_color }}>
              {form.name.charAt(0).toUpperCase() || "S"}
            </div>
          )}
          <label className="btn-secondary cursor-pointer">
            {uploading ? "Uploading…" : form.logo_url ? "Change logo" : "Upload logo"}
            <input type="file" accept="image/*" className="sr-only" onChange={onLogo} disabled={uploading} />
          </label>
          {form.logo_url && (
            <button type="button" className="btn-danger" onClick={() => setForm({ ...form, logo_url: "" })}>Remove</button>
          )}
        </div>
        <div>
          <span className="label">Store colour</span>
          <div className="flex flex-wrap items-center gap-2">
            {COLOURS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Use colour ${c}`}
                onClick={() => setForm({ ...form, brand_color: c })}
                className={`h-9 w-9 rounded-full ring-offset-2 ${form.brand_color === c ? "ring-2 ring-ink" : ""}`}
                style={{ background: c }}
              />
            ))}
            <input type="color" value={form.brand_color} onChange={update("brand_color")} className="h-9 w-12 cursor-pointer rounded-lg border border-line" aria-label="Pick any colour" />
          </div>
          <p className="hint">Pick a dark colour so white text on it stays easy to read.</p>
        </div>
      </div>

      <div className="panel space-y-4">
        <h2 className="font-semibold">Store details</h2>
        <div>
          <label className="label" htmlFor="name">Business name</label>
          <input id="name" required className="input" value={form.name} onChange={update("name")} />
        </div>
        <div>
          <label className="label" htmlFor="slug">Store link</label>
          <input id="slug" required className="input" value={form.slug} onChange={update("slug")} />
          <p className="hint break-all">{siteUrl}/s/{slugify(form.slug) || "your-store"}</p>
        </div>
        <div>
          <label className="label" htmlFor="description">About your business</label>
          <textarea id="description" rows={3} className="input" value={form.description} onChange={update("description")} placeholder="What you sell, delivery areas, how long delivery takes…" />
        </div>
      </div>

      <div className="panel grid gap-4 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Contact</h2>
        <div>
          <label className="label" htmlFor="whatsapp">WhatsApp number</label>
          <input id="whatsapp" type="tel" className="input" value={form.whatsapp} onChange={update("whatsapp")} placeholder="0803 123 4567" />
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone number</label>
          <input id="phone" type="tel" className="input" value={form.phone} onChange={update("phone")} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="address">Shop address</label>
          <input id="address" className="input" value={form.address} onChange={update("address")} placeholder="Optional" />
        </div>
      </div>

      <label className="panel flex cursor-pointer items-center justify-between">
        <span>
          <span className="block font-semibold">Store is open</span>
          <span className="text-sm text-muted">Turn off to hide your store from customers.</span>
        </span>
        <input type="checkbox" className="h-5 w-5 accent-kola" checked={form.is_published} onChange={update("is_published")} />
      </label>

      {error && <p className="error">{error}</p>}
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={saving || uploading}>{saving ? "Saving…" : "Save settings"}</button>
        {saved && <span className="text-sm font-medium text-kola">Settings saved</span>}
      </div>
    </form>
  );
}
