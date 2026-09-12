"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function BuyerHomeLink({ children, className, ariaLabel = "Back to Sella" }) {
  const [href, setHref] = useState("/account");
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => { if (data.user) setHref("/account"); }).catch(() => {});
  }, []);
  return <Link href={href} className={className} aria-label={ariaLabel}>{children}</Link>;
}
