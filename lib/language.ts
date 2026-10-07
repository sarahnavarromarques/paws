import { createClient } from "@/lib/supabase/client";

export type AppLanguage = "es" | "en";

// Guarda el idioma elegido en el perfil del usuario.
// Devuelve true si se guardó bien.
export async function saveUserLanguage(
  language: AppLanguage
): Promise<boolean> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

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