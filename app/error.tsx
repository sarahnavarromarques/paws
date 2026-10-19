"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";

import Pawsi from "@/components/Pawsi";

const TEXT = {
  es: {
    title: "Algo ha salido mal",
    body: "Ha ocurrido un error inesperado. Puedes intentarlo de nuevo o volver al inicio.",
    retry: "Reintentar",
    home: "Volver al inicio",
  },
  en: {
    title: "Something went wrong",
    body: "An unexpected error happened. You can try again or go back home.",
    retry: "Try again",
    home: "Back to home",
  },
};

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

// Next.js muestra esta página si una pantalla falla de forma inesperada
export default function ErrorPage({ error, reset }: Props) {
  const locale = useLocale();
  const tx = TEXT[locale === "en" ? "en" : "es"];

  useEffect(() => {
    console.error("Error en la página:", error);
  }, [error]);

  return (
    <main className="flex min-h-[80vh] items-center justify-center bg-slate-100 p-6">
      <div className="flex max-w-md flex-col items-center rounded-3xl bg-white p-8 text-center shadow-lg">
        <Pawsi pose="triste" size={160} />
        <h1 className="mt-4 text-2xl font-extrabold text-[#1e3a5f]">
          {tx.title}
        </h1>
        <p className="mt-2 text-slate-600">{tx.body}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            {tx.retry}
          </button>
          <Link
            href="/dashboard"
            className="rounded-xl bg-slate-200 px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-300"
          >
            {tx.home}
          </Link>
        </div>
      </div>
    </main>
  );
}