// Pide a la IA un nombre para un grupo de habilidades, en el idioma
// actual del usuario. Si la IA falla (sin clave, sin internet, sin
// crédito, sin huesitos, etc.), usa automáticamente el generador local
// como red de seguridad. Así la app nunca se queda sin nombre ni se rompe.

import {
  buildAvailableGroupNames,
  type GroupSkillInput,
} from "@/lib/skill-group-names";
import { notifyHuesitosChanged } from "@/lib/huesitos-client";

type SuggestArgs = {
  skills: GroupSkillInput[];
  // Nombres que NO se pueden repetir: los de otros grupos
  // + los ya sugeridos en esta sesión.
  avoid: string[];
  // Idioma actual del usuario ("es" o "en").
  locale: string;
};

type GroupNameResponse = {
  name?: unknown;
  huesitos?: { spent?: unknown } | null;
};

export async function suggestGroupName({
  skills,
  avoid,
  locale,
}: SuggestArgs): Promise<string> {
  const avoidLower = avoid.map((a) => a.trim().toLowerCase());

  // 1) Intentar con la IA (si no hay huesitos, el servidor responde
  //    "no_huesitos" y pasamos directamente al generador local)
  try {
    const res = await fetch("/api/group-name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skills, avoid, locale }),
    });

    if (res.ok) {
      const data: GroupNameResponse = await res.json();
      const name = typeof data.name === "string" ? data.name.trim() : "";

      // Se han gastado huesitos: la pastilla del saldo se actualiza sola
      if (data.huesitos && typeof data.huesitos.spent === "number" && data.huesitos.spent > 0) {
        notifyHuesitosChanged();
      }

      if (name && !avoidLower.includes(name.toLowerCase())) {
        return name;
      }
    }
  } catch {
    // Si algo falla, seguimos al generador local.
  }

  // 2) Red de seguridad: generador local, en el mismo idioma.
  const available = buildAvailableGroupNames(skills, avoid, locale);
  return available[0] ?? (locale === "en" ? "Group" : "Grupo");
}