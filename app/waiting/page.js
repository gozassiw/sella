import SellaBrand from "@/components/SellaBrand";
import WaitlistForm from "@/components/WaitlistForm";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function WaitingPage() {
  const supabase = createClient();
  const { data: settings } = await supabase.rpc("get_public_launch_settings");
  const launchAt = settings?.launch_at || null;

  return (
    <main className="min-h-screen bg-surface text-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex items-center justify-between">
          <SellaBrand href="/waiting" />
          <a href="/login?next=%2Fdashboard" className="text-sm font-bold text-kola hover:underline">Login</a>
        </header>

        <section className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.05fr_.95fr] lg:gap-20 lg:py-20">
          <div>
            <p className="eyebrow text-kola">Sella is almost ready</p>
            <h1 className="display mt-4 max-w-3xl text-4xl leading-[1.04] sm:text-6xl">A simpler way for sellers to run their business.</h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted sm:text-lg">We are putting the final pieces in place for Sella — one place for your store, orders, payments, stock, and profit.</p>
            <div className="mt-9 flex flex-wrap gap-3 text-sm font-bold text-kola">
              <span className="rounded-full bg-kola-light px-4 py-2">Store link</span>
              <span className="rounded-full bg-kola-light px-4 py-2">Orders</span>
              <span className="rounded-full bg-kola-light px-4 py-2">Profit tracking</span>
            </div>
          </div>

          <div className="app-card border-kola/20 p-6 sm:p-8">
            <p className="eyebrow text-kola">Launching soon</p>
            <h2 className="display mt-2 text-2xl sm:text-3xl">Be first to know.</h2>
            <p className="mt-3 text-sm leading-6 text-muted">Join the launch list with your full name, email, and WhatsApp number.</p>
            <WaitlistForm launchAt={launchAt} />
          </div>
        </section>

        <footer className="border-t border-line py-5 text-xs text-muted">Sella is owned and operated by Jojokev Digital - BN9832074</footer>
      </div>
    </main>
  );
}
