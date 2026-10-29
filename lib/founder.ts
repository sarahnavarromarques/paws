// Enlaces de fundador: personales, de un solo uso.
// Quien canjea uno paga PAWS PRO con el 50% para siempre.

// Dirección del enlace que se envía a cada adiestrador
export function buildFounderUrl(origin: string, token: string): string {
  return `${origin}/invite/founder/${token}`;
}

// Comprueba que un texto tiene forma de token (uuid)
export function isFounderToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

// ¿Es este correo de un administrador de PAWS?
// Los correos van en la variable PAWS_ADMIN_EMAILS, separados por comas.
// SOLO para usar en el servidor.
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const admins = (process.env.PAWS_ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.trim().toLowerCase());
}
