import type { Metadata, Viewport } from "next";
import { Hind_Vadodara, Mukta_Vaani } from "next/font/google";
import { getLang } from "@/lib/i18n";
import "./globals.css";

const body = Hind_Vadodara({ subsets: ["gujarati", "latin"], weight: ["400", "500", "600"], variable: "--font-body", display: "swap" });
const display = Mukta_Vaani({ subsets: ["gujarati", "latin"], weight: ["600", "700", "800"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: { default: "શ્યામધામ મધુરમ", template: "%s · શ્યામધામ" },
  description: "શ્રી કડિયા જ્ઞાતિ, જુનાગઢ — શ્યામધામ મધુરમ વ્યવસ્થાપન પોર્ટલ",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1d3f8f",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang === "en" ? "en" : "gu"} className={`${body.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
