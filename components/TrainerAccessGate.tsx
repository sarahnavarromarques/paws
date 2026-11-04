"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import Pawsi from "@/components/Pawsi";
import {
  readTrainerAccess,
  trialDaysLeft,
  type TrainerAccess,
} from "@/lib/trainer-access";

const supabase = createClient();

type Props = {
  children: ReactNode;
};

// Envuelve las herramientas de adiestrador (invitar, mandar deberes).
// - Con PAWS PRO: las muestra tal cual.
// - En la prueba gratis: las muestra con un aviso de los días que quedan.
// - Prueba terminada: en su lugar, invita a hacerse PRO.
export default function TrainerAccessGate({ children }: Props) {
  const t = useTranslations("TrainerAccess");
  const [access, setAccess] = useState<TrainerAccess | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase.rpc("get_my_trainer_access");
      if (cancelled) return;
      if (error) {
        console.error("Error comprobando el acceso de adiestrador:", error);
        return;
      }
      setAccess(readTrainerAccess(data));
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Mientras carga (o si falla) se muestran las herramientas:
  // Supabase impide igualmente guardar sin acceso.
  if (!access || access.isPro) return <>{children}</>;

  if (!access.hasAccess) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
        <Pawsi pose="espera" size={90} />
        <p className="mt-3 font-bold text-amber-900">{t("expiredTitle")}</p>
        <p className="mt-1 text-sm text-amber-800">{t("expiredText")}</p>
        <Link
          href="/pro"
          className="mt-4 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
        >
          {t("goPro")}
        </Link>
      </div>
    );
  }

  const daysLeft = trialDaysLeft(access.trialEndsAt);

  return (
    <>
      <div className="my-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm">
        <span className="font-semibold text-blue-900">
          {t("trialDaysLeft", { days: daysLeft })}
        </span>
        <Link href="/pro" className="font-semibold text-blue-700 underline">
          {t("goPro")}
        </Link>
      </div>
      {children}
    </>
  );
}
