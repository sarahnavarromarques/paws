"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

export type HealthTab = "vaccines" | "deworming";

type Props = {
  initialTab: HealthTab;
  vaccines: ReactNode;
  deworming: ReactNode;
};

// Pestañas Vacunas | Desparasitaciones de la pantalla Salud.
// Las dos pestañas se quedan montadas (solo se ocultan) para no perder
// lo que se ha hecho en una al cambiar a la otra.
export default function HealthTabs({ initialTab, vaccines, deworming }: Props) {
  const t = useTranslations("Health");
  const [tab, setTab] = useState<HealthTab>(initialTab);

  function select(next: HealthTab) {
    setTab(next);

    // Se guarda en la dirección (sin recargar) para que al volver se mantenga
    try {
      const url = new URL(window.location.href);
      if (next === "vaccines") {
        url.searchParams.delete("tab");
      } else {
        url.searchParams.set("tab", next);
      }
      window.history.replaceState(null, "", url.toString());
    } catch {
      // Si el navegador no deja cambiar la dirección, la pestaña funciona igual
    }
  }

  const tabs: { id: HealthTab; label: string }[] = [
    { id: "vaccines", label: t("tabVaccines") },
    { id: "deworming", label: t("tabDeworming") },
  ];

  return (
    <>
      <div
        data-tour="health-tabs"
        role="tablist"
        className="mb-6 flex gap-2 rounded-2xl bg-white p-1.5 shadow-sm"
      >
        {tabs.map((item) => {
          const isActive = item.id === tab;

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => select(item.id)}
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition md:text-base ${
                isActive
                  ? "bg-rose-200 text-rose-800"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" hidden={tab !== "vaccines"}>
        {vaccines}
      </div>

      <div role="tabpanel" hidden={tab !== "deworming"}>
        {deworming}
      </div>
    </>
  );
}