"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "@/components/AuthShell";
import { slugify } from "@/lib/utils";

const CATEGORIES = ["Fashion & clothing", "Food & drinks", "Beauty & hair", "Phones & electronics", "Home & kitchen", "Health & wellness", "Kids & babies", "Other"];

export default function OnboardingForm({ userId, siteUrl }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function onName(value) {
    setName(value);
    if (!slugEdited) setSlug(slugify(value));
  }

  async function submit(e) {
    e.preventDefault();
    const cleanSlug = slugify(slug);
    if (cleanSlug.length < 3) return setError("Your store link needs at least 3 letters or numbers.");
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.from("stores").insert({
      owner_id: userId,
      name: name.trim(),
      slug: cleanSlug,
      category,
      whatsapp: whatsapp.trim() || null,
    });
    setLoading(false);
    if (error) {
      if (error.code === "23505") return setError("That store link is taken. Try a different one.");
      return setError(error.message);
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <AuthShell title="Set up your store" subtitle="You can change all of this later in Settings.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="name">Business name</label>
          <input id="name" required className="input" value={name} onChange={(e) => onName(e.target.value)} placeholder="e.g. Ada's Closet" />
        </div>
        <div>
          <label className="label" htmlFor="slug">Store link</label>
          <input
            id="slug"
            required
            className="input"
            value={slug}
            onChange={(e) => { setSlugEdited(true); setSlug(e.target.value.toLowerCase()); }}
          />
          <p className="hint break-all">{siteUrl}/s/{slugify(slug) || "your-store"}</p>
        </div>
        <div>
          <label className="label" htmlFor="category">What do you sell?</label>
          <select id="category" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="whatsapp">WhatsApp number</label>
          <input id="whatsapp" type="tel" className="input" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="0803 123 4567" />
          <p className="hint">Customers will use this to reach you.</p>
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn-primary w-full" disabled={loading}>{loading ? "Creating store…" : "Create my store"}</button>
      </form>
    </AuthShell>
  );
}
