import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
export const metadata: Metadata = { title: "Artikel CMS", description: "CMS Artikel Multi-Website" };
export default function RootLayout({ children }: LayoutProps<"/">) { return <html lang="id" className={geist.variable}><body>{children}</body></html>; }
