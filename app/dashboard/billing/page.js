import { getMyStore } from "@/lib/store";
import { formatNaira } from "@/lib/utils";
import SubscriptionForm from "@/components/SubscriptionForm";

const plans = [{ id: "quarterly", label: "3 months", amount: 5000 }, { id: "biannual", label: "6 months", amount: 9000 }, { id: "yearly", label: "12 months", amount: 15000 }];
export default async function BillingPage() {
  const { supabase, store } = await getMyStore();
  const { data: subscriptions } = await supabase.from("subscriptions").select("plan,amount,paid_with,started_at,expires_at,status").eq("store_id", store.id).order("started_at", { ascending: false }).limit(10);
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Plans & billing</h1><p className="mt-1 text-sm text-muted">Your first 14 days are free. Choose a plan when you are ready to continue.</p></div><div className="grid gap-4 md:grid-cols-3">{plans.map((plan) => <div key={plan.id} className="panel"><p className="font-semibold">{plan.label}</p><p className="mt-2 text-2xl font-bold">{formatNaira(plan.amount)}</p><p className="mt-1 text-sm text-muted">One-time transfer or wallet payment.</p><div className="mt-4"><SubscriptionForm storeId={store.id} plan={plan.id} amount={plan.amount} /></div></div>)}</div><section className="panel"><h2 className="font-semibold">Subscription history</h2><div className="mt-4 space-y-3">{subscriptions?.length ? subscriptions.map((item, index) => <div key={`${item.plan}-${index}`} className="flex justify-between border-b border-line pb-3 text-sm"><span className="capitalize">{item.plan} · {item.paid_with}</span><span>{item.status || "pending"}</span></div>) : <p className="text-sm text-muted">No subscription payments yet.</p>}</div></section></div>;
}
