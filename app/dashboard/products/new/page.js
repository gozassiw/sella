import { getMyStore } from "@/lib/store";
import ProductForm from "@/components/ProductForm";

export default async function NewProductPage() {
  const { supabase, store, user } = await getMyStore();
  const { count: productCount } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", store.id);
  const trialActive = store.plan === "trial" && store.trial_ends_at && new Date(store.trial_ends_at) > new Date();
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Add product</h1>{trialActive && <p className="mt-1 text-sm text-muted">Trial catalog: {productCount || 0} of 15 products used.</p>}</div>
      <ProductForm storeId={store.id} userId={user.id} trialProductLimitReached={Boolean(trialActive && Number(productCount || 0) >= 15)} />
    </div>
  );
}
