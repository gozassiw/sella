import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function publicClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function getPublicStore(slug) {
  const client = publicClient();
  if (!client) return null;
  const { data } = await client.from("stores").select("id,name,slug,seller_code,seller_code_active,order_access_suspended,description,delivery_note,verification_approved,whatsapp,phone,address,logo_url,brand_color,is_published,approval_status,rejection_reason,paid_verification_approved").eq("slug", slug).in("approval_status", ["approved", "pending"]).maybeSingle();
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

// No marketplace-wide store or product discovery. Shared store links remain available.
export async function getPublicHomeSamples() { return { stores: [], products: [] }; }
