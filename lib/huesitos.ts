import type { createClient } from "./supabase/server";
import type { AiFeature } from "./ai-usage";
import { createAdminClient } from "./stripe";
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
  // Id del movimiento de cobro, para poder devolverlo si la IA falla
  transactionId: number | null;
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
 * ¿Puede pagar esta función? (solo consulta, no cobra)
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
 * Cobra los huesitos de una función. Se llama ANTES de llamar a la IA:
 * si no hay saldo, devuelve ok = false y no se llama a la IA.
 * Si después la IA falla, hay que devolverlos con refundHuesitos().
 * Nunca lanza errores.
 */
export async function spendHuesitos(
  supabase: ServerSupabase,
  feature: AiFeature
): Promise<SpendResult> {
  const amount = HUESITO_COSTS[feature];
  const failed: SpendResult = {
    ok: false,
    unlimited: false,
    balance: null,
    spent: 0,
    transactionId: null,
  };

  try {
    const { data, error } = await supabase.rpc("spend_huesitos", {
      p_amount: amount,
      p_feature: feature,
    });

    if (error) {
      console.error(`[huesitos] Error cobrando ${feature}:`, error.message);
      return failed;
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      console.error(`[huesitos] Respuesta inesperada cobrando ${feature}.`);
      return failed;
    }

    const ok = data.ok === true;
    const unlimited = data.unlimited === true;
    const balance = typeof data.balance === "number" ? data.balance : null;
    const transactionId =
      typeof data.transaction_id === "number" ? data.transaction_id : null;

    if (!ok && data.reason !== "no_huesitos") {
      console.error(`[huesitos] No se pudo cobrar ${feature}:`, data.reason);
    }

    return {
      ok,
      unlimited,
      balance,
      spent: ok && !unlimited ? amount : 0,
      transactionId: ok ? transactionId : null,
    };
  } catch (err) {
    console.error(`[huesitos] Error inesperado cobrando ${feature}:`, err);
    return failed;
  }
}

/**
 * Devuelve un cobro cuando la IA ha fallado. Solo funciona desde el servidor
 * (usa la conexión de administrador). Nunca lanza errores.
 */
export async function refundHuesitos(
  spend: SpendResult | null,
  feature: AiFeature
): Promise<void> {
  if (!spend || !spend.ok || spend.transactionId === null) {
    return;
  }

  const admin = createAdminClient();

  if (!admin) {
    console.error(`[huesitos] No se pudo devolver ${feature}: falta la clave de servidor.`);
    return;
  }

  try {
    const { data, error } = await admin.rpc("refund_huesitos", {
      p_transaction_id: spend.transactionId,
    });

    if (error) {
      console.error(`[huesitos] Error devolviendo ${feature}:`, error.message);
      return;
    }

    if (!data || typeof data !== "object" || Array.isArray(data) || data.ok !== true) {
      console.error(`[huesitos] No se pudo devolver ${feature}:`, data);
    }
  } catch (err) {
    console.error(`[huesitos] Error inesperado devolviendo ${feature}:`, err);
  }
}