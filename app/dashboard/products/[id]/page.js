import { notFound } from "next/navigation";
import { getMyStore } from "@/lib/store";
import ProductForm from "@/components/ProductForm";

const planNames = { starter: "Starter", basic: "Basic", plus: "Plus", premium: "Premium", quarterly: "Basic", biannual: "Plus", yearly: "Premium" };

export default async function EditProductPage({ params }) {
  const { supabase, store, user } = await getMyStore();
  const [{ data: product }, { count: productCount }, { data: effectivePlan }, { data: productLimit }] = await Promise.all([
    supabase.from("products").select("*").eq("id", params.id).eq("store_id", store.id).maybeSingle(),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", store.id).eq("is_active", true),
    supabase.rpc("effective_seller_plan", { p_store_id: store.id }),
    supabase.rpc("seller_plan_limit", { p_store_id: store.id }),
  ]);
  if (!product) notFound();
  const planName = planNames[effectivePlan || store.plan] || "Starter";
  const limit = productLimit === null || productLimit === undefined ? null : Number(productLimit);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Edit product</h1>
      <ProductForm storeId={store.id} userId={user.id} product={product} productLimit={limit} activeProductCount={Number(productCount || 0)} planName={planName} />
    </div>
  );
}
