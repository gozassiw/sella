import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata = {
  title: "MoniUsed — See where your moni went.",
  description: "A free, private expense tracker made for everyday Nigerians.",
  icons: { icon: "/brand/moniused-mark.svg" },
  appleWebApp: { capable: true, title: "MoniUsed", statusBarStyle: "default" },
};

export default function RootLayout({ children }) {
  return <html lang="en" className={jakarta.variable}><body>{children}</body></html>;
}
