import type { createClient } from "./supabase/server";
import type { AiFeature } from "./ai-usage";
import {
  HUESITO_COSTS,
  canAffordFeature,
  toHuesitoWallet,
  type HuesitoWallet,
} from "./huesitos-shared";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

export type SpendResult = {
  ok: boolean;
  unlimited: boolean;
  balance: number | null;
  spent: number;
};

/**
 * Lee el saldo de huesitos del usuario.
 * Devuelve null si no se puede leer (en ese caso se trata como sin saldo).
 */
export async function getHuesitoWallet(
  supabase: ServerSupabase,
  userId: string
): Promise<HuesitoWallet | null> {
  const { data, error } = await supabase
    .from("huesito_wallets")
    .select("purchased_balance, subscription_balance, subscription_expires_at, unlimited")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[huesitos] No se pudo leer el saldo:", error.message);
    return null;
  }

  if (!data) {
    return null;
  }

  return toHuesitoWallet(data);
}

/**
 * ¿Puede pagar esta función? Se comprueba ANTES de llamar a la IA.
 */
export async function hasHuesitosFor(
  supabase: ServerSupabase,
  userId: string,
  feature: AiFeature
): Promise<boolean> {
  const wallet = await getHuesitoWallet(supabase, userId);
  return canAffordFeature(wallet, feature);
}

/**
 * Gasta los huesitos de una función. Se llama DESPUÉS de que la IA
 * haya respondido bien. Nunca lanza errores.
 */
export async function spendHuesitos(
  supabase: ServerSupabase,
  feature: AiFeature
): Promise<SpendResult> {
  const amount = HUESITO_COSTS[feature];
  const failed: SpendResult = { ok: false, unlimited: false, balance: null, spent: 0 };

  try {
    const { data, error } = await supabase.rpc("spend_huesitos", {
      p_amount: amount,
      p_feature: feature,
    });

    if (error) {
      console.error(`[huesitos] Error gastando en ${feature}:`, error.message);
      return failed;
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      console.error(`[huesitos] Respuesta inesperada gastando en ${feature}.`);
      return failed;
    }

    const ok = data.ok === true;
    const unlimited = data.unlimited === true;
    const balance = typeof data.balance === "number" ? data.balance : null;

    if (!ok) {
      console.error(`[huesitos] No se pudo gastar en ${feature}:`, data.reason);
    }

    return {
      ok,
      unlimited,
      balance,
      spent: ok && !unlimited ? amount : 0,
    };
  } catch (err) {
    console.error(`[huesitos] Error inesperado gastando en ${feature}:`, err);
    return failed;
  }
}