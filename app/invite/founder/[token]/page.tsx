"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";

import Pawsi from "@/components/Pawsi";
import PawsiLoading from "@/components/PawsiLoading";
import { readJsonObject } from "@/lib/homework";

type Status =
  | "loading"
  | "error"
  | "not_found"
  | "logged_out"
  | "available"
  | "yours"
  | "used"
  | "already_founder";

const SERVER_STATUSES: Status[] = [
  "not_found",
  "available",
  "yours",
  "used",
  "already_founder",
];

function readStatus(value: unknown): Status | null {
  return SERVER_STATUSES.find((status) => status === value) ?? null;
}

// Enlace personal de fundador que se envía a cada adiestrador.
// Solo se puede usar una vez: quien lo usa paga PAWS PRO con el 50% para siempre.
export default function FounderInvitePage() {
  const t = useTranslations("FounderInvite");
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [status, setStatus] = useState<Status>("loading");
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch(
          `/api/founder-invites/redeem?token=${encodeURIComponent(token)}`
        );
        const result = readJsonObject(await response.json().catch(() => null));
        const serverStatus = readStatus(result?.status);

        if (cancelled) return;

        if (!response.ok || !serverStatus) {
          setStatus("error");
        } else if (serverStatus === "available" && result?.loggedIn !== true) {
          setStatus("logged_out");
        } else {
          setStatus(serverStatus);
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleRedeem() {
    setRedeeming(true);

    try {
      const response = await fetch("/api/founder-invites/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result = readJsonObject(await response.json().catch(() => null));
      const serverStatus = readStatus(result?.status);

      if (response.status === 401) {
        setStatus("logged_out");
      } else if (!response.ok || !serverStatus) {
        setStatus("error");
      } else {
        setStatus(serverStatus);
      }
    } catch {
      setStatus("error");
    }

    setRedeeming(false);
  }

  const nextParam = encodeURIComponent(`/invite/founder/${token}`);

  const goProButton = (
    <Link
      href="/pro"
      className="mt-5 inline-block rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
    >
      {t("goPro")}
    </Link>
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl">
        {status === "loading" ? (
          <PawsiLoading text={t("loading")} variant="card" />
        ) : status === "error" || status === "not_found" || status === "used" ? (
          <div className="text-center">
            <div className="flex justify-center">
              <Pawsi pose="espera" size={110} />
            </div>
            <p className="mt-4 text-slate-600">
              {status === "used"
                ? t("used")
                : status === "not_found"
                ? t("notFound")
                : t("errorGeneric")}
            </p>
          </div>
        ) : status === "yours" || status === "already_founder" ? (
          <div className="text-center">
            <div className="flex justify-center">
              <Pawsi pose="celebra" size={110} />
            </div>
            <h1 className="mt-3 text-2xl font-bold text-green-700">{t("successTitle")}</h1>
            <p className="mt-2 text-slate-600">
              {status === "yours" ? t("successText") : t("alreadyFounder")}
            </p>
            {goProButton}
          </div>
        ) : (
          <>
            <div className="text-center">
              <div className="flex justify-center">
                <Pawsi pose="premio" size={110} />
              </div>
              <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-blue-600">
                {t("title")}
              </p>
              <h1 className="mt-2 text-2xl font-extrabold text-[#1e3a5f]">
                {t("headline")}
              </h1>
              <p className="mt-3 text-slate-600">{t("explain")}</p>
              <p className="mt-2 text-sm text-slate-500">{t("personal")}</p>
            </div>

            <div className="mt-6">
              {status === "logged_out" ? (
                <>
                  <p className="mb-4 text-center font-semibold text-slate-700">
                    {t("loginToAccept")}
                  </p>
                  <div className="flex flex-col gap-3">
                    <Link
                      href={`/register?next=${nextParam}`}
                      className="rounded-xl bg-green-600 py-3 text-center font-semibold text-white transition hover:bg-green-700"
                    >
                      {t("register")}
                    </Link>
                    <Link
                      href={`/login?next=${nextParam}`}
                      className="rounded-xl bg-blue-600 py-3 text-center font-semibold text-white transition hover:bg-blue-700"
                    >
                      {t("login")}
                    </Link>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleRedeem}
                  disabled={redeeming}
                  className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {redeeming ? t("activating") : t("activate")}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
