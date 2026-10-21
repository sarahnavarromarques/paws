import Link from "next/link";
import { getTranslations } from "next-intl/server";

import type { SkillProgressItem } from "@/lib/pet-skill-progress";

type Props = {
  petId: number;
  items: SkillProgressItem[];
  average: number;
};

type TFunction = Awaited<ReturnType<typeof getTranslations>>;

function formatDaysSince(days: number | null, t: TFunction): string {
  if (days === null) {
    return t("daysSinceNever");
  }

  if (days === 0) {
    return t("daysSinceToday");
  }

  if (days === 1) {
    return t("daysSinceOneDay");
  }

  return t("daysSinceMultiple", { days });
}

// Tarjeta "Habilidades del perro" con una barra de progreso por habilidad.
// Se usa en la ficha del perro y en la pantalla de progreso.
export default async function SkillProgressList({
  petId,
  items,
  average,
}: Props) {
  const t = await getTranslations("PetProfile");

  return (
    <div className="mb-8 rounded-2xl border bg-white p-8 shadow">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-3xl font-bold">{t("dogSkillsTitle")}</h2>

        <div className="flex items-center gap-4">
          {items.length > 0 && (
            <div className="rounded-xl bg-slate-100 px-4 py-2 text-center">
              <span className="text-2xl font-bold text-blue-600">
                {average}%
              </span>
              <span className="ml-2 text-sm font-semibold text-slate-500">
                {t("average")}
              </span>
            </div>
          )}

          <Link
            href={`/skills?pet=${petId}`}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            {t("manage")}
          </Link>
        </div>
      </div>

      {items.length > 0 ? (
        <div className="space-y-5">
          {items.map((item) => (
            <div key={item.skillId}>
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold">
                  {item.category ? `${item.category} — ` : ""}
                  {item.name}
                </span>
                <span className="font-bold text-blue-600">
                  {item.progress}%
                </span>
              </div>

              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{ width: `${item.progress}%` }}
                />
              </div>

              <p className="mt-1 text-xs font-medium text-slate-500">
                {item.sessionCount === 0
                  ? t("noSessionsRecorded")
                  : `${t("sessionCount", { count: item.sessionCount })} · ${formatDaysSince(item.lastTrainedDays, t)}`}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-slate-500">
          {t("noSkillsYet")}{" "}
          <Link
            href={`/skills?pet=${petId}`}
            className="font-semibold text-blue-600 hover:underline"
          >
            {t("addSkillsCta")}
          </Link>
        </p>
      )}
    </div>
  );
}