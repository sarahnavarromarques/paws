// Deberes para casa (adiestrador ↔ dueño).
// Este archivo no usa nada del servidor: se puede importar desde cualquier sitio.

export type HomeworkAssignment = {
  id: string;
  pet_id: number;
  trainer_id: string;
  skill_id: number | null;
  title: string;
  instructions: string | null;
  attempts_per_session: number;
  sessions_per_week: number;
  active: boolean;
  created_at: string;
};

export type HomeworkLog = {
  id: string;
  assignment_id: string;
  pet_id: number;
  attempts: number;
  successes: number;
  logged_at: string;
};

export type TrainerLink = {
  link_id: string;
  pet_id: number;
  pet_name: string;
  pet_photo: string | null;
  role: "trainer" | "owner";
  other_name: string;
  client_name: string | null;
  created_at: string;
};

// Lunes a las 00:00 de la semana actual (hora local)
export function startOfWeek(date: Date = new Date()): Date {
  const result = new Date(date);
  const day = result.getDay(); // 0 = domingo
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

export type WeekProgress = {
  done: number; // sesiones hechas esta semana
  target: number; // sesiones pedidas por semana
  attempts: number; // intentos de esta semana
  successes: number; // aciertos de esta semana
  successRate: number | null; // 0–100, o null si no hay intentos
  lastLoggedAt: string | null;
};

// Progreso de un deber en la semana actual
export function getWeekProgress(
  assignment: Pick<HomeworkAssignment, "id" | "sessions_per_week">,
  logs: HomeworkLog[],
  now: Date = new Date()
): WeekProgress {
  const weekStart = startOfWeek(now).getTime();

  const ownLogs = logs.filter((log) => log.assignment_id === assignment.id);
  const thisWeek = ownLogs.filter(
    (log) => new Date(log.logged_at).getTime() >= weekStart
  );

  const attempts = thisWeek.reduce((sum, log) => sum + log.attempts, 0);
  const successes = thisWeek.reduce((sum, log) => sum + log.successes, 0);

  const lastLoggedAt =
    ownLogs.length > 0
      ? ownLogs.reduce((latest, log) =>
          log.logged_at > latest.logged_at ? log : latest
        ).logged_at
      : null;

  return {
    done: thisWeek.length,
    target: assignment.sessions_per_week,
    attempts,
    successes,
    successRate: attempts > 0 ? Math.round((successes / attempts) * 100) : null,
    lastLoggedAt,
  };
}

// Cumplimiento semanal de varios deberes juntos (0–100), o null si no hay deberes
export function getCompliance(progressList: WeekProgress[]): number | null {
  const target = progressList.reduce((sum, p) => sum + p.target, 0);
  if (target === 0) return null;

  // Cada deber cuenta como mucho hasta su objetivo (hacer de más no compensa otro)
  const done = progressList.reduce(
    (sum, p) => sum + Math.min(p.done, p.target),
    0
  );

  return Math.round((done / target) * 100);
}

// Color del cumplimiento: verde, ámbar o rojo
export function complianceTone(
  compliance: number | null
): "good" | "medium" | "low" | "none" {
  if (compliance === null) return "none";
  if (compliance >= 80) return "good";
  if (compliance >= 40) return "medium";
  return "low";
}

export const COMPLIANCE_CLASSES: Record<
  ReturnType<typeof complianceTone>,
  string
> = {
  good: "bg-green-100 text-green-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-red-100 text-red-700",
  none: "bg-slate-100 text-slate-500",
};

// Lee un objeto JSON devuelto por una función de Supabase
export function readJsonObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

// Enlace de invitación para un cliente
export function buildInviteUrl(origin: string, token: string): string {
  return `${origin}/invite/${token}`;
}

// Enlace de WhatsApp con un mensaje ya escrito
export function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

// Solo se permite volver a rutas internas (evita redirigir a otras webs)
export function safeNextPath(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}