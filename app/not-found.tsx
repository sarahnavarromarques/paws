"use client";

import Link from "next/link";
import { useLocale } from "next-intl";

import Pawsi from "@/components/Pawsi";

const TEXT = {
  es: {
    title: "¡Vaya! No encuentro esta página",
    body: "Puede que el enlace esté mal o que ya no exista. Pawsi ha buscado por todas partes…",
    home: "Volver al inicio",
  },
  en: {
    title: "Oops! I can't find this page",
    body: "The link may be wrong or the page no longer exists. Pawsi has looked everywhere…",
    home: "Back to home",
  },
};

// Next.js muestra esta página cuando algo no existe (enlace roto, perro borrado…)
export default function NotFound() {
  const locale = useLocale();
  const tx = TEXT[locale === "en" ? "en" : "es"];

  return (
    <main className="flex min-h-[80vh] items-center justify-center bg-slate-100 p-6">
      <div className="flex max-w-md flex-col items-center rounded-3xl bg-white p-8 text-center shadow-lg">
        <Pawsi pose="triste" size={160} />
        <h1 className="mt-4 text-2xl font-extrabold text-[#1e3a5f]">
          {tx.title}
        </h1>
        <p className="mt-2 text-slate-600">{tx.body}</p>
        <Link
          href="/dashboard"
          className="mt-6 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
        >
          {tx.home}
        </Link>
      </div>
    </main>
  );
}