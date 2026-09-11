import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { SessionMonitor } from "@/components/session-monitor";
import { SidebarProvider } from "@/components/sidebar-context";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
export const metadata: Metadata = {
  title: "Artikel CMS",
  description: "CMS Artikel Multi-Website",
  manifest: "/favicon/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon/favicon.ico" },
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/favicon/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};
export default function RootLayout({ children }: LayoutProps<"/">) { return <html lang="id" className={geist.variable}><body><SessionMonitor/><SidebarProvider>{children}</SidebarProvider></body></html>; }
