import { getRequestConfig } from "next-intl/server";
import type { AbstractIntlMessages } from "next-intl";

import { createClient } from "../lib/supabase/server";
import {
  DEFAULT_ACCOUNT_TYPE,
  isAccountType,
  type AccountType,
} from "../lib/account-type";

const SUPPORTED_LOCALES = ["es", "en"] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];
const DEFAULT_LOCALE: Locale = "es";

function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

// Combina dos grupos de textos: lo de "override" sustituye a lo de "base"
function mergeMessages(
  base: AbstractIntlMessages,
  override: AbstractIntlMessages
): AbstractIntlMessages {
  const result: AbstractIntlMessages = { ...base };

  for (const [key, value] of Object.entries(override)) {
    const current = result[key];
    result[key] =
      typeof current === "object" && typeof value === "object"
        ? mergeMessages(current, value)
        : value;
  }

  return result;
}

// Sustituciones según el tipo de cuenta:
// - particular: ninguna ("mascotas")
// - profesional y centro: "dogs" ("perros")
// - refugio: "dogs" + "shelter" (títulos propios del refugio)
async function loadAccountOverrides(
  accountType: AccountType,
  locale: Locale
): Promise<AbstractIntlMessages[]> {
  if (accountType === "particular") return [];

  const layers: AbstractIntlMessages[] = [
    (await import(`../messages/account/dogs.${locale}.json`)).default,
  ];

  if (accountType === "refugio") {
    layers.push(
      (await import(`../messages/account/shelter.${locale}.json`)).default
    );
  }

  return layers;
}

export default getRequestConfig(async () => {
  let locale: Locale = DEFAULT_LOCALE;
  let accountType: AccountType = DEFAULT_ACCOUNT_TYPE;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("language, account_type")
        .eq("id", user.id)
        .maybeSingle();

      if (isLocale(profile?.language)) {
        locale = profile.language;
      }

      const profileAccountType = profile?.account_type;
      if (isAccountType(profileAccountType)) {
        accountType = profileAccountType;
      }
    }
  } catch (error) {
    console.error("[i18n] Error leyendo el perfil:", error);
  }

  const baseMessages: AbstractIntlMessages = (
    await import(`../messages/${locale}.json`)
  ).default;

  let messages = baseMessages;

  try {
    const layers = await loadAccountOverrides(accountType, locale);
    for (const layer of layers) {
      messages = mergeMessages(messages, layer);
    }
  } catch (error) {
    // Si falla, usamos los textos normales: la app nunca se queda sin textos
    console.error("[i18n] Error cargando textos del tipo de cuenta:", error);
    messages = baseMessages;
  }

  return {
    locale,
    messages,
  };
});