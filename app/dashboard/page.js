import Link from "next/link";
import { Check } from "lucide-react";
import { getMyStore } from "@/lib/store";
import ShareStore from "@/components/ShareStore";
import { SITE_URL } from "@/lib/config";
import { storeUrl } from "@/lib/utils";

export default async function DashboardHome() {
  const { supabase, store } = await getMyStore();

  const [{ count: productCount }, { count: lowStockCount }] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", store.id),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", store.id).lte("stock", 3),
  ]);

  const steps = [
    { done: (productCount || 0) > 0, label: "Add your first product", href: "/dashboard/products/new" },
    { done: !!store.logo_url, label: "Upload your logo", href: "/dashboard/settings" },
    { done: !!store.whatsapp, label: "Add your WhatsApp number", href: "/dashboard/settings" },
  ];
  const trialDays = store.trial_starts_at ? Math.max(0, Math.ceil((new Date(store.trial_ends_at) - new Date()) / 86400000)) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome back</h1>
        {store.approval_status === "pending" && <div className="mt-3 rounded-2xl border border-mango bg-[#FFF8E7] p-4 text-sm"><p className="font-semibold">Your store is pending approval.</p><p className="mt-1 text-muted">You can keep adding products and completing your settings. Your store will become visible to buyers after review. Your 14-day free trial starts when your store is approved.</p></div>}
        {store.approval_status === "rejected" && <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p className="font-semibold">Your store needs attention before approval.</p>{store.rejection_reason && <p className="mt-1">{store.rejection_reason}</p>}</div>}
        {store.plan === "trial" && trialDays !== null && <p className="mt-1 text-sm text-muted">{trialDays} days left in your free trial.</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="panel">
          <p className="text-sm text-muted">Products</p>
          <p className="mt-1 text-3xl font-bold">{productCount || 0}</p>
        </div>
        <Link href="/dashboard/products" className="panel hover:border-kola">
          <p className="text-sm text-muted">Running low (3 or fewer)</p>
          <p className={`mt-1 text-3xl font-bold ${lowStockCount ? "text-red-700" : ""}`}>{lowStockCount || 0}</p>
        </Link>
      </div>

      {steps.some((s) => !s.done) && (
        <div className="panel">
          <h2 className="font-semibold">Get your store ready</h2>
          <ul className="mt-4 space-y-2">
            {steps.map((s) => (
              <li key={s.label}>
                <Link href={s.href} className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${s.done ? "border-kola bg-kola text-white" : "border-line"}`}>
                    {s.done && <Check size={14} strokeWidth={3} />}
                  </span>
                  <span className={s.done ? "text-muted line-through" : ""}>{s.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ShareStore url={storeUrl(SITE_URL, store.slug)} storeName={store.name} />
    </div>
  );
}
