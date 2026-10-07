// Tipos de cuenta de PAWS y cómo debe hablar la IA a cada uno.
// Este archivo no usa nada del servidor: se puede importar desde cualquier sitio.

export const ACCOUNT_TYPES = [
  "particular",
  "profesional",
  "centro",
  "refugio",
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const DEFAULT_ACCOUNT_TYPE: AccountType = "particular";

export function isAccountType(value: unknown): value is AccountType {
  return (
    typeof value === "string" &&
    (ACCOUNT_TYPES as readonly string[]).includes(value)
  );
}

const AUDIENCE_INSTRUCTIONS: Record<AccountType, { es: string; en: string }> = {
  particular: {
    es: "Quien lee es un propietario particular, no un profesional. Usa un lenguaje sencillo y cercano, sin tecnicismos (si usas alguno, explícalo en pocas palabras), y da pasos fáciles de aplicar en casa.",
    en: "The reader is a regular dog owner, not a professional. Use simple, friendly language without jargon (if you use a technical term, explain it briefly), and give steps that are easy to apply at home.",
  },
  profesional: {
    es: "Quien lee es un adiestrador profesional. Usa un lenguaje técnico y directo, como entre colegas (criterios, refuerzo, duración, distancia, distracciones, generalización), sin explicar lo básico.",
    en: "The reader is a professional dog trainer. Use technical, direct language, as between colleagues (criteria, reinforcement, duration, distance, distractions, generalization), without explaining the basics.",
  },
  centro: {
    es: "Quien lee es un centro de adiestramiento con entrenadores profesionales. Usa un lenguaje técnico y directo, como entre colegas, sin explicar lo básico, y cuando ayude ten en cuenta que varios entrenadores pueden trabajar con el mismo perro.",
    en: "The reader is a dog training center with professional trainers. Use technical, direct language, as between colleagues, without explaining the basics, and where helpful keep in mind that several trainers may work with the same dog.",
  },
  refugio: {
    es: "Quien lee es personal o voluntariado de un refugio. Usa un lenguaje claro y práctico, y prioriza la confianza, el bienestar y la socialización del perro, y las habilidades que faciliten su adopción y la convivencia en un nuevo hogar.",
    en: "The reader is shelter staff or a volunteer. Use clear, practical language, and prioritize the dog's confidence, wellbeing and socialization, and the skills that will make adoption and life in a new home easier.",
  },
};

// Instrucciones de tono para añadir a los prompts de la IA
export function getAudienceInstructions(
  accountType: AccountType,
  isEnglish: boolean
): string {
  const texts = AUDIENCE_INSTRUCTIONS[accountType];
  return isEnglish ? texts.en : texts.es;
}