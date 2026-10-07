import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_ACCOUNT_TYPE,
  isAccountType,
  type AccountType,
} from "@/lib/account-type";

// Lee el tipo de cuenta del usuario con sesión iniciada.
// SOLO para usar en el servidor (rutas de API y páginas de servidor).
// Si no hay sesión o algo falla, devuelve "particular" para no romper nada.
export async function getCurrentAccountType(): Promise<AccountType> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return DEFAULT_ACCOUNT_TYPE;

    const { data: profile } = await supabase
      .from("profiles")
      .select("account_type")
      .eq("id", user.id)
      .maybeSingle();

    const value = profile?.account_type;

    return isAccountType(value) ? value : DEFAULT_ACCOUNT_TYPE;
  } catch (error) {
    console.error("Error leyendo el tipo de cuenta:", error);
    return DEFAULT_ACCOUNT_TYPE;
  }
}