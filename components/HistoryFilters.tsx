"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { buildHistoryHref, type HistoryQuery } from "@/lib/history-filters";

type SkillOption = {
  id: number;
  name: string;
};

type Props = {
  petId: number;
  query: HistoryQuery;
  skillOptions: SkillOption[];
};

// Filtros por habilidad y por fecha del historial.
// Se aplican al momento: cada cambio actualiza la dirección y la lista.
export default function HistoryFilters({ petId, query, skillOptions }: Props) {
  const router = useRouter();
  const t = useTranslations("PetHistory");

  const hasFilters = query.skill !== "" || query.from !== "" || query.to !== "";

  function apply(changes: Partial<HistoryQuery>) {
    const href = buildHistoryHref(petId, { ...query, ...changes });
    router.replace(href, { scroll: false });
  }

  return (
    <div className="mb-6 rounded-2xl bg-white p-5 shadow">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-600">
            {t("skillLabel")}
          </span>
          <select
            value={query.skill}
            onChange={(e) => apply({ skill: e.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          >
            <option value="">{t("allSkills")}</option>
            {skillOptions.map((option) => (
              <option key={option.id} value={String(option.id)}>
                {option.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-600">
            {t("dateFrom")}
          </span>
          <input
            type="date"
            value={query.from}
            max={query.to || undefined}
            onChange={(e) => apply({ from: e.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-600">
            {t("dateTo")}
          </span>
          <input
            type="date"
            value={query.to}
            min={query.from || undefined}
            onChange={(e) => apply({ to: e.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white p-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </label>
      </div>

      {hasFilters && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => apply({ skill: "", from: "", to: "" })}
            className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            ✕ {t("clearFilters")}
          </button>
        </div>
      )}
    </div>
  );
}