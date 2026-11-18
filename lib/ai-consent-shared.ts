// Datos del consentimiento de IA que usan tanto el servidor como el navegador.
// (Este archivo no puede importar nada del servidor.)

// Código de error que devuelven las rutas de IA cuando el usuario no ha dado permiso.
export const AI_CONSENT_REQUIRED = "ai_consent_required";

// Cabecera que envía el navegador cuando el usuario ha rechazado la IA.
// Las rutas que tienen una versión local (sin IA) la usan en vez de pedir permiso.
export const AI_CONSENT_DECLINED_HEADER = "x-paws-ai-declined";

// Rutas que envían datos a la IA y piden permiso antes de usarse.
// session-progress no está: sin permiso calcula el progreso con el método local.
export const AI_CONSENT_ROUTES = [
  "/api/analyze-progress",
  "/api/group-name",
  "/api/pet-questionnaire",
  "/api/session-chat",
  "/api/session-guide",
  "/api/training-order",
] as const;