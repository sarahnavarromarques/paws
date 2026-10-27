import type { AiFeature } from "./ai-usage";

// Precio en huesitos de cada función de IA.
// Para cambiar un precio, se cambia solo aquí.
export const HUESITO_COSTS: Record<AiFeature, number> = {
  "group-name": 1,
  "session-progress": 1,
  "session-chat": 1,
  "analyze-progress": 1,
  "session-guide": 2,
  "training-order": 4,
  "pet-questionnaire": 4,
};

export const WELCOME_HUESITOS = 20;

// Fila tal y como está en la tabla huesito_wallets.
export type HuesitoWalletRow = {
  purchased_balance: number;
  subscription_balance: number;
  subscription_expires_at: string | null;
  unlimited: boolean;
};

// Saldo listo para usar: los de la suscripción solo cuentan si no han caducado.
export type HuesitoWallet = {
  balance: number;
  unlimited: boolean;
};

export function toHuesitoWallet(row: HuesitoWalletRow): HuesitoWallet {
  const subscriptionActive =
    row.subscription_expires_at !== null &&
    new Date(row.subscription_expires_at).getTime() > Date.now();

  const subscription = subscriptionActive ? row.subscription_balance : 0;

  return {
    balance: subscription + row.purchased_balance,
    unlimited: row.unlimited,
  };
}

// ¿Tiene huesitos suficientes para usar esta función?
export function canAffordFeature(
  wallet: HuesitoWallet | null,
  feature: AiFeature
): boolean {
  if (!wallet) return false;
  if (wallet.unlimited) return true;
  return wallet.balance >= HUESITO_COSTS[feature];
}