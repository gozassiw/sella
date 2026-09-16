import { getMyStore } from "@/lib/store";
import ProductForm from "@/components/ProductForm";

const planNames = { starter: "Starter", basic: "Basic", plus: "Plus", premium: "Premium", quarterly: "Basic", biannual: "Plus", yearly: "Premium" };

export default async function NewProductPage() {
  const { supabase, store, user } = await getMyStore();
  const [{ count: productCount }, { data: effectivePlan }, { data: productLimit }] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", store.id).eq("is_active", true),
    supabase.rpc("effective_seller_plan", { p_store_id: store.id }),
    supabase.rpc("seller_plan_limit", { p_store_id: store.id }),
  ]);
  const planName = planNames[effectivePlan || store.plan] || "Starter";
  const limit = productLimit === null || productLimit === undefined ? null : Number(productLimit);
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Add product</h1><p className="mt-1 text-sm text-muted">{limit === null ? `${planName} plan: unlimited active product listings.` : `${planName} plan: ${productCount || 0} of ${limit} active product listings used.`}</p></div>
      <ProductForm storeId={store.id} userId={user.id} productLimit={limit} activeProductCount={Number(productCount || 0)} planName={planName} />
    </div>
  );
}
