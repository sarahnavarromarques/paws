import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import type { AbstractIntlMessages } from "next-intl";

import { createClient } from "../lib/supabase/server";
import { LANGUAGE_COOKIE } from "../lib/language-cookie";
import {
  DEFAULT_ACCOUNT_TYPE,
  isAccountType,
  type AccountType,
} from "../lib/account-type";

const SUPPORTED_LOCALES = ["es", "en"] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];
const DEFAULT_LOCALE: Locale = "es";

// Funciones cuyos textos viven en su propio archivo:
// messages/features/<nombre>.<idioma>.json
const FEATURE_MESSAGES = ["vaccines", "health", "trainer", "billing"] as const;

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

// Textos de funciones en archivos propios (p. ej. vacunas).
// Si uno falla, se registra y se sigue con los demás.
async function loadFeatureMessages(
  locale: Locale
): Promise<AbstractIntlMessages[]> {
  const layers: AbstractIntlMessages[] = [];

  for (const feature of FEATURE_MESSAGES) {
    try {
      layers.push(
        (await import(`../messages/features/${feature}.${locale}.json`)).default
      );
    } catch (error) {
      console.error(`[i18n] Error cargando textos de "${feature}":`, error);
    }
  }

  return layers;
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

// Idioma guardado en el navegador (cookie). Se usa cuando no hay sesión
// o cuando el perfil todavía no tiene idioma.
async function readCookieLocale(): Promise<Locale | null> {
  try {
    const cookieStore = await cookies();
    const value = cookieStore.get(LANGUAGE_COOKIE)?.value;
    return isLocale(value) ? value : null;
  } catch {
    return null;
  }
}

export default getRequestConfig(async () => {
  // Orden de prioridad: perfil del usuario → cookie del navegador → español
  let locale: Locale = (await readCookieLocale()) ?? DEFAULT_LOCALE;
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

  // 1) Textos generales + textos de funciones en archivos propios
  let messagesWithFeatures = baseMessages;
  for (const layer of await loadFeatureMessages(locale)) {
    messagesWithFeatures = mergeMessages(messagesWithFeatures, layer);
  }

  // 2) Sustituciones según el tipo de cuenta
  let messages = messagesWithFeatures;

  try {
    const layers = await loadAccountOverrides(accountType, locale);
    for (const layer of layers) {
      messages = mergeMessages(messages, layer);
    }
  } catch (error) {
    // Si falla, usamos los textos sin sustituciones: la app nunca se queda sin textos
    console.error("[i18n] Error cargando textos del tipo de cuenta:", error);
    messages = messagesWithFeatures;
  }

  return {
    locale,
    messages,
  };
});