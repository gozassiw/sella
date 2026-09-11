"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "@/components/AuthShell";

export default function SignupPage({ searchParams }) {
  const router = useRouter();
  const nextPath = typeof searchParams?.next === "string" && searchParams.next.startsWith("/") ? searchParams.next : "/onboarding";
  const isBuyerSignup = nextPath === "/account" || nextPath.startsWith("/account/") || nextPath === "/cart" || nextPath === "/checkout";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}` },
    });
    setLoading(false);
    if (error) return setError(error.message);
    if (data.session) {
      router.push(nextPath);
      router.refresh();
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <AuthShell title="Check your email" subtitle={`We sent a confirmation link to ${email}. Open it to finish creating your account.`} />
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle={isBuyerSignup ? "Create one Sella account to shop, track orders, and use your wallet across stores." : "Start your 14-day free trial."}
      footer={<>Already have an account? <Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-kola">Log in</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" required minLength={6} className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="hint">At least 6 characters.</p>
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn-primary w-full" disabled={loading}>{loading ? "Creating account…" : "Create account"}</button>
      </form>
    </AuthShell>
  );
}
