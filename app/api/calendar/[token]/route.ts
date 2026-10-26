import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import { isDoseLabel, isVaccineKey } from "@/lib/vaccination-plan";
import { healthIcon, isDewormingKey } from "@/lib/deworming";
import vaccinesEs from "@/messages/features/vaccines.es.json";
import vaccinesEn from "@/messages/features/vaccines.en.json";
import healthEs from "@/messages/features/health.es.json";
import healthEn from "@/messages/features/health.en.json";

// Siempre se genera en el momento (nunca desde caché)
export const dynamic = "force-dynamic";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_DURATION_MINUTES = 30;
const CALENDAR_TIMEZONE = "Europe/Madrid";

type Language = "es" | "en";

const CALENDAR_TEXT: Record<
  Language,
  { calendarName: string; calendarDescription: string; openInPaws: string }
> = {
  es: {
    calendarName: "PAWS – Entrenamientos y salud",
    calendarDescription:
      "Entrenamientos, vacunas y desparasitaciones planificados en PAWS",
    openInPaws: "Abrir en PAWS",
  },
  en: {
    calendarName: "PAWS – Trainings and health",
    calendarDescription:
      "Trainings, vaccines and parasite treatments planned in PAWS",
    openInPaws: "Open in PAWS",
  },
};

// Nombres de vacunas, dosis y desparasitaciones (los mismos textos que la app)
const VACCINE_TEXT = {
  es: vaccinesEs.Vaccines,
  en: vaccinesEn.Vaccines,
};

const DEWORMING_TEXT = {
  es: healthEs.Deworming,
  en: healthEn.Deworming,
};

// Zona horaria de Madrid (horario de verano e invierno)
const VTIMEZONE_LINES = [
  "BEGIN:VTIMEZONE",
  `TZID:${CALENDAR_TIMEZONE}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

const encoder = new TextEncoder();

function textResponse(message: string, status: number) {
  return new NextResponse(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

// Escapa caracteres especiales del formato de calendario
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// Las líneas largas deben partirse (sin romper emojis ni tildes)
function foldLine(line: string): string {
  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  const limit = 73;

  for (const char of Array.from(line)) {
    const charBytes = encoder.encode(char).length;
    if (currentBytes + charBytes > limit) {
      parts.push(current);
      current = char;
      currentBytes = charBytes;
    } else {
      current += char;
      currentBytes += charBytes;
    }
  }

  parts.push(current);
  return parts.join("\r\n ");
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function parseDate(
  value: string
): { year: number; month: number; day: number } | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function parseTime(
  value: string | null
): { hour: number; minute: number } | null {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

// Se calcula con UTC para que la zona horaria del servidor no influya
function formatLocalDateTime(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00`
  );
}

