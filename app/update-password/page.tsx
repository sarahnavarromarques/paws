"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import { getAuthErrorKey } from "@/lib/auth-errors";

const supabase = createClient();

export default function UpdatePasswordPage() {
  const router = useRouter();
  const t = useTranslations("UpdatePassword");
  const tErrors = useTranslations("AuthErrors");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!password) {
      alert(t("alertEnterPassword"));
      return;
    }

    if (password.length < 6) {
      alert(t("alertPasswordTooShort"));
      return;
    }

    if (password !== confirm) {
      alert(t("alertPasswordsDontMatch"));
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      alert(tErrors(getAuthErrorKey(error.message)));
      return;
    }

    setDone(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="w-[420px] rounded-2xl bg-white p-10 shadow-xl">
        <h1 className="mb-2 text-center text-3xl font-bold">
          {t("title")}
        </h1>

        {done ? (
          <div className="mt-6 text-center">
            <p className="mb-6 text-slate-600">{t("successMessage")}</p>

            <button
              type="button"
              onClick={() => {
                router.replace("/login");
                router.refresh();
              }}
              className="w-full rounded-lg bg-blue-600 py-3 text-white transition hover:bg-blue-700"
            >
              {t("goToLogin")}
            </button>
          </div>
        ) : (
          <form onSubmit={handleUpdate}>
            <p className="mb-6 mt-2 text-center text-sm text-slate-500">
              {t("instructions")}
            </p>

            <input
              type="password"
              autoComplete="new-password"
              className="mb-4 w-full rounded-lg border p-3"
              placeholder={t("newPasswordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <input
              type="password"
              autoComplete="new-password"
              className="mb-6 w-full rounded-lg border p-3"
              placeholder={t("confirmPlaceholder")}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-3 text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? t("saving") : t("submit")}
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