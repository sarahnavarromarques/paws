"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import { getAuthErrorKey } from "@/lib/auth-errors";

const supabase = createClient();

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

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: `${window.location.origin}/update-password`,
      }
    );

    setLoading(false);

    if (error) {
      alert(tErrors(getAuthErrorKey(error.message)));
      return;
    }

    setSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="w-[420px] rounded-2xl bg-white p-10 shadow-xl">
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