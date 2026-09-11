import { Sora } from "next/font/google";
import "./globals.css";
import { BRAND } from "@/lib/config";

const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap" });

export const metadata = {
  title: `${BRAND} — Your business, online and organised`,
  description: "Create an online store, record sales, track stock and manage customers from one app.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={sora.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
