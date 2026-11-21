import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const inter = localFont({ src: "./fonts/inter.woff2", variable: "--inter", display: "swap" });
const archivo = localFont({ src: "./fonts/archivo.woff2", variable: "--archivo", display: "swap" });

export const metadata: Metadata = {
  title: "IEEE Rwanda Volunteer Hub",
  description: "Events, funding requests, and reporting for IEEE Rwanda volunteers.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={`${inter.variable} ${archivo.variable}`}><body>{children}</body></html>;
}
