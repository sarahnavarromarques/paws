// Convierte los mensajes de error de Supabase (en inglés) en una clave de traducción.
// Cada pantalla traduce la clave con next-intl (namespace "AuthErrors").
// El mensaje original se registra en la consola para depuración.

export type AuthErrorKey =
  | "invalidCredentials"
  | "alreadyRegistered"
  | "weakPassword"
  | "samePassword"
  | "invalidEmail"
  | "emailNotConfirmed"
  | "rateLimited"
  | "network"
  | "generic";

export function getAuthErrorKey(message: string): AuthErrorKey {
  console.error("Auth error original:", message);

  const msg = message.toLowerCase();

  if (msg.includes("invalid login credentials")) {
    return "invalidCredentials";
  }

  if (msg.includes("user already registered")) {
    return "alreadyRegistered";
  }

  if (msg.includes("different from the old password")) {
    return "samePassword";
  }

  if (
    msg.includes("password should be at least") ||
    msg.includes("password should contain") ||
    msg.includes("weak password")
  ) {
    return "weakPassword";
  }

  if (
    msg.includes("unable to validate email address") ||
    msg.includes("invalid email")
  ) {
    return "invalidEmail";
  }

  if (msg.includes("email not confirmed")) {
    return "emailNotConfirmed";
  }

  if (
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("for security purposes")
  ) {
    return "rateLimited";
  }

  if (msg.includes("network") || msg.includes("failed to fetch")) {
    return "network";
  }

  // Cualquier otro error: mensaje genérico
  return "generic";
}