import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

function publicClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function getPublicStore(slug) {
  const client = publicClient();
  if (!client) return null;
  const { data } = await client.from("stores").select("id,name,slug,description,whatsapp,phone,address,logo_url,brand_color,is_published,approval_status,rejection_reason").eq("slug", slug).in("approval_status", ["approved", "pending"]).maybeSingle();
  return data;
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
    const [{ data: stores }, { data: products }] = await Promise.all([
      client.from("stores").select("id,name,slug,category,logo_url,brand_color").eq("is_published", true).eq("approval_status", "approved").order("created_at", { ascending: false }).limit(6),
      client.from("products").select("id,name,price,image_urls,stores(name,slug)").eq("is_active", true).order("created_at", { ascending: false }).limit(8),
    ]);
    return { stores: stores || [], products: products || [] };
  }, ["public-home-samples"], { revalidate: 60 })();
}
