"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import PawsiLoading from "@/components/PawsiLoading";
import {
  COMPLIANCE_CLASSES,
  buildInviteUrl,
  buildWhatsAppUrl,
  complianceTone,
  getCompliance,
  getWeekProgress,
  startOfWeek,
  type HomeworkAssignment,
  type HomeworkLog,
  type TrainerLink,
  type WeekProgress,
} from "@/lib/homework";

const supabase = createClient();

type Invite = {
  id: string;
  token: string;
  client_name: string;
  created_at: string;
};

type DogSummary = {
  link: TrainerLink;
  progress: WeekProgress[];
  compliance: number | null;
};

// Pantalla del adiestrador: invitar clientes y ver quién practica en casa
export default function ClientsPage() {
  const t = useTranslations("Clients");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [trainerName, setTrainerName] = useState<string | null>(null);
  const [links, setLinks] = useState<TrainerLink[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [assignments, setAssignments] = useState<HomeworkAssignment[]>([]);
  const [logs, setLogs] = useState<HomeworkLog[]>([]);

  const [clientName, setClientName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(false);
  const [newInvite, setNewInvite] = useState<Invite | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  async function load() {
    setLoading(true);
    setLoadError(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const [profileRes, linksRes, invitesRes, assignmentsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("first_name, last_name, username")
        .eq("id", user.id)
        .maybeSingle(),
      supabase.rpc("get_my_trainer_links"),
      supabase
        .from("trainer_invites")
        .select("id, token, client_name, created_at")
        .eq("trainer_id", user.id)
        .is("accepted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("homework_assignments")
        .select(
          "id, pet_id, trainer_id, skill_id, title, instructions, attempts_per_session, sessions_per_week, active, created_at"
        )
        .eq("trainer_id", user.id)
        .eq("active", true),
    ]);

    if (linksRes.error || invitesRes.error || assignmentsRes.error) {
      console.error(
        "Error cargando clientes:",
        linksRes.error ?? invitesRes.error ?? assignmentsRes.error
      );
      setLoadError(true);
      setLoading(false);
      return;
    }

    const profile = profileRes.data;
    const fullName = [profile?.first_name, profile?.last_name]
      .filter((part): part is string => Boolean(part && part.trim()))
      .join(" ");
    setTrainerName(fullName || profile?.username || null);

    const trainerLinks: TrainerLink[] = (linksRes.data ?? [])
      .filter((row) => row.role === "trainer")
      .map((row) => ({
        link_id: row.link_id,
        pet_id: row.pet_id,
        pet_name: row.pet_name,
        pet_photo: row.pet_photo,
        role: "trainer",
        other_name: row.other_name,
        client_name: row.client_name,
        created_at: row.created_at,
      }));

    const activeAssignments: HomeworkAssignment[] = assignmentsRes.data ?? [];

    // Registros de esta semana de todos los deberes activos
    let weekLogs: HomeworkLog[] = [];
    if (activeAssignments.length > 0) {
      const { data: logsData, error: logsError } = await supabase
        .from("homework_logs")
        .select("id, assignment_id, pet_id, attempts, successes, logged_at")
        .in(
          "assignment_id",
          activeAssignments.map((a) => a.id)
        )
        .gte("logged_at", startOfWeek().toISOString());

      if (logsError) {
        console.error("Error cargando registros de deberes:", logsError);
      } else {
        weekLogs = logsData ?? [];
      }
    }

    setLinks(trainerLinks);
    setInvites(invitesRes.data ?? []);
    setAssignments(activeAssignments);
    setLogs(weekLogs);
    setLoading(false);
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cumplimiento de cada perro esta semana
  const dogs: DogSummary[] = useMemo(() => {
    return links.map((link) => {
      const petAssignments = assignments.filter((a) => a.pet_id === link.pet_id);
      const progress = petAssignments.map((a) => getWeekProgress(a, logs));
      return { link, progress, compliance: getCompliance(progress) };
    });
  }, [links, assignments, logs]);

  async function handleCreateInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = clientName.trim();
    if (!name) return;

    setCreating(true);
    setCreateError(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setCreating(false);
      setCreateError(true);
      return;
    }

    const { data, error } = await supabase
      .from("trainer_invites")
      .insert({ trainer_id: user.id, client_name: name.slice(0, 80) })
      .select("id, token, client_name, created_at")
      .single();

    setCreating(false);

    if (error || !data) {
      console.error("Error creando invitación:", error);
      setCreateError(true);
      return;
    }

    setNewInvite(data);
    setInvites((prev) => [data, ...prev]);
    setClientName("");
  }

  async function handleCopy(token: string) {
    try {
      await navigator.clipboard.writeText(buildInviteUrl(origin, token));
      setCopiedToken(token);
      window.setTimeout(() => setCopiedToken(null), 2000);
    } catch (error) {
      console.error("No se pudo copiar el enlace:", error);
    }
  }

  async function handleDeleteInvite(invite: Invite) {
    if (!window.confirm(t("confirmDeleteInvite"))) return;

    const { error } = await supabase
      .from("trainer_invites")
      .delete()
      .eq("id", invite.id);

    if (error) {
      console.error("Error borrando invitación:", error);
      return;
    }

    setInvites((prev) => prev.filter((i) => i.id !== invite.id));
    if (newInvite?.id === invite.id) setNewInvite(null);
  }

  function whatsAppLink(token: string): string {
    const url = buildInviteUrl(origin, token);
    const message = trainerName
      ? t("whatsAppMessage", { trainer: trainerName, url })
      : t("whatsAppMessageNoName", { url });
    return buildWhatsAppUrl(message);
  }

  function renderInviteActions(invite: Invite) {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => handleCopy(invite.token)}
          className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-300"
        >
          {copiedToken === invite.token ? t("copied") : t("copy")}
        </button>

        <a
          href={whatsAppLink(invite.token)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
        >
          {t("sendWhatsApp")}
        </a>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-5xl">
        {/* CABECERA */}

        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-extrabold text-blue-700 md:text-5xl">
              {t("title")}
            </h1>
            <p className="mt-3 text-lg text-slate-600">{t("subtitle")}</p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl bg-slate-700 px-5 py-3 text-center font-semibold text-white transition hover:bg-slate-800"
          >
            {t("backToDashboard")}
          </Link>
        </div>

        {/* INVITAR */}

        <section className="mb-8 rounded-2xl bg-white p-6 shadow">
          <h2 className="text-2xl font-bold text-[#1e3a5f]">{t("inviteTitle")}</h2>
          <p className="mt-2 text-slate-600">{t("inviteHelp")}</p>

          <form
            onSubmit={handleCreateInvite}
            className="mt-4 flex flex-col gap-3 sm:flex-row"
          >
            <input
              type="text"
              value={clientName}
              maxLength={80}
              onChange={(e) => setClientName(e.target.value)}
              placeholder={t("clientNamePlaceholder")}
              className="flex-1 rounded-xl border border-slate-300 p-3 text-slate-900 placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={creating || !clientName.trim()}
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? t("creating") : t("createInvite")}
            </button>
          </form>

          {createError && (
            <p className="mt-3 text-sm font-semibold text-red-600">{t("errorCreate")}</p>
          )}

          {newInvite && (
            <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4">
              <p className="font-semibold text-green-800">
                {t("inviteReady", { name: newInvite.client_name })}
              </p>
              <p className="mt-1 break-all text-sm text-slate-600">
                {buildInviteUrl(origin, newInvite.token)}
              </p>
              <div className="mt-3">
                {renderInviteActions(newInvite)}
              </div>
            </div>
          )}
        </section>

        {loading ? (
          <div className="rounded-2xl bg-white p-4 shadow">
            <PawsiLoading text={t("loading")} variant="card" />
          </div>
        ) : loadError ? (
          <div className="rounded-2xl bg-white p-6 text-center font-semibold text-red-600 shadow">
            {t("errorLoad")}
          </div>
        ) : (
          <>
            {/* INVITACIONES PENDIENTES */}

            {invites.filter((i) => i.id !== newInvite?.id).length > 0 && (
              <section className="mb-8 rounded-2xl bg-white p-6 shadow">
                <h2 className="mb-4 text-xl font-bold text-[#1e3a5f]">
                  {t("pendingTitle")}
                </h2>

                <ul className="space-y-3">
                  {invites
                    .filter((i) => i.id !== newInvite?.id)
                    .map((invite) => (
                      <li
                        key={invite.id}
                        className="flex flex-col gap-3 rounded-xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="font-semibold text-slate-800">
                          {invite.client_name}
                        </span>

                        <div className="flex flex-wrap items-center gap-2">
                          {renderInviteActions(invite)}
                          <button
                            type="button"
                            onClick={() => handleDeleteInvite(invite)}
                            className="rounded-xl px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                          >
                            {t("deleteInvite")}
                          </button>
                        </div>
                      </li>
                    ))}
                </ul>
              </section>
            )}

            {/* PERROS DE LOS CLIENTES */}

            <section>
              <h2 className="mb-4 text-2xl font-bold">{t("clientsTitle")}</h2>

              {dogs.length === 0 ? (
                <div className="rounded-2xl bg-white p-8 text-center text-slate-600 shadow">
                  {t("noClients")}
                </div>
              ) : (
                <div className="grid gap-5 md:grid-cols-2">
                  {dogs.map(({ link, progress, compliance }) => {
                    const tone = complianceTone(compliance);
                    const done = progress.reduce((s, p) => s + Math.min(p.done, p.target), 0);
                    const target = progress.reduce((s, p) => s + p.target, 0);
                    const attempts = progress.reduce((s, p) => s + p.attempts, 0);
                    const successes = progress.reduce((s, p) => s + p.successes, 0);
                    const rate = attempts > 0 ? Math.round((successes / attempts) * 100) : null;

                    return (
                      <Link
                        key={link.link_id}
                        href={`/clients/${link.pet_id}`}
                        className="group flex flex-col gap-4 rounded-2xl bg-white p-5 shadow transition hover:shadow-xl"
                      >
                        <div className="flex items-center gap-4">
                          {link.pet_photo ? (
                            <Image
                              src={link.pet_photo}
                              alt={link.pet_name}
                              width={80}
                              height={80}
                              className="h-20 w-20 shrink-0 rounded-full border-4 border-blue-500 object-cover"
                            />
                          ) : (
                            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-slate-200 text-4xl">
                              🐶
                            </div>
                          )}

                          <div className="min-w-0">
                            <h3 className="truncate text-2xl font-bold group-hover:text-blue-700">
                              {link.pet_name}
                            </h3>
                            <p className="truncate text-sm text-slate-500">
                              {t("owner", { name: link.other_name })}
                            </p>
                            {link.client_name && (
                              <p className="truncate text-xs text-slate-400">
                                {link.client_name}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-sm font-semibold ${COMPLIANCE_CLASSES[tone]}`}
                          >
                            {compliance === null
                              ? t("noHomework")
                              : t("compliance", { value: compliance })}
                          </span>

                          {compliance !== null && (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                              {t("sessionsThisWeek", { done, target })}
                            </span>
                          )}

                          {rate !== null && (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                              {t("successRate", { rate })}
                            </span>
                          )}
                        </div>

                        <span className="text-sm font-semibold text-blue-600">
                          {t("viewDog")}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}