"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "@/components/AuthShell";

const CONSENT_VERSION = "2026-09-12";

export default function SignupPage({ searchParams }) {
  const router = useRouter();
  const requestedNext = typeof searchParams?.next === "string" && searchParams.next.startsWith("/") ? searchParams.next : "";
  const queryRole = searchParams?.role === "seller" || searchParams?.role === "customer" ? searchParams.role : "";
  const inferredRole = queryRole || (requestedNext === "/onboarding" || requestedNext === "/dashboard" ? "seller" : requestedNext ? "customer" : "");
  const nextPath = requestedNext || (inferredRole === "seller" ? "/onboarding" : "/account/setup");
  const isCustomer = inferredRole === "customer";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!accepted) return setError("Please accept the Terms of Use and Privacy & Anti-Piracy Policy to continue.");
    setLoading(true); setError("");
    const supabase = createClient();
    const { data, error: signupError } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`, data: { terms_version: CONSENT_VERSION, privacy_version: CONSENT_VERSION, consent_source: "signup", consent_accepted: true } } });
    if (signupError) { setLoading(false); const limited = signupError.message.toLowerCase().includes("rate limit"); setRateLimited(limited); return setError(limited ? "Too many confirmation emails were requested. Please wait before trying again, or use Log in if this email is already registered." : signupError.message); }
    if (data.session) {
      const { error: consentError } = await supabase.from("account_consents").upsert({ user_id: data.user.id, terms_version: CONSENT_VERSION, privacy_version: CONSENT_VERSION, source: "signup", accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      setLoading(false);
      if (consentError) return setError(`Account created, but consent could not be saved: ${consentError.message}`);
      router.push(nextPath); router.refresh();
    } else { setLoading(false); setSent(true); }
  }

  if (!inferredRole) return <AuthShell title="Create your Sella account" subtitle="Choose how you want to use Sella."><div className="grid gap-3"><Link href="/signup?role=customer&next=%2Faccount%2Fsetup" className="group flex items-center gap-4 rounded-2xl border border-line bg-white p-5 text-left transition hover:border-kola hover:bg-kola-light"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-kola-light text-kola"><ShoppingBag size={22} /></span><span className="min-w-0 flex-1"><strong className="block text-base font-extrabold">Sign up as a customer</strong><span className="mt-1 block text-sm leading-5 text-muted">Follow stores, shop products, track orders, and use your wallet.</span></span><ArrowRight className="shrink-0 text-kola" size={19} /></Link><Link href="/signup?role=seller&next=%2Fonboarding" className="group flex items-center gap-4 rounded-2xl border border-line bg-white p-5 text-left transition hover:border-kola hover:bg-kola-light"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-mango text-kola-dark"><BriefcaseBusiness size={22} /></span><span className="min-w-0 flex-1"><strong className="block text-base font-extrabold">Create a store account</strong><span className="mt-1 block text-sm leading-5 text-muted">Set up your storefront, add products, and manage your business.</span></span><ArrowRight className="shrink-0 text-kola" size={19} /></Link></div><p className="mt-6 text-center text-sm text-muted">Already have an account? <Link href="/login" className="font-bold text-kola">Log in</Link></p></AuthShell>;

  if (sent) return <AuthShell title="Check your email" subtitle={`We sent a confirmation link to ${email}. Open it to finish creating your ${isCustomer ? "customer" : "store"} account.`} />;
  return <AuthShell title={isCustomer ? "Create your customer account" : "Create your store account"} subtitle={isCustomer ? "Follow stores, shop products, track orders, and use your wallet." : "Start your 10-day free trial after Sella approval and set up your storefront."} footer={<>Already have an account? <Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-kola">Log in</Link></>}><form onSubmit={submit} className="space-y-4"><div><label className="label" htmlFor="email">Email</label><input id="email" type="email" required className="input" value={email} onChange={(event) => setEmail(event.target.value)} /></div><div><label className="label" htmlFor="password">Password</label><input id="password" type="password" required minLength={6} className="input" value={password} onChange={(event) => setPassword(event.target.value)} /><p className="hint">At least 6 characters.</p></div><label className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3 text-xs leading-5 text-muted"><input type="checkbox" className="mt-1 h-4 w-4 accent-kola" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} required /><span>I agree to Sella&apos;s <Link href="/terms" target="_blank" className="font-bold text-kola underline">Terms of Use</Link> and <Link href="/privacy" target="_blank" className="font-bold text-kola underline">Privacy & Anti-Piracy Policy</Link>.</span></label>{error && <div className="space-y-2"><p className="error">{error}</p>{rateLimited && <p className="text-xs text-muted">The email service may need time to reset. A custom SMTP provider in Supabase removes this limit.</p>}</div>}<button className="btn-primary w-full" disabled={loading}>{loading ? "Creating account…" : "Create account"}</button></form><Link href="/signup" className="mt-5 block text-center text-xs font-bold text-muted hover:text-kola">Choose a different account type</Link></AuthShell>;
}
