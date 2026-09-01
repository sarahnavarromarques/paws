// Traduce los mensajes de error de Supabase (en inglés) a español.
// El mensaje original se registra en la consola para depuración.

export function translateAuthError(message: string): string {
  console.error("Auth error original:", message);

  const msg = message.toLowerCase();

  if (msg.includes("invalid login credentials")) {
    return "Correo o contraseña incorrectos.";
  }

  if (msg.includes("user already registered")) {
    return "Ya existe una cuenta con este correo. Inicia sesión.";
  }

  if (
    msg.includes("password should be at least") ||
    msg.includes("password should contain") ||
    msg.includes("weak password")
  ) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }

  if (
    msg.includes("unable to validate email address") ||
    msg.includes("invalid email")
  ) {
    return "El correo electrónico no es válido.";
  }

  if (msg.includes("email not confirmed")) {
    return "Debes confirmar tu correo antes de iniciar sesión.";
  }

  if (
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("for security purposes")
  ) {
    return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
  }

  if (
    msg.includes("network") ||
    msg.includes("failed to fetch")
  ) {
    return "Error de conexión. Comprueba tu internet e inténtalo de nuevo.";
  }

  // Cualquier otro error: mensaje genérico en español (nunca en inglés).
  return "Ha ocurrido un error. Inténtalo de nuevo.";
}