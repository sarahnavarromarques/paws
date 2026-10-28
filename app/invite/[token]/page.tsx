"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import Pawsi from "@/components/Pawsi";
import PawsiLoading from "@/components/PawsiLoading";
import { readJsonObject } from "@/lib/homework";

const supabase = createClient();

type InviteInfo = {
  trainerName: string;
  isOwnInvite: boolean;
  usedByOther: boolean;
};

type PetOption = {
  id: number;
  name: string;
  photo: string | null;
};

type Status =
  | "loading"
  | "not_found"
  | "logged_out"
  | "own_invite"
  | "used_by_other"
  | "choose"
  | "done";

// Enlace que el adiestrador envía a su cliente por WhatsApp
export default function InvitePage() {
  const t = useTranslations("Invite");
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [status, setStatus] = useState<Status>("loading");
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [pets, setPets] = useState<PetOption[]>([]);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [newPetName, setNewPetName] = useState("");

  async function load() {
    setStatus("loading");

    const { data, error: inviteError } = await supabase.rpc("get_trainer_invite", {
      p_token: token,
    });

    const info = readJsonObject(data);

    if (inviteError || !info || info.ok !== true) {
      setStatus("not_found");
      return;
    }

    const inviteInfo: InviteInfo = {
      trainerName:
        typeof info.trainer_name === "string" ? info.trainer_name : "PAWS",
      isOwnInvite: info.is_own_invite === true,
      usedByOther: info.used_by_other === true,
    };
    setInvite(inviteInfo);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setStatus("logged_out");
      return;
    }

    setUserId(user.id);

    if (inviteInfo.isOwnInvite) {
      setStatus("own_invite");
      return;
    }

    if (inviteInfo.usedByOther) {
      setStatus("used_by_other");
      return;
    }

    const { data: petsData } = await supabase
      .from("pets")
      .select("id, name, photo")
      .eq("user_id", user.id)
      .order("name", { ascending: true });

    const ownPets = petsData ?? [];
    setPets(ownPets);

    // Con un solo perro, ya viene marcado
    if (ownPets.length === 1) {
      setSelected(new Set([ownPets[0].id]));
    }

    setStatus("choose");
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function togglePet(petId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(petId)) {
        next.delete(petId);
      } else {
        next.add(petId);
      }
      return next;
    });
  }

  async function acceptWith(petIds: number[]) {
    const { data, error: acceptError } = await supabase.rpc("accept_trainer_invite", {
      p_token: token,
      p_pet_ids: petIds,
    });

    setAccepting(false);

    const result = readJsonObject(data);

    if (acceptError || !result || result.ok !== true) {
      console.error("Error aceptando invitación:", acceptError ?? result);
      if (result?.reason === "used_by_other") {
        setStatus("used_by_other");
        return;
      }
      setError(t("errorGeneric"));
      return;
    }

    setStatus("done");
  }

  async function handleAccept() {
    if (selected.size === 0) {
      setError(t("selectAtLeastOne"));
      return;
    }

    setAccepting(true);
    setError(null);
    await acceptWith(Array.from(selected));
  }

  // Sin perros: se crea uno solo con el nombre y se acepta a la vez
  // (el resto de la ficha se puede completar después)
  async function handleCreatePetAndAccept(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = newPetName.trim();
    if (!name || !userId) return;

    setAccepting(true);
    setError(null);

    const { data: pet, error: petError } = await supabase
      .from("pets")
      .insert({ user_id: userId, name: name.slice(0, 60) })
      .select("id")
      .single();

    if (petError || !pet) {
      console.error("Error creando el perro:", petError);
      setAccepting(false);
      setError(t("errorGeneric"));
      return;
    }

    await acceptWith([pet.id]);
  }

  const nextParam = encodeURIComponent(`/invite/${token}`);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl">
        {status === "loading" ? (
          <PawsiLoading text={t("loading")} variant="card" />
        ) : status === "not_found" ? (
          <div className="text-center">
            <div className="flex justify-center">
              <Pawsi pose="espera" size={110} />
            </div>
            <p className="mt-4 text-slate-600">{t("notFound")}</p>
          </div>
        ) : (
          <>
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                {t("title")}
              </p>
              <h1 className="mt-2 text-2xl font-extrabold text-[#1e3a5f]">
                {t("fromTrainer", { trainer: invite?.trainerName ?? "PAWS" })}
              </h1>
              <p className="mt-3 text-slate-600">{t("explain")}</p>
            </div>

            <div className="mt-6">
              {status === "logged_out" && (
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
              )}

              {status === "own_invite" && (
                <p className="rounded-xl bg-amber-50 p-4 text-center text-amber-800">
                  {t("ownInvite")}
                </p>
              )}

              {status === "used_by_other" && (
                <p className="rounded-xl bg-amber-50 p-4 text-center text-amber-800">
                  {t("usedByOther")}
                </p>
              )}

              {status === "choose" &&
                (pets.length === 0 ? (
                  <form onSubmit={handleCreatePetAndAccept}>
                    <p className="mb-3 font-semibold text-slate-700">{t("noPets")}</p>
                    <input
                      type="text"
                      value={newPetName}
                      maxLength={60}
                      onChange={(e) => setNewPetName(e.target.value)}
                      placeholder={t("petNamePlaceholder")}
                      className="w-full rounded-xl border border-slate-300 p-3 text-slate-900 placeholder:text-slate-400"
                    />

                    {error && (
                      <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>
                    )}

                    <button
                      type="submit"
                      disabled={accepting || !newPetName.trim()}
                      className="mt-4 w-full rounded-xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                    >
                      {accepting ? t("accepting") : t("addPetAndAccept")}
                    </button>
                  </form>
                ) : (
                  <>
                    <p className="mb-3 font-semibold text-slate-700">{t("choosePets")}</p>

                    <ul className="space-y-2">
                      {pets.map((pet) => {
                        const checked = selected.has(pet.id);
                        return (
                          <li key={pet.id}>
                            <button
                              type="button"
                              onClick={() => togglePet(pet.id)}
                              aria-pressed={checked}
                              className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition ${
                                checked
                                  ? "border-blue-500 bg-blue-50"
                                  : "border-slate-200 hover:bg-slate-50"
                              }`}
                            >
                              {pet.photo ? (
                                <Image
                                  src={pet.photo}
                                  alt={pet.name}
                                  width={48}
                                  height={48}
                                  className="h-12 w-12 rounded-full object-cover"
                                />
                              ) : (
                                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-2xl">
                                  🐶
                                </span>
                              )}
                              <span className="flex-1 font-semibold text-slate-800">
                                {pet.name}
                              </span>
                              <span className="text-xl">{checked ? "✅" : "⬜"}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>

                    {error && (
                      <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>
                    )}

                    <button
                      type="button"
                      onClick={handleAccept}
                      disabled={accepting}
                      className="mt-5 w-full rounded-xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                    >
                      {accepting ? t("accepting") : t("accept")}
                    </button>
                  </>
                ))}

              {status === "done" && (
                <div className="text-center">
                  <div className="flex justify-center">
                    <Pawsi pose="celebra" size={110} />
                  </div>
                  <h2 className="mt-3 text-2xl font-bold text-green-700">
                    {t("successTitle")}
                  </h2>
                  <p className="mt-2 text-slate-600">
                    {t("successText", { trainer: invite?.trainerName ?? "PAWS" })}
                  </p>
                  <Link
                    href="/homework"
                    className="mt-5 inline-block rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
                  >
                    {t("goHomework")}
                  </Link>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}