"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import { getAuthErrorKey } from "@/lib/auth-errors";

const supabase = createClient();

type LinkStatus = "checking" | "ready" | "invalid";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const t = useTranslations("UpdatePassword");
  const tErrors = useTranslations("AuthErrors");

  const [status, setStatus] = useState<LinkStatus>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Al abrir la página, crea la sesión temporal a partir del enlace del email.
  // Acepta todos los tipos de enlace de recuperación:
  // 1. #access_token=... (el que genera ahora "Recuperar contraseña"):
  //    funciona desde cualquier móvil o navegador.
  // 2. ?token_hash=... (por si algún día se personaliza la plantilla del email).
  // 3. ?code=... (enlaces antiguos): Supabase lo procesa solo.
  useEffect(() => {
    let cancelled = false;

    function cleanUrl() {
      window.history.replaceState(null, "", window.location.pathname);
    }

    async function prepareSession() {
      const query = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

      // El enlace ha caducado o ya se usó.
      if (hash.get("error") || query.get("error")) {
        cleanUrl();
        if (!cancelled) setStatus("invalid");
        return;
      }

      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        cleanUrl();
        if (!cancelled) setStatus(error ? "invalid" : "ready");
        return;
      }

      const tokenHash = query.get("token_hash");

      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });
        cleanUrl();
        if (!cancelled) setStatus(error ? "invalid" : "ready");
        return;
      }

      const { data } = await supabase.auth.getSession();

      if (!cancelled) setStatus(data.session ? "ready" : "invalid");
    }

    prepareSession();

    // Por si Supabase termina de procesar un enlace antiguo un poco después.
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (cancelled) return;
        if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
          setStatus("ready");
        }
      }
    );

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

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
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-[420px] rounded-2xl bg-white p-10 shadow-xl">
        <h1 className="mb-2 text-center text-3xl font-bold">
          {t("title")}
        </h1>

        {status === "checking" && (
          <p className="mt-6 text-center text-slate-500">{t("verifying")}</p>
        )}

        {status === "invalid" && (
          <div className="mt-6 text-center">
            <p className="mb-6 text-slate-600">{t("invalidLink")}</p>

            <Link
              href="/login"
              className="block w-full rounded-lg bg-blue-600 py-3 text-white transition hover:bg-blue-700"
            >
              {t("backToLogin")}
            </Link>
          </div>
        )}

        {status === "ready" && done && (
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
        )}

        {status === "ready" && !done && (
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