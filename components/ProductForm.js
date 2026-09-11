"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, ImagePlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadImage } from "@/lib/upload";

const MAX_PHOTOS = 4;

export default function ProductForm({ storeId, userId, product }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: product?.name ?? "",
    description: product?.description ?? "",
    price: product?.price ?? "",
    compare_at_price: product?.compare_at_price ?? "",
    stock: product?.stock ?? 1,
    is_active: product?.is_active ?? true,
  });
  const [images, setImages] = useState(product?.image_urls ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = (key) => (e) =>
    setForm({ ...form, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function onFiles(e) {
    const files = Array.from(e.target.files || []).slice(0, MAX_PHOTOS - images.length);
    e.target.value = "";
    if (!files.length) return;
    setUploading(true);
    setError("");
    for (const file of files) {
      try {
        const url = await uploadImage(file, userId, "products");
        setImages((prev) => [...prev, url]);
      } catch (err) {
        setError(err.message);
      }
    }
    setUploading(false);
  }

  async function save(e) {
    e.preventDefault();
    if (!form.name.trim() || form.price === "") return setError("Add a product name and price.");
    setSaving(true);
    setError("");
    const supabase = createClient();
    const payload = {
      store_id: storeId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: Number(form.price),
      compare_at_price: form.compare_at_price === "" || form.compare_at_price === null ? null : Number(form.compare_at_price),
      stock: parseInt(form.stock || 0, 10),
      is_active: form.is_active,
      image_urls: images,
    };
    const { error: dbError } = product
      ? await supabase.from("products").update(payload).eq("id", product.id)
      : await supabase.from("products").insert(payload);
    setSaving(false);
    if (dbError) return setError(`The product wasn't saved: ${dbError.message}`);
    router.push("/dashboard/products");
    router.refresh();
  }

  async function remove() {
    if (!window.confirm("Delete this product? This can't be undone.")) return;
    const supabase = createClient();
    const { error: dbError } = await supabase.from("products").delete().eq("id", product.id);
    if (dbError) return setError(`The product wasn't deleted: ${dbError.message}`);
    router.push("/dashboard/products");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="panel space-y-4">
        <div>
          <span className="label">Photos</span>
          <div className="grid grid-cols-4 gap-3">
            {images.map((url) => (
              <div key={url} className="relative aspect-square overflow-hidden rounded-xl border border-line">
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImages(images.filter((u) => u !== url))}
                  className="absolute right-1 top-1 rounded-full bg-white/90 p-1"
                  aria-label="Remove photo"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {images.length < MAX_PHOTOS && (
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line text-xs text-muted hover:border-kola">
                <ImagePlus size={20} />
                {uploading ? "Uploading…" : "Add photo"}
                <input type="file" accept="image/*" multiple className="sr-only" onChange={onFiles} disabled={uploading} />
              </label>
            )}
          </div>
          <p className="hint">Up to {MAX_PHOTOS} photos. The first one shows on your store.</p>
        </div>

        <div>
          <label className="label" htmlFor="name">Product name</label>
          <input id="name" className="input" value={form.name} onChange={update("name")} placeholder="e.g. Ankara two-piece set" />
        </div>
        <div>
          <label className="label" htmlFor="description">Description</label>
          <textarea id="description" rows={4} className="input" value={form.description} onChange={update("description")} placeholder="Sizes, colours, material, what's included…" />
        </div>
      </div>

      <div className="panel grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="price">Price (₦)</label>
          <input id="price" type="number" min="0" step="1" inputMode="numeric" className="input" value={form.price} onChange={update("price")} />
        </div>
        <div>
          <label className="label" htmlFor="compare">Old price (₦)</label>
          <input id="compare" type="number" min="0" step="1" inputMode="numeric" className="input" value={form.compare_at_price ?? ""} onChange={update("compare_at_price")} />
          <p className="hint">Optional. Shows as a slashed price.</p>
        </div>
        <div>
          <label className="label" htmlFor="stock">Quantity in stock</label>
          <input id="stock" type="number" min="0" step="1" inputMode="numeric" className="input" value={form.stock} onChange={update("stock")} />
        </div>
      </div>

      <label className="panel flex cursor-pointer items-center justify-between">
        <span>
          <span className="block font-semibold">Show on my store</span>
          <span className="text-sm text-muted">Turn off to hide it without deleting it.</span>
        </span>
        <input type="checkbox" className="h-5 w-5 accent-kola" checked={form.is_active} onChange={update("is_active")} />
      </label>

      {error && <p className="error">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={saving || uploading}>{saving ? "Saving…" : product ? "Save changes" : "Add product"}</button>
        <button type="button" className="btn-secondary" onClick={() => router.back()}>Cancel</button>
        {product && <button type="button" className="btn-danger ml-auto" onClick={remove}>Delete product</button>}
      </div>
    </form>
  );
}
