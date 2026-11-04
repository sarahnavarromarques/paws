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
