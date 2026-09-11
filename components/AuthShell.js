import Link from "next/link";
import { BRAND } from "@/lib/config";

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <Link href="/" className="mb-8 text-xl font-bold text-kola">{BRAND}</Link>
      <div className="panel w-full max-w-sm">
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <p className="mt-6 text-sm text-muted">{footer}</p>}
    </div>
  );
}
