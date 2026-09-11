import { getMyStore } from "@/lib/store";
import DashboardNav from "@/components/DashboardNav";

export default async function DashboardLayout({ children }) {
  const { store } = await getMyStore();
  return (
    <div className="min-h-screen md:flex">
      <DashboardNav store={{ name: store.name, slug: store.slug, logo_url: store.logo_url }} />
      <main className="flex-1 pb-24 md:pb-0">
        <div className="mx-auto max-w-5xl p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
