"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { getAuthErrorKey } from "@/lib/auth-errors";

type RecoverErrorBody = {
  msg?: string;
  message?: string;
  error_description?: string;
};

// Pide a Supabase el email de recuperación.
// Se llama directamente (sin el cliente de Supabase) para que el enlace del
// email funcione en cualquier móvil o navegador, no solo en el que lo pidió.
async function requestPasswordReset(email: string): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const redirectTo = `${window.location.origin}/update-password`;

  try {
    const response = await fetch(
      `${supabaseUrl}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ email }),
      }
    );

    if (response.ok) return null;

    const body = (await response.json().catch(() => ({}))) as RecoverErrorBody;
    return body.msg ?? body.error_description ?? body.message ?? "";
  } catch {
    return "Failed to fetch";
  }
}

export default function ResetPasswordPage() {
  const t = useTranslations("ResetPassword");
  const tErrors = useTranslations("AuthErrors");

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!email.trim()) {
      alert(t("alertEnterEmail"));
      return;
    }

    setLoading(true);

    const errorMessage = await requestPasswordReset(email.trim());

    setLoading(false);

    if (errorMessage !== null) {
      alert(tErrors(getAuthErrorKey(errorMessage)));
      return;
    }

    setSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-[420px] rounded-2xl bg-white p-10 shadow-xl">
        <h1 className="mb-2 text-center text-3xl font-bold">
          {t("title")}
        </h1>

        {sent ? (
          <div className="mt-6 text-center">
            <p className="mb-6 text-slate-600">{t("sentMessage")}</p>

            <Link
              href="/login"
              className="font-semibold text-blue-600 hover:underline"
            >
              {t("backToLogin")}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleReset}>
            <p className="mb-6 mt-2 text-center text-sm text-slate-500">
              {t("instructions")}
            </p>

            <input
              type="email"
              autoComplete="email"
              className="mb-6 w-full rounded-lg border p-3"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-3 text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? t("sending") : t("submit")}
            </button>

            <p className="mt-6 text-center text-sm text-slate-500">
              <Link
                href="/login"
                className="font-semibold text-blue-600 hover:underline"
              >
                {t("backToLogin")}
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}