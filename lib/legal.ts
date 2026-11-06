// Datos del titular de PAWS que aparecen en los textos legales.
// Cuando la gestoría confirme los datos, se cambian SOLO aquí.

export const LEGAL_OWNER = {
  // Persona titular (autónomo)
  name: "Francisco José Navarro Molina",
  // NIF / CIF
  taxId: "28481154R",
  // Domicilio que se publica en el aviso legal. Vacío = no se muestra.
  // OJO: la LSSI (art. 10) pide publicar un domicilio. Consultar con la
  // gestoría una dirección que no sea la de casa (gestoría u oficina virtual)
  // y ponerla aquí.
  address: "",
  // Correo para consultas legales y de privacidad
  email: "pawsadiestramiento@gmail.com",
  // Nombre comercial
  brand: "PAWS",
  // Dirección web
  website: "https://pawscoach.app",
};

// Fecha de la última actualización de los textos legales
export const LEGAL_UPDATED_AT = "4 de noviembre de 2026";

export type LegalSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalDocument = {
  title: string;
  intro?: string;
  sections: LegalSection[];
};

// Enlaces a los textos legales (menú, registro…)
export const LEGAL_LINKS = [
  { href: "/legal/condiciones", key: "terms" },
  { href: "/legal/privacidad", key: "privacy" },
  { href: "/legal/aviso-legal", key: "notice" },
] as const;