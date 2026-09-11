import { notFound } from "next/navigation";
import { getMyStore } from "@/lib/store";
import ProductForm from "@/components/ProductForm";

export default async function EditProductPage({ params }) {
  const { supabase, store, user } = await getMyStore();
  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", params.id)
    .eq("store_id", store.id)
    .maybeSingle();
  if (!product) notFound();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Edit product</h1>
      <ProductForm storeId={store.id} userId={user.id} product={product} />
    </div>
  );
}
