import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

function publicClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function getPublicStore(slug) {
  const client = publicClient();
  if (!client) return null;
  const { data } = await client.from("stores").select("id,name,slug,seller_code,seller_code_active,order_access_suspended,description,whatsapp,phone,address,logo_url,brand_color,is_published,approval_status,rejection_reason,paid_verification_approved").eq("slug", slug).in("approval_status", ["approved", "pending"]).maybeSingle();
  if (!data) return null;
  const { data: activeVerification } = await client.rpc("store_has_active_paid_verification", { p_store_id: data.id });
  return { ...data, paid_verification_approved: Boolean(activeVerification) };
}

export async function getPublicProducts(storeId) {
  const client = publicClient();
  if (!client) return [];
  const { data } = await client.from("products").select("id,store_id,name,price,compare_at_price,stock,image_urls").eq("store_id", storeId).eq("is_active", true).order("created_at", { ascending: false });
  return data || [];
}

export async function getPublicProduct(storeId, productId) {
  const client = publicClient();
  if (!client) return null;
  const { data } = await client.from("products").select("id,store_id,name,description,price,compare_at_price,stock,image_urls,is_active").eq("id", productId).eq("store_id", storeId).eq("is_active", true).maybeSingle();
  return data;
}

export function getPublicHomeSamples() {
  return unstable_cache(async () => {
    const client = publicClient();
    if (!client) return { stores: [], products: [] };
    const [{ data: verifiedRows }, { data: products }] = await Promise.all([
      client.rpc("get_public_verified_store_ids"),
      client.from("products").select("id,name,price,image_urls,stores(name,slug)").eq("is_active", true).order("created_at", { ascending: false }).limit(8),
    ]);
    const verifiedIds = (verifiedRows || []).map((row) => row.store_id).filter(Boolean);
    const { data: stores } = verifiedIds.length ? await client.from("stores").select("id,name,slug,category,logo_url,brand_color,paid_verification_approved").eq("is_published", true).eq("approval_status", "approved").in("id", verifiedIds).order("created_at", { ascending: false }).limit(6) : { data: [] };
    return { stores: stores || [], products: products || [] };
  }, ["public-home-samples"], { revalidate: 60 })();
}
