import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

function publicClient() { return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } }); }
export function getPublicStore(slug) { return unstable_cache(async () => { const { data } = await publicClient().from("stores").select("id,name,slug,description,whatsapp,phone,address,logo_url,brand_color,is_published").eq("slug", slug).eq("is_published", true).maybeSingle(); return data; }, ["public-store", slug], { revalidate: 60 })(); }
export function getPublicProducts(storeId) { return unstable_cache(async () => { const { data } = await publicClient().from("products").select("id,store_id,name,price,compare_at_price,stock,image_urls").eq("store_id", storeId).eq("is_active", true).order("created_at", { ascending: false }); return data || []; }, ["public-products", storeId], { revalidate: 60 })(); }
export function getPublicProduct(storeId, productId) { return unstable_cache(async () => { const { data } = await publicClient().from("products").select("*").eq("id", productId).eq("store_id", storeId).eq("is_active", true).maybeSingle(); return data; }, ["public-product", storeId, productId], { revalidate: 60 })(); }
