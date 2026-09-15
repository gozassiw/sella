import { getMyStore } from "@/lib/store";
import { formatNaira } from "@/lib/utils";
import SubscriptionForm from "@/components/SubscriptionForm";

const plans = [
  { id: "basic", name: "Basic", label: "3 months", amount: 7500, commission: "3%", benefit: "A simple starting plan for running your store." },
  { id: "plus", name: "Plus", label: "6 months", amount: 14000, commission: "2.8%", benefit: "A lower commission rate for growing sellers." },
  { id: "premium", name: "Premium", label: "12 months", amount: 25000, commission: "2.5%", benefit: "The lowest commission rate for established sellers." },
];

export default async function BillingPage() {
  const { supabase, store } = await getMyStore();
  const { data: subscriptions } = await supabase.from("subscriptions").select("plan,amount,paid_with,started_at,expires_at,status,payment_reference,paid_at").eq("store_id", store.id).order("started_at", { ascending: false }).limit(10);
  const trialDays = store.trial_starts_at ? Math.max(0, Math.ceil((new Date(store.trial_ends_at) - new Date()) / 86400000)) : null;
  return <div className="space-y-6">
    <div><p className="eyebrow text-kola">Plans & billing</p><h1 className="display mt-2 text-3xl">Keep your store moving</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Approved sellers receive a 10-day free trial with up to 15 products. When you choose a plan, Sella creates a one-time payment account for the exact plan amount and activates it after confirmation.</p></div>
    <section className="panel max-w-3xl"><h2 className="font-semibold">Why do I need a plan?</h2><p className="mt-2 text-sm leading-6 text-muted">After your 10-day free trial, a paid plan keeps your store open and visible to buyers so you can continue taking orders. It helps fund store hosting, protect buyer payments, and keep Sella running.</p></section>
    {trialDays !== null && <div className="rounded-2xl bg-kola-light p-4 text-sm text-kola"><strong>{trialDays} days remain</strong> in your 10-day trial. You can list up to 15 products during the trial.</div>}
    <section><div className="grid gap-4 md:grid-cols-3">{plans.map((plan) => <div key={plan.id} className="panel"><p className="font-semibold">{plan.name}</p><p className="mt-1 text-sm text-muted">{plan.label}</p><p className="mt-2 text-2xl font-bold">{formatNaira(plan.amount)}</p><div className="mt-4 rounded-xl bg-kola-light p-3"><p className="text-xs font-extrabold uppercase tracking-wide text-kola">Plan benefit</p><p className="mt-1 text-sm font-semibold text-kola">{plan.commission} commission per paid order</p><p className="mt-1 text-xs leading-5 text-muted">{plan.benefit}</p></div><div className="mt-4"><SubscriptionForm storeId={store.id} plan={plan.id} amount={plan.amount} /></div></div>)}</div><p className="mt-4 text-xs leading-5 text-muted">Commission is calculated from each paid order using the seller&apos;s active plan: Basic 3%, Plus 2.8%, or Premium 2.5%.</p></section>
    <section className="panel"><h2 className="font-semibold">Subscription history</h2><div className="mt-4 space-y-3">{subscriptions?.length ? subscriptions.map((item, index) => <div key={`${item.plan}-${index}`} className="flex flex-wrap justify-between gap-2 border-b border-line pb-3 text-sm"><span className="capitalize">{item.plan} · {item.paid_with}</span><span className={item.status === "paid" ? "font-bold text-success" : "text-muted"}>{item.status || "pending"}</span></div>) : <p className="text-sm text-muted">No subscription payments yet.</p>}</div></section>
  </div>;
}
