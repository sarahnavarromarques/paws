// Packs de huesitos de compra única. Los comprados no caducan.
// Para cambiar un pack: aquí (cantidad y precio que se muestra) y en Stripe
// (el precio real). El id del precio de Stripe va en las variables
// STRIPE_PRICE_HUESITOS_100, STRIPE_PRICE_HUESITOS_300, STRIPE_PRICE_HUESITOS_1000.

export type HuesitoPackId = "pack100" | "pack300" | "pack1000";

export type HuesitoPack = {
  id: HuesitoPackId;
  huesitos: number;
  // Precio que se muestra (con IVA). El que se cobra es el de Stripe.
  priceEs: string;
  priceEn: string;
  // Pack destacado en la página
  featured?: boolean;
};

export const HUESITO_PACKS: HuesitoPack[] = [
  { id: "pack100", huesitos: 100, priceEs: "2,99 €", priceEn: "€2.99" },
  { id: "pack300", huesitos: 300, priceEs: "6,99 €", priceEn: "€6.99", featured: true },
  { id: "pack1000", huesitos: 1000, priceEs: "19,99 €", priceEn: "€19.99" },
];

export function findHuesitoPack(id: unknown): HuesitoPack | null {
  return HUESITO_PACKS.find((pack) => pack.id === id) ?? null;
}

// ---------- Cantidad personalizada (solo en la web) ----------
// El precio sube poco a poco entre un pack y otro: los packs cuestan lo
// mismo que arriba y nunca se paga más por menos huesitos.

export const CUSTOM_HUESITOS_MIN = 50;
export const CUSTOM_HUESITOS_MAX = 10000;

// Valor que se guarda en Stripe para saber que es una cantidad personalizada
export const CUSTOM_PACK_ID = "custom";

export function isValidCustomAmount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= CUSTOM_HUESITOS_MIN &&
    value <= CUSTOM_HUESITOS_MAX
  );
}

// Precio en céntimos (IVA incluido) de una cantidad personalizada
//   hasta 100:      2,99 € por cada 100
//   de 100 a 300:   de 2,99 € a 6,99 €
//   de 300 a 1000:  de 6,99 € a 19,99 €
//   más de 1000:    2 céntimos cada huesito extra
export function customHuesitosPriceCents(huesitos: number): number {
  if (huesitos <= 100) {
    return Math.round(huesitos * 2.99);
  }
  if (huesitos <= 300) {
    return 299 + (huesitos - 100) * 2;
  }
  if (huesitos <= 1000) {
    return 699 + Math.round(((huesitos - 300) * 1300) / 700);
  }
  return 1999 + (huesitos - 1000) * 2;
}

// "6,99 €" en español y "€6.99" en inglés
export function formatEuros(cents: number, locale: string): string {
  const amount = cents / 100;
  return locale === "en"
    ? `€${amount.toFixed(2)}`
    : `${amount.toFixed(2).replace(".", ",")} €`;
}