"use client";
import { useState } from "react";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";

export default function LoginPage({ searchParams }) {
  const nextPath = typeof searchParams?.next === "string" && searchParams.next.startsWith("/") ? searchParams.next : "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setLoading(false);
        return setError(data.error || "That email and password don't match. Try again.");
      }
      const destination = nextPath === "/dashboard" && !data.hasStore ? "/account" : nextPath;
      window.location.assign(destination);
    } catch {
      setLoading(false);
      setError("Unable to log in right now. Please try again.");
    }
  }

  return (
    <AuthShell
      title="Log in"
      footer={<>New here? <Link href={`/signup?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-kola">Create an account</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn-primary w-full" disabled={loading}>{loading ? "Logging in…" : "Log in"}</button>
      </form>
    </AuthShell>
  );
}
