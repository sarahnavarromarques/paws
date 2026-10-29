"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import PawsiLoading from "@/components/PawsiLoading";
import { buildFounderUrl } from "@/lib/founder";
import { buildWhatsAppUrl, readJsonObject } from "@/lib/homework";

type FounderInviteItem = {
  token: string;
  label: string;
  createdAt: string;
  redeemedAt: string | null;
  redeemedEmail: string | null;
};

function readInvites(value: unknown): FounderInviteItem[] {
  const list = readJsonObject(value)?.invites;
  if (!Array.isArray(list)) return [];

  return list.flatMap((item) => {
    const row = readJsonObject(item);
    if (!row || typeof row.token !== "string") return [];
    return [
      {
        token: row.token,
        label: typeof row.label === "string" ? row.label : "",
        createdAt: typeof row.createdAt === "string" ? row.createdAt : "",
        redeemedAt: typeof row.redeemedAt === "string" ? row.redeemedAt : null,
        redeemedEmail: typeof row.redeemedEmail === "string" ? row.redeemedEmail : null,
      },
    ];
  });
}

// Página solo para administradores: crear y enviar enlaces de fundador
export default function FounderAdminPage() {
  const t = useTranslations("FounderAdmin");
  const locale = useLocale();

  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [invites, setInvites] = useState<FounderInviteItem[]>([]);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/founder-invites");
      if (response.status === 401 || response.status === 403) {
        setForbidden(true);
        return;
      }
      if (!response.ok) {
        setLoadError(true);
        return;
      }
      setInvites(readInvites(await response.json()));
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    setCreateError(false);

    try {
      const response = await fetch("/api/founder-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() }),
      });
      if (!response.ok) throw new Error("create failed");
      setLabel("");
      await load();
    } catch {
      setCreateError(true);
    }

    setCreating(false);
  }

  async function handleDelete(token: string) {
    if (!window.confirm(t("confirmDelete"))) return;
    await fetch(`/api/founder-invites?token=${encodeURIComponent(token)}`, {
      method: "DELETE",
    });
    await load();
  }

  async function handleCopy(token: string) {
    try {
      await navigator.clipboard.writeText(buildFounderUrl(origin, token));
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      // Si el navegador no deja copiar, el enlace sigue visible para copiarlo a mano
    }
  }

  const formatDate = (value: string) =>
    value
      ? new Date(value).toLocaleDateString(locale, {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "";

  const usedCount = invites.filter((invite) => invite.redeemedAt).length;

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-extrabold text-blue-700">{t("title")}</h1>
            <p className="mt-3 text-lg text-slate-600">{t("subtitle")}</p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-xl bg-slate-700 px-5 py-3 text-center font-semibold text-white transition hover:bg-slate-800"
          >
            {t("backToDashboard")}
          </Link>
        </div>

        {loading ? (
          <div className="rounded-2xl bg-white p-4 shadow">
            <PawsiLoading text={t("loading")} variant="card" />
          </div>
        ) : forbidden ? (
          <div className="rounded-2xl bg-white p-6 text-center font-semibold text-slate-700 shadow">
            {t("forbidden")}
          </div>
        ) : (
          <>
            {/* CREAR ENLACE */}
            <form onSubmit={handleCreate} className="mb-8 rounded-2xl bg-white p-6 shadow">
              <h2 className="text-xl font-bold text-[#1e3a5f]">{t("createTitle")}</h2>
              <p className="mt-1 text-sm text-slate-500">{t("createHelp")}</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={label}
                  maxLength={80}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={t("labelPlaceholder")}
                  className="flex-1 rounded-xl border border-slate-300 p-3 text-slate-900 placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  disabled={creating || !label.trim()}
                  className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? t("creating") : t("create")}
                </button>
              </div>
              {createError && (
                <p className="mt-3 text-sm font-semibold text-red-600">{t("errorCreate")}</p>
              )}
            </form>

            {loadError && (
              <p className="mb-4 rounded-xl bg-red-50 p-4 font-semibold text-red-700">
                {t("errorLoad")}
              </p>
            )}

            {/* LISTA */}
            <h2 className="mb-3 text-xl font-bold text-[#1e3a5f]">
              {t("listTitle", { used: usedCount, total: invites.length })}
            </h2>

            {invites.length === 0 ? (
              <p className="rounded-2xl bg-white p-6 text-center text-slate-600 shadow">
                {t("empty")}
              </p>
            ) : (
              <ul className="space-y-3">
                {invites.map((invite) => {
                  const url = buildFounderUrl(origin, invite.token);
                  const message = t("whatsAppMessage", {
                    name: invite.label || "",
                    url,
                  });

                  return (
                    <li key={invite.token} className="rounded-2xl bg-white p-5 shadow">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-slate-800">
                            {invite.label || t("noLabel")}
                          </p>
                          <p className="text-xs text-slate-500">
                            {t("createdOn", { date: formatDate(invite.createdAt) })}
                          </p>
                        </div>
                        {invite.redeemedAt ? (
                          <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
                            {t("used", { date: formatDate(invite.redeemedAt) })}
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
                            {t("pending")}
                          </span>
                        )}
                      </div>

                      {invite.redeemedAt ? (
                        <p className="mt-3 text-sm text-slate-600">
                          {t("usedBy", { email: invite.redeemedEmail ?? "—" })}
                        </p>
                      ) : (
                        <>
                          <p className="mt-3 break-all rounded-lg bg-slate-50 p-2 font-mono text-xs text-slate-600">
                            {url}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopy(invite.token)}
                              className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                            >
                              {copiedToken === invite.token ? t("copied") : t("copy")}
                            </button>
                            <a
                              href={buildWhatsAppUrl(message)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
                            >
                              {t("sendWhatsApp")}
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDelete(invite.token)}
                              className="rounded-xl px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                            >
                              {t("delete")}
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  );
}
