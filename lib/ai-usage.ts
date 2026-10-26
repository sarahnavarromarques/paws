import { createClient } from "./supabase/server";

// Funciones de IA de PAWS. Cada llamada se registra con uno de estos nombres.
export type AiFeature =
  | "analyze-progress"
  | "group-name"
  | "pet-questionnaire"
  | "session-chat"
  | "session-guide"
  | "session-progress"
  | "training-order";

// Precios en dólares por cada millón de tokens.
// Si cambiamos de modelo o Anthropic cambia la tarifa, se actualiza solo aquí.
const MODEL_PRICES: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5": { input: 1, output: 5 },
};

const DEFAULT_PRICE = { input: 1, output: 5 };

// Lo que devuelve Anthropic en "usage" (solo los campos que necesitamos).
type UsageLike = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Devuelve el usuario conectado y su cliente de Supabase.
 * Si no hay sesión, devuelve null y la ruta debe responder 401.
 */
export async function getAiUser(): Promise<{
  supabase: ServerSupabase;
  userId: string;
} | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return { supabase, userId: data.user.id };
}

/**
 * Calcula el coste en dólares de una llamada a la IA.
 */
export function calculateAiCost(model: string, usage: UsageLike): number {
  const price = MODEL_PRICES[model] ?? DEFAULT_PRICE;

  const input = usage.input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;

  const cost =
    (input * price.input +
      cacheWrite * price.input * 1.25 +
      cacheRead * price.input * 0.1 +
      output * price.output) /
    1_000_000;

  return Math.round(cost * 1_000_000) / 1_000_000;
}

/**
 * Guarda en la tabla ai_usage el coste real de una llamada a la IA.
 * Nunca lanza errores: si el registro falla, la app sigue funcionando.
 */
export async function recordAiUsage(params: {
  supabase: ServerSupabase;
  userId: string;
  feature: AiFeature;
  model: string;
  usage: UsageLike;
}): Promise<void> {
  const { supabase, userId, feature, model, usage } = params;

  try {
    const inputTokens =
      (usage.input_tokens ?? 0) +
      (usage.cache_creation_input_tokens ?? 0) +
      (usage.cache_read_input_tokens ?? 0);

    const { error } = await supabase.from("ai_usage").insert({
      user_id: userId,
      feature,
      model,
      input_tokens: inputTokens,
      output_tokens: usage.output_tokens ?? 0,
      cost_usd: calculateAiCost(model, usage),
    });

    if (error) {
      console.error(`[ai-usage] No se pudo registrar ${feature}:`, error.message);
    }
  } catch (err) {
    console.error(`[ai-usage] Error inesperado registrando ${feature}:`, err);
  }
}