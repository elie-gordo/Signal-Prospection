import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { isDemo } from "@/lib/data";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Signal — prospection par signaux d'achat",
  description:
    "Détecte les entreprises qui ont besoin d'un site ou d'une automatisation maintenant : créations BODACC, projets publiés, sites faibles.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SiteHeader isDemo={isDemo} />
        <main className="mx-auto w-full max-w-[1200px] px-4 pb-20 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
