import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SellaBrand from "@/components/SellaBrand";
import InstallPrompt from "@/components/InstallPrompt";

export const dynamic = "force-dynamic";

function CrossIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

function CheckIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

const loginHref = "/login?next=%2Fdashboard";
const signupHref = "/signup";

export default async function Home() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: admin, error: adminError } = await supabase.rpc("is_platform_admin");
    if (!adminError && admin === true) redirect("/admin");
    const { data: store } = await supabase.from("stores").select("id").eq("owner_id", user.id).maybeSingle();
    if (store) redirect("/dashboard");
    redirect("/account");
  }

  return (
    <div className="seller-homepage">
      <InstallPrompt />
      <header className="seller-site-header">
        <div className="seller-wrap seller-nav">
          <SellaBrand />
          <nav className="seller-navlinks" aria-label="Main navigation">
            <Link className="seller-plain-link" href={loginHref}>Login</Link>
            <Link className="seller-button seller-button-primary seller-button-sm" href={signupHref}>Create account</Link>
          </nav>
        </div>
        <div className="seller-company-bar"><p>Sella is a product of Jojokev Digital · CAC Registration No. BN9832074</p></div>
      </header>

      <main>
        <section className="seller-hero">
          <div className="seller-wrap seller-hero-grid">
            <div>
              <div className="seller-eyebrow">For sellers</div>
              <h1>Your business, clear enough to run from your phone.</h1>
              <p className="seller-lede">No more scattered chats and screenshots. See your storefront, orders, stock, and money in one simple place.</p>
              <div className="seller-hero-ctas">
                <Link className="seller-button seller-button-primary" href={signupHref}>Create your store <ArrowRight size={17} /></Link>
              </div>
            </div>
            <div className="seller-wallet-card">
              <div className="seller-wallet-label">Available balance</div>
              <div className="seller-wallet-amount">₦186,400</div>
              <div style={{ marginTop: 18 }}>
                <div className="seller-row">
                  <div><div className="seller-name">Order #5AD8</div><div className="seller-sub">Delivered · Chioma O.</div></div>
                  <div className="seller-amt">+₦18,500</div>
                </div>
                <div className="seller-row">
                  <div><div className="seller-name">Withdrawal</div><div className="seller-sub">Sent to GTBank ••4521</div></div>
                  <div className="seller-amt">−₦40,000</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="seller-wrap">
            <div className="seller-problem">
              <div className="seller-eyebrow">Sound familiar?</div>
              <h2>Running a business through chats gets messy.</h2>
              <div className="seller-problem-list">
                <div className="seller-problem-item"><CrossIcon /> Prices repeated in every single DM</div>
                <div className="seller-problem-item"><CrossIcon /> Payment confirmed by screenshot</div>
                <div className="seller-problem-item"><CrossIcon /> Stock tracked in your head</div>
                <div className="seller-problem-item"><CrossIcon /> No real sense of what you&apos;re making</div>
              </div>
              <div className="seller-problem-close">Sella brings all of it into one place.</div>
            </div>
          </div>
        </section>

        <section style={{ paddingTop: 0 }}>
          <div className="seller-wrap">
            <div className="seller-mood-grid">
              <div className="seller-mood-card seller-mood-before">
                <img className="seller-mood-photo" src="/homepage/before-sella.jpeg" alt="A seller overwhelmed by scattered orders and receipts" />
                <div className="seller-mood-label">Before Sella</div>
                <div className="seller-mood-text">Juggling WhatsApp chats, screenshots, and a notebook to know what&apos;s actually selling.</div>
              </div>
              <div className="seller-mood-card seller-mood-after">
                <img className="seller-mood-photo" src="/homepage/with-sella.jpeg" alt="A seller confidently checking her Sella dashboard" />
                <div className="seller-mood-label">With Sella</div>
                <div className="seller-mood-text">One place for orders, stock, and money — checked in seconds, not stitched together.</div>
              </div>
            </div>
          </div>
        </section>

        <section className="seller-feature">
          <div className="seller-wrap seller-feature-grid">
            <div>
              <div className="seller-feature-num">Your store</div>
              <h2>One link for every customer.</h2>
              <p className="seller-body-text">Set up your business name, logo, description, pickup point or address, and WhatsApp contact. Share your store link or your Sella seller ID with the customers you already have — on WhatsApp, Instagram, or in person.</p>
            </div>
            <div className="seller-mock">
              <div className="seller-mock-head"><span className="seller-mock-title">Your store link</span><span className="seller-pill seller-pill-green">Live</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, background: "var(--seller-bg)", borderRadius: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--seller-kola-dark)", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800 }}>C</div>
                <div style={{ minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 14.5 }}>chichiluxury.sella.com.ng</div><div style={{ fontSize: 12.5, color: "var(--seller-muted)" }}>Seller ID: CHL-2291</div></div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <span className="seller-button seller-button-outline seller-button-sm" style={{ flex: 1, justifyContent: "center" }}>Copy link</span>
                <Link className="seller-button seller-button-primary seller-button-sm" href={signupHref} style={{ flex: 1, justifyContent: "center" }}>Share</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="seller-feature seller-feature-reverse">
          <div className="seller-wrap seller-feature-grid">
            <div className="seller-mock">
              <img className="seller-product-thumb" src="/homepage/kola-edge-two-piece-set.jpeg" alt="Kola Edge Two-Piece Set" />
              <div style={{ fontWeight: 700, fontSize: 15 }}>Kola Edge Two-Piece Set</div>
              <div className="seller-margin-grid">
                <div className="seller-margin-box"><div className="seller-k">Selling price</div><div className="seller-v">₦32,000</div></div>
                <div className="seller-margin-box"><div className="seller-k">Cost price</div><div className="seller-v">₦19,000</div></div>
                <div className="seller-margin-box seller-win" style={{ gridColumn: "1 / -1" }}><div className="seller-k">Your margin</div><div className="seller-v">₦13,000 · 41%</div></div>
              </div>
            </div>
            <div>
              <div className="seller-feature-num">Products &amp; stock</div>
              <h2>Know what you&apos;re really making.</h2>
              <p className="seller-body-text">Add products with photos, descriptions, selling price, and cost price — Sella works out your margin automatically. Know exactly what&apos;s running low before you&apos;re caught out.</p>
            </div>
          </div>
        </section>

        <section className="seller-feature">
          <div className="seller-wrap seller-feature-grid">
            <div>
              <div className="seller-feature-num">Orders</div>
              <h2>Every order, one place.</h2>
              <p className="seller-body-text">See payment status, customer details, totals, and order codes at a glance. Move each order through paid, packed, out for delivery, and delivered — so nothing gets lost in a chat thread.</p>
            </div>
            <div className="seller-mock">
              <div className="seller-mock-head"><span className="seller-mock-title">Orders</span><span className="seller-pill seller-pill-muted">4 today</span></div>
              <div className="seller-order-row"><span className="seller-order-dot" style={{ background: "#B7791F" }} /><div><div className="seller-order-name">#5AD8 · Chioma O.</div><div className="seller-order-sub">₦28,000 · 2 items</div></div><span className="seller-order-status seller-pill seller-pill-lime">Packed</span></div>
              <div className="seller-order-row"><span className="seller-order-dot" style={{ background: "var(--seller-kola)" }} /><div><div className="seller-order-name">#5AD7 · Tunde B.</div><div className="seller-order-sub">₦16,500 · 1 item</div></div><span className="seller-order-status seller-pill seller-pill-green">Delivered</span></div>
              <div className="seller-order-row"><span className="seller-order-dot" style={{ background: "var(--seller-muted)" }} /><div><div className="seller-order-name">#5AD6 · Amina Y.</div><div className="seller-order-sub">₦9,500 · 1 item</div></div><span className="seller-order-status seller-pill seller-pill-muted">New</span></div>
            </div>
          </div>
        </section>

        <section className="seller-feature seller-feature-reverse">
          <div className="seller-wrap seller-feature-grid">
            <div className="seller-mock" style={{ padding: "20px 20px 16px" }}>
              <div className="seller-mock-head" style={{ marginBottom: 14 }}><span className="seller-mock-title">Chioma O.</span><span className="seller-pill seller-pill-muted">Order #5AD8</span></div>
              <div className="seller-bubble seller-bubble-them">Is this still in stock in blue?</div>
              <div className="seller-bubble seller-bubble-me">Yes! I&apos;ll pack it today</div>
              <div className="seller-bubble seller-bubble-them">Perfect, I&apos;m home after 5pm</div>
            </div>
            <div>
              <div className="seller-feature-num">Messages</div>
              <h2>Message buyers, right in Sella.</h2>
              <p className="seller-body-text">Once an order&apos;s paid, chat with your buyer directly — text and photos — to sort out delivery and details. One continuing conversation, not a new one every time.</p>
            </div>
          </div>
        </section>

        <section className="seller-feature">
          <div className="seller-wrap seller-feature-grid">
            <div>
              <div className="seller-feature-num">Wallet</div>
              <h2>Know your money.</h2>
              <p className="seller-body-text">Available balance, held funds, and withdrawals — all in one wallet. Request a payout to your bank and track the amount and status until it lands.</p>
            </div>
            <div className="seller-mock">
              <div className="seller-mock-head"><span className="seller-mock-title">Withdraw</span><span className="seller-pill seller-pill-green">Processing</span></div>
              <div className="seller-margin-box"><div className="seller-k">Amount</div><div className="seller-v">₦40,000</div></div>
              <div style={{ marginTop: 14, padding: "12px 14px", background: "var(--seller-kola-light)", borderRadius: 12, fontSize: 13, color: "var(--seller-kola-dark)" }}>Sent to GTBank ••4521 · usually within 30 minutes – 1 hour</div>
            </div>
          </div>
        </section>

        <section style={{ paddingTop: 0, paddingBottom: 0 }}>
          <div className="seller-wrap">
            <div className="seller-extras"><span className="seller-extras-title">Plus, built into your dashboard:</span><span className="seller-extras-list">Offline sales · Invoices · Expenses · Customer records · Reports</span></div>
          </div>
        </section>

        <section>
          <div className="seller-wrap">
            <div className="seller-eyebrow">Pricing</div>
            <h2>Try it properly, free.</h2>
            <p className="seller-lede" style={{ marginTop: 10 }}>10 days free, up to 15 products, no card needed. After that, pick what fits — every plan has the same features.</p>
            <div className="seller-plans-grid">
              <div className="seller-plan"><div className="seller-plan-name">Basic</div><div className="seller-price">₦7,500</div><div className="seller-per">every 3 months</div><ul><li><CheckIcon /> Unlimited products</li><li><CheckIcon /> Orders, wallet &amp; withdrawals</li><li><CheckIcon /> In-app buyer chat</li></ul></div>
              <div className="seller-plan seller-featured"><div className="seller-plan-name">Plus</div><div className="seller-price">₦14,000</div><div className="seller-per">every 6 months</div><ul><li><CheckIcon /> Everything in Basic</li><li><CheckIcon /> Better value per month</li><li><CheckIcon /> Same features, less admin</li></ul></div>
              <div className="seller-plan"><div className="seller-plan-name">Premium</div><div className="seller-price">₦25,000</div><div className="seller-per">every 12 months</div><ul><li><CheckIcon /> Everything in Basic</li><li><CheckIcon /> Lowest monthly cost</li><li><CheckIcon /> One payment, a full year</li></ul></div>
            </div>
          </div>
        </section>

        <section>
          <div className="seller-wrap">
            <div className="seller-closing">
              <div className="seller-eyebrow">Ready when you are</div>
              <h2>Your next customer can start here.</h2>
              <Link className="seller-button seller-button-primary" style={{ marginTop: 26 }} href={signupHref}>Open your store <ArrowRight size={17} /></Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="seller-site-footer">
        <div className="seller-wrap">
          <div className="seller-foot-row">
            <SellaBrand />
            <div className="seller-foot-links"><Link href={loginHref}>Login</Link><Link href={signupHref}>Create account</Link></div>
          </div>
          <div className="seller-copyright">© 2026 Jojokev Concepts · sella.com.ng</div>
        </div>
      </footer>
    </div>
  );
}
