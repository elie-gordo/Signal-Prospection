import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { isDemo } from "@/lib/data";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Signal — prospection par signaux d'achat",
  description:
    "Détecte les entreprises qui ont besoin d'un site ou d'une automatisation maintenant : créations BODACC, projets publiés, recrutements, sites faibles.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} antialiased`}>
        <SiteHeader isDemo={isDemo} />
        <main className="mx-auto w-full max-w-[1280px] px-4 pb-24 sm:px-8">{children}</main>
      </body>
    </html>
  );
}
