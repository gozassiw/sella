import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { BRAND } from "@/lib/config";
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", weight: ["500", "600"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap", weight: ["400", "500", "600"] });
export const metadata = { title: `${BRAND} — Your business, online and organised`, description: "Create an online store, record sales, track stock and manage customers from one app.", icons: { icon: "/brand/sella-mark.png", apple: "/brand/sella-mark.png" } };
export default function RootLayout({ children }) { return <html lang="en" className={`${fraunces.variable} ${inter.variable}`}><body className="font-sans">{children}</body></html>; }
