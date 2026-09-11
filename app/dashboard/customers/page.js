import { getMyStore } from "@/lib/store";

export default async function CustomersPage() {
  const { supabase, store } = await getMyStore();
  const { data: customers } = await supabase.from("customers").select("id,name,phone,email,address,created_at").eq("store_id", store.id).order("created_at", { ascending: false }).limit(100);
  return <div><h1 className="text-2xl font-bold">Customers</h1><p className="mt-1 text-sm text-muted">People who have ordered from your store.</p><div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white"><table className="w-full text-left text-sm"><thead className="border-b border-line bg-surface"><tr><th className="p-4">Name</th><th className="p-4">Contact</th><th className="p-4">Address</th></tr></thead><tbody>{customers?.length ? customers.map((customer) => <tr key={customer.id} className="border-b border-line last:border-0"><td className="p-4 font-semibold">{customer.name}</td><td className="p-4">{customer.phone || "—"}<br /><span className="text-muted">{customer.email || ""}</span></td><td className="p-4 text-muted">{customer.address || "Pickup"}</td></tr>) : <tr><td colSpan="3" className="p-10 text-center text-muted">Customers will appear after the first order.</td></tr>}</tbody></table></div></div>;
}
