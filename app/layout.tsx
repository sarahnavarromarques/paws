import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import Sidebar from "@/components/Sidebar";
import OnboardingTour from "@/components/OnboardingTour";
import FirstStepsChecklist from "@/components/FirstStepsChecklist";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Título y descripción en el idioma activo
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");

  return {
    title: t("title"),
    description: t("description"),
    manifest: "/manifest.json",
    appleWebApp: {
      capable: true,
      title: "PAWS Coaching",
      statusBarStyle: "default",
    },
    icons: {
      icon: "/icon-192.png",
      apple: "/apple-touch-icon.png",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#1e3a5f",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Sidebar />

          {/* Bandera de idioma en todas las páginas (arriba a la derecha).
              Es "fixed": se queda siempre visible aunque bajes la página. */}
          <div className="fixed right-4 top-4 z-40">
            <LanguageSwitcher />
          </div>

          {children}
          <FirstStepsChecklist />
          <OnboardingTour />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}