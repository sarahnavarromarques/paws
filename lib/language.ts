import { createClient } from "@/lib/supabase/client";
import {
  LANGUAGE_COOKIE,
  LANGUAGE_COOKIE_MAX_AGE,
} from "@/lib/language-cookie";

export type AppLanguage = "es" | "en";

// Guarda el idioma en el navegador (sirve también sin sesión iniciada)
function saveLanguageCookie(language: AppLanguage) {
  if (typeof document === "undefined") return;

  document.cookie = `${LANGUAGE_COOKIE}=${language}; path=/; max-age=${LANGUAGE_COOKIE_MAX_AGE}; SameSite=Lax`;
}

// Guarda el idioma elegido:
// - siempre en el navegador (cookie)
// - y, si hay sesión iniciada, también en el perfil del usuario.
// Devuelve true si se guardó bien.
export async function saveUserLanguage(
  language: AppLanguage
): Promise<boolean> {
  saveLanguageCookie(language);

  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Sin sesión (login, registro): basta con la cookie
  if (!user) return true;

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    language,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Error guardando el idioma:", error);
    return false;
  }

  return true;
}