function formatDateOnly(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

function formatUtcStamp(date: Date): string {
  return `${formatLocalDateTime(date)}Z`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token: rawToken } = await params;
  const token = rawToken.replace(/\.ics$/i, "");

  if (!UUID_REGEX.test(token)) {
    return textResponse("Not found", 404);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("calendar: faltan variables de entorno");
    return textResponse("Server error", 500);
  }

  const admin = createClient<Database>(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1) Identificar al usuario por su código secreto
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, language")
    .eq("calendar_token", token)
    .maybeSingle();

  if (profileError) {
    console.error("calendar: error leyendo perfil", profileError);
    return textResponse("Server error", 500);
  }

  if (!profile) {
    return textResponse("Not found", 404);
  }

  const language: Language = profile.language === "en" ? "en" : "es";
  const text = CALENDAR_TEXT[language];
  const vaccineText = VACCINE_TEXT[language];
  const dewormingText = DEWORMING_TEXT[language];

  // 2) Leer mascotas, entrenamientos y registros de salud pendientes con fecha
  const [petsResult, trainingsResult, healthResult] = await Promise.all([
    admin.from("pets").select("id, name").eq("user_id", profile.id),
    admin
      .from("trainings")
      .select("id, pet_id, title, date, time, duration, notes")
      .eq("user_id", profile.id)
      .order("date", { ascending: true }),
    admin
      .from("pet_vaccinations")
      .select("id, pet_id, category, vaccine_key, name, dose_label, product, due_date")
      .eq("user_id", profile.id)
      .neq("status", "done")
      .not("due_date", "is", null),
  ]);

  if (petsResult.error || trainingsResult.error) {
    console.error(
      "calendar: error leyendo datos",
      petsResult.error ?? trainingsResult.error
    );
    return textResponse("Server error", 500);
  }

  // Si falla la salud, el calendario sigue con los entrenamientos
  if (healthResult.error) {
    console.error("calendar: error leyendo salud", healthResult.error);
  }

  const petNames = new Map<number, string>();
  (petsResult.data ?? []).forEach((pet) => {
    if (pet.name) petNames.set(pet.id, pet.name);
  });

  // 3) Construir el calendario
  const origin = new URL(request.url).origin;
  const host = new URL(request.url).host;
  const stamp = formatUtcStamp(new Date());

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PAWS//Calendario//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(text.calendarName)}`,
    `X-WR-CALDESC:${escapeText(text.calendarDescription)}`,
    `X-WR-TIMEZONE:${CALENDAR_TIMEZONE}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...VTIMEZONE_LINES,
  ];

  // --- Entrenamientos ---

  for (const training of trainingsResult.data ?? []) {
    const day = parseDate(training.date);
    if (!day) continue;

    const petName = petNames.get(training.pet_id);
    const summary = petName
      ? `🐶 ${petName} — ${training.title}`
      : `🐶 ${training.title}`;

    const link = `${origin}/trainings/${training.id}/edit`;
    const notes = training.notes?.trim() ?? "";
    const description = notes
      ? `${notes}\n\n${text.openInPaws}: ${link}`
      : `${text.openInPaws}: ${link}`;

    lines.push(
      "BEGIN:VEVENT",
      `UID:paws-training-${training.id}@${host}`,
      `DTSTAMP:${stamp}`
    );

    const time = parseTime(training.time);

    if (time) {
      const start = new Date(
        Date.UTC(day.year, day.month - 1, day.day, time.hour, time.minute)
      );
      const minutes =
        training.duration && training.duration > 0
          ? training.duration
          : DEFAULT_DURATION_MINUTES;
      const end = new Date(start.getTime() + minutes * 60_000);

      lines.push(
        `DTSTART;TZID=${CALENDAR_TIMEZONE}:${formatLocalDateTime(start)}`,
        `DTEND;TZID=${CALENDAR_TIMEZONE}:${formatLocalDateTime(end)}`
      );
    } else {
      // Sin hora: evento de día completo
      const start = new Date(Date.UTC(day.year, day.month - 1, day.day));
      const end = new Date(start.getTime() + 24 * 60 * 60_000);

      lines.push(
        `DTSTART;VALUE=DATE:${formatDateOnly(start)}`,
        `DTEND;VALUE=DATE:${formatDateOnly(end)}`
      );
    }

    lines.push(
      `SUMMARY:${escapeText(summary)}`,
      `DESCRIPTION:${escapeText(description)}`,
      `URL:${link}`,
      "END:VEVENT"
    );
  }

  // --- Vacunas y desparasitaciones pendientes
  //     (día completo, con aviso el día anterior a las 9:00) ---

  for (const record of healthResult.data ?? []) {
    if (!record.due_date) continue;

    const day = parseDate(record.due_date);
    if (!day) continue;

    const isDeworming = record.category === "deworming";

    let itemName: string;
    let extra: string;

    if (isDeworming) {
      itemName = isDewormingKey(record.vaccine_key)
        ? dewormingText.typeNames[record.vaccine_key]
        : record.name;
      extra = record.product?.trim() ?? "";
    } else {
      itemName = isVaccineKey(record.vaccine_key)
        ? vaccineText.vaccineNames[record.vaccine_key]
        : record.name;
      extra = record.dose_label
        ? isDoseLabel(record.dose_label)
          ? vaccineText.doses[record.dose_label]
          : record.dose_label
        : "";
    }

    const title = extra ? `${itemName} (${extra})` : itemName;
    const icon = healthIcon(record.category, record.vaccine_key);
    const petName = petNames.get(record.pet_id);
    const summary = petName ? `${icon} ${petName} — ${title}` : `${icon} ${title}`;

    const tab = isDeworming ? "?tab=deworming" : "";
    const link = `${origin}/pets/${record.pet_id}/vaccines${tab}`;
    const disclaimer = isDeworming
      ? dewormingText.disclaimer
      : vaccineText.disclaimer;
    const description = `${disclaimer}\n\n${text.openInPaws}: ${link}`;

    const start = new Date(Date.UTC(day.year, day.month - 1, day.day));
    const end = new Date(start.getTime() + 24 * 60 * 60_000);

    lines.push(
      "BEGIN:VEVENT",
      `UID:paws-vaccine-${record.id}@${host}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${formatDateOnly(start)}`,
      `DTEND;VALUE=DATE:${formatDateOnly(end)}`,
      `SUMMARY:${escapeText(summary)}`,
      `DESCRIPTION:${escapeText(description)}`,
      `URL:${link}`,
      // Aviso: 15 horas antes del inicio del día = el día anterior a las 9:00
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(summary)}`,
      "TRIGGER:-PT15H",
      "END:VALARM",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");

  const body = lines.map(foldLine).join("\r\n") + "\r\n";

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="paws.ics"',
      "Cache-Control": "no-store, max-age=0",
    },
  });
}