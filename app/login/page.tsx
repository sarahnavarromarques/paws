"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import { getAuthErrorKey } from "@/lib/auth-errors";

const supabase = createClient();

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("Login");
  const tErrors = useTranslations("AuthErrors");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!email.trim() || !password) {
      alert(t("alertMissingFields"));
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      alert(tErrors(getAuthErrorKey(error.message)));
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100">
      <form
        onSubmit={handleLogin}
        className="w-[420px] rounded-2xl bg-white p-10 shadow-xl"
      >
        <h1 className="mb-8 text-center text-3xl font-bold">
          {t("title")}
        </h1>

        <input
          type="email"
          autoComplete="email"
          className="mb-4 w-full rounded-lg border p-3 text-slate-900 placeholder:text-slate-400"
          placeholder={t("emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          autoComplete="current-password"
          className="mb-6 w-full rounded-lg border p-3 text-slate-900 placeholder:text-slate-400"
          placeholder={t("passwordPlaceholder")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 py-3 text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? t("loggingIn") : t("submit")}
        </button>

        <div className="mt-6 space-y-3 text-center text-sm">
          <p>
            <Link
              href="/reset-password"
              className="font-semibold text-blue-600 hover:underline"
            >
              {t("forgotPassword")}
            </Link>
          </p>

          <p className="text-slate-500">
            {t("noAccount")}{" "}
            <Link
              href="/register"
              className="font-semibold text-blue-600 hover:underline"
            >
              {t("registerLink")}
            </Link>
          </p>
        </div>
      </form>
    </main>
  );
}