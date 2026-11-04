"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import { getAuthErrorKey } from "@/lib/auth-errors";
import { safeNextPath } from "@/lib/homework";

const supabase = createClient();

export default function RegisterPage() {
  const router = useRouter();
  const t = useTranslations("Register");
  const tErrors = useTranslations("AuthErrors");
  const tLegal = useTranslations("Legal");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Aceptación de las condiciones y la política de privacidad
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [loading, setLoading] = useState(false);

  // A dónde volver después (por ejemplo, a una invitación de un adiestrador)
  const [nextPath, setNextPath] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(safeNextPath(params.get("next")));
  }, []);

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!email.trim() || !password) {
      alert(t("alertMissingFields"));
      return;
    }

    if (password.length < 6) {
      alert(t("alertPasswordTooShort"));
      return;
    }

    if (!acceptedTerms) {
      alert(tLegal("mustAccept"));
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      alert(tErrors(getAuthErrorKey(error.message)));
      return;
    }

    router.replace(nextPath ?? "/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100">
      <form
        onSubmit={handleRegister}
        className="w-[420px] rounded-2xl bg-white p-10 shadow-xl"
      >
        <h1 className="mb-8 text-center text-3xl font-bold">
          {t("title")}
        </h1>

        <input
          type="email"
          autoComplete="email"
          className="mb-4 w-full rounded-lg border p-3"
          placeholder={t("emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          autoComplete="new-password"
          className="mb-2 w-full rounded-lg border p-3"
          placeholder={t("passwordPlaceholder")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <p className="mb-6 text-xs text-slate-400">
          {t("passwordHint")}
        </p>

        <label className="mb-6 flex items-start gap-3 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0"
          />
          <span>
            {tLegal.rich("accept", {
              terms: (chunks) => (
                <Link
                  href="/legal/condiciones"
                  target="_blank"
                  className="font-semibold text-blue-600 hover:underline"
                >
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link
                  href="/legal/privacidad"
                  target="_blank"
                  className="font-semibold text-blue-600 hover:underline"
                >
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </label>

        <button
          type="submit"
          disabled={loading || !acceptedTerms}
          className="w-full rounded-lg bg-green-600 py-3 text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? t("creating") : t("submit")}
        </button>

        <p className="mt-6 text-center text-sm text-slate-500">
          {t("haveAccount")}{" "}
          <Link
            href={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login"}
            className="font-semibold text-blue-600 hover:underline"
          >
            {t("loginLink")}
          </Link>
        </p>
      </form>
    </main>
  );
}