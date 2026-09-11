import Link from "next/link";
import { Plus, Package } from "lucide-react";
import { getMyStore } from "@/lib/store";
import { formatNaira } from "@/lib/utils";

export default async function ProductsPage() {
  const { supabase, store } = await getMyStore();
  const { data: products } = await supabase
    .from("products")
    .select("id,name,price,stock,image_urls,is_active")
    .eq("store_id", store.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Products</h1>
        <Link href="/dashboard/products/new" className="btn-primary"><Plus size={18} /> Add product</Link>
      </div>

      {!products?.length ? (
        <div className="panel flex flex-col items-center py-14 text-center">
          <Package size={32} className="text-muted" />
          <p className="mt-3 font-semibold">Add your first product</p>
          <p className="mt-1 max-w-xs text-sm text-muted">Once it's added, customers can see it on your store link.</p>
          <Link href="/dashboard/products/new" className="btn-primary mt-5">Add product</Link>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
          {products.map((p) => (
            <li key={p.id}>
              <Link href={`/dashboard/products/${p.id}`} className="flex items-center gap-4 p-3 hover:bg-surface">
                {p.image_urls?.[0] ? (
                  <img src={p.image_urls[0]} alt="" className="h-14 w-14 rounded-xl object-cover" />
                ) : (
                  <div className="h-14 w-14 rounded-xl bg-surface" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="text-sm text-muted">{formatNaira(p.price)}</p>
                </div>
                <div className="text-right text-sm">
                  <p className={p.stock <= 3 ? "font-semibold text-red-700" : "text-muted"}>
                    {p.stock <= 0 ? "Sold out" : `${p.stock} left`}
                  </p>
                  {!p.is_active && <p className="text-xs text-muted">Hidden</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
