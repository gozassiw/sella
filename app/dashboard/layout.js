import { getMyStore } from "@/lib/store";
import DashboardNav from "@/components/DashboardNav";
export default async function DashboardLayout({ children }) { const { store } = await getMyStore(); return <div className="min-h-screen bg-surface md:flex"><DashboardNav store={{ name: store.name, slug: store.slug, logo_url: store.logo_url, approval_status: store.approval_status }} /><main className="min-w-0 flex-1 pb-20 md:pb-0"><div className="mx-auto max-w-7xl px-5 py-8 lg:px-10 lg:py-12">{children}</div></main></div>; }
