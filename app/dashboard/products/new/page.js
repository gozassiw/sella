import { getMyStore } from "@/lib/store";
import ProductForm from "@/components/ProductForm";

export default async function NewProductPage() {
  const { store, user } = await getMyStore();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Add product</h1>
      <ProductForm storeId={store.id} userId={user.id} />
    </div>
  );
}
