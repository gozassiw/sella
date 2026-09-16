import { getMyStore } from "@/lib/store";
import { formatNaira } from "@/lib/utils";
import SubscriptionForm from "@/components/SubscriptionForm";

const plans = [
  { id: "basic", name: "Basic", label: "3 months", amount: 7500, commission: "3%", benefit: "A simple starting plan for running your store.", rank: 1 },
  { id: "plus", name: "Plus", label: "6 months", amount: 14000, commission: "2.8%", benefit: "A lower commission rate for growing sellers.", rank: 2 },
  { id: "premium", name: "Premium", label: "12 months", amount: 25000, commission: "2.5%", benefit: "The lowest commission rate for established sellers.", rank: 3 },
];
const planRanks = { basic: 1, plus: 2, premium: 3, quarterly: 1, biannual: 2, yearly: 3 };
const planNames = { basic: "Basic", plus: "Plus", premium: "Premium", quarterly: "Basic", biannual: "Plus", yearly: "Premium" };

function StatusBadge({ status }) {
  const tone = status === "paid" || status === "active" ? "bg-green-50 text-success" : status === "pending" ? "bg-amber-50 text-warning" : "bg-surface text-muted";
  return <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide ${tone}`}>{status || "pending"}</span>;
}

export default async function BillingPage() {
  const { supabase, store } = await getMyStore();
  const [{ data: wallet }, { data: subscriptions }] = await Promise.all([
    supabase.from("wallets").select("available").eq("store_id", store.id).maybeSingle(),
    supabase.from("subscriptions").select("id,plan,amount,paid_with,started_at,expires_at,status,payment_reference,paid_at,payment_account_expires_at").eq("store_id", store.id).order("started_at", { ascending: false }).limit(20),
  ]);
  const balance = Number(wallet?.available || 0);
  const activePlan = (subscriptions || []).find((item) => ["paid", "active"].includes(item.status) && item.expires_at && new Date(item.expires_at) > new Date());
  const trialDays = !activePlan && store.trial_starts_at ? Math.max(0, Math.ceil((new Date(store.trial_ends_at) - new Date()) / 86400000)) : null;
  const activeRank = activePlan ? planRanks[activePlan.plan] : 0;

  return <div className="space-y-6">
    <div><p className="eyebrow text-kola">Plans & billing</p><h1 className="display mt-2 text-3xl">Keep your store moving</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Approved sellers receive a 10-day free trial with up to 15 products. When you choose a plan, Sella creates a one-time payment account for the exact plan amount and activates it after confirmation.</p></div>
    {activePlan ? <div className="rounded-2xl bg-green-50 p-4 text-sm font-extrabold text-success">{planNames[activePlan.plan]} plan active until {new Date(activePlan.expires_at).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}.</div> : trialDays !== null && <div className="rounded-2xl bg-kola-light p-4 text-sm text-kola"><strong>{trialDays} days remain</strong> in your 10-day trial. You can list up to 15 products during the trial.</div>}
    <section className="panel max-w-3xl"><h2 className="font-semibold">Why do I need a plan?</h2><p className="mt-2 text-sm leading-6 text-muted">After your 10-day free trial, a paid plan keeps your store open and visible to buyers so you can continue taking orders. It helps fund store hosting, protect buyer payments, and keep Sella running.</p></section>
    <section><div className="mb-4 rounded-2xl border border-line bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-muted">Available seller balance</p><p className="mt-1 text-2xl font-extrabold text-kola">{formatNaira(balance)}</p><p className="mt-1 text-xs text-muted">You can pay a plan directly from this balance when it covers the full plan price.</p></div><div className="grid gap-4 md:grid-cols-3">{plans.map((plan) => { const isCurrent = activePlan && planRanks[activePlan.plan] === plan.rank; const actionLabel = !activePlan ? "Choose plan & pay" : plan.rank > activeRank ? "Upgrade" : "Downgrade"; return <div key={plan.id} className={`panel ${isCurrent ? "border-2 border-kola" : ""}`}><div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{plan.name}</p><p className="mt-1 text-sm text-muted">{plan.label}</p></div>{isCurrent && <span className="rounded-full bg-kola-light px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-kola">Current plan</span>}</div><p className="mt-2 text-2xl font-bold">{formatNaira(plan.amount)}</p><div className="mt-4 rounded-xl bg-kola-light p-3"><p className="text-xs font-extrabold uppercase tracking-wide text-kola">Plan benefit</p><p className="mt-1 text-sm font-semibold text-kola">{plan.commission} commission per paid order</p><p className="mt-1 text-xs leading-5 text-muted">{plan.benefit}</p></div><div className="mt-4"><SubscriptionForm storeId={store.id} plan={plan.id} amount={plan.amount} balance={balance} actionLabel={actionLabel} isCurrent={Boolean(isCurrent)} /></div></div>; })}</div><p className="mt-4 text-xs leading-5 text-muted">Commission is calculated from each paid order using the seller&apos;s active plan: Basic 3%, Plus 2.8%, or Premium 2.5%.</p></section>
    <section className="panel"><div className="flex items-center justify-between gap-4"><h2 className="font-semibold">Subscription history</h2><span className="chip">{subscriptions?.length || 0} records</span></div><div className="mt-4 space-y-3">{subscriptions?.length ? subscriptions.map((item, index) => <div key={item.id || `${item.plan}-${item.started_at || index}`} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line p-4"><div><p className="text-sm font-extrabold">{planNames[item.plan] || item.plan} <span className="font-normal text-muted">· {item.paid_with || "transfer"}</span></p><p className="mt-1 text-xs text-muted">{item.paid_at ? `Paid ${new Date(item.paid_at).toLocaleDateString("en-NG")}` : `Started ${new Date(item.started_at).toLocaleDateString("en-NG")}`}{item.expires_at ? ` · Ends ${new Date(item.expires_at).toLocaleDateString("en-NG")}` : ""}</p></div><StatusBadge status={item.status} /></div>) : <p className="text-sm text-muted">No subscription payments yet.</p>}</div></section>
  </div>;
}
