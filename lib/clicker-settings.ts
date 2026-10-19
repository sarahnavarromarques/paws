// Personalización del clicker: opciones, valores por defecto y validación.
// Se guarda en profiles.clicker_settings (una por usuario).

export type ClickerCenter = "paws" | "emoji" | "photo";

export type ClickerSoundId =
  | "classic"
  | "high"
  | "low"
  | "wood"
  | "beep"
  | "single";

export type ClickerSettings = {
  center: ClickerCenter;
  emoji: string;
  photoUrl: string | null;
  bgColor: string;
  buttonColor: string;
  borderColor: string;
  pawColor: string;
  sound: ClickerSoundId;
  gapMs: number;
};

// El clicker original (antes de personalizar)
export const DEFAULT_CLICKER_SETTINGS: ClickerSettings = {
  center: "paws",
  emoji: "🐶",
  photoUrl: null,
  bgColor: "#fefce8",
  buttonColor: "#bae6fd",
  borderColor: "#f2a65a",
  pawColor: "#fefce8",
  sound: "classic",
  gapMs: 90,
};

export const GAP_MIN_MS = 20;
export const GAP_MAX_MS = 200;

export const CLICKER_PHOTO_BUCKET = "clicker-photos";
export const CLICKER_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export const CLICKER_EMOJIS = [
  "🐶", "🐕", "🐾", "🦴", "🎾", "⭐", "❤️", "🏆",
  "🍖", "🥩", "🧀", "👍", "🔥", "😊", "🌟", "💙",
];

export const COLOR_SWATCHES = [
  "#fefce8", "#ffffff", "#fde68a", "#f2a65a",
  "#bae6fd", "#1e3a5f", "#bbf7d0", "#16a34a",
  "#fbcfe8", "#ef4444", "#ddd6fe", "#111827",
];

// Definición de cada sonido (se genera con código, sin archivos de audio)
export type ClickerSoundDef =
  | { kind: "snap"; first: number; second: number | null; q: number }
  | { kind: "beep"; frequency: number };

export const CLICKER_SOUNDS: Record<ClickerSoundId, ClickerSoundDef> = {
  classic: { kind: "snap", first: 4200, second: 3300, q: 4 },
  high: { kind: "snap", first: 5600, second: 4600, q: 4 },
  low: { kind: "snap", first: 2400, second: 1800, q: 4 },
  wood: { kind: "snap", first: 1300, second: 950, q: 1.5 },
  beep: { kind: "beep", frequency: 2000 },
  single: { kind: "snap", first: 4200, second: null, q: 4 },
};

export const CLICKER_SOUND_IDS: ClickerSoundId[] = [
  "classic",
  "high",
  "low",
  "wood",
  "beep",
  "single",
];

// ¿El sonido tiene "clic" y "clac"? (si no, no tiene sentido el tiempo entre ambos)
export function isDoubleSound(id: ClickerSoundId): boolean {
  const def = CLICKER_SOUNDS[id];
  return def.kind === "snap" && def.second !== null;
}

const COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

function cleanColor(value: unknown, fallback: string): string {
  return typeof value === "string" && COLOR_REGEX.test(value)
    ? value.toLowerCase()
    : fallback;
}

// Comprueba lo que viene de la base de datos; lo que no sea válido vuelve al valor original
export function sanitizeClickerSettings(raw: unknown): ClickerSettings {
  const d = DEFAULT_CLICKER_SETTINGS;

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...d };
  }

  const input = raw as Record<string, unknown>;

  const center: ClickerCenter =
    input.center === "emoji" || input.center === "photo" || input.center === "paws"
      ? input.center
      : d.center;

  const emoji =
    typeof input.emoji === "string" && input.emoji.trim() !== ""
      ? input.emoji.trim().slice(0, 16)
      : d.emoji;

  const photoUrl =
    typeof input.photoUrl === "string" && input.photoUrl.startsWith("https://")
      ? input.photoUrl
      : null;

  const sound: ClickerSoundId =
    typeof input.sound === "string" &&
    (CLICKER_SOUND_IDS as string[]).includes(input.sound)
      ? (input.sound as ClickerSoundId)
      : d.sound;

  const rawGap = typeof input.gapMs === "number" ? input.gapMs : d.gapMs;
  const gapMs = Math.min(GAP_MAX_MS, Math.max(GAP_MIN_MS, Math.round(rawGap)));

  return {
    // Si eligió foto pero no hay foto, se muestran huellas
    center: center === "photo" && !photoUrl ? "paws" : center,
    emoji,
    photoUrl,
    bgColor: cleanColor(input.bgColor, d.bgColor),
    buttonColor: cleanColor(input.buttonColor, d.buttonColor),
    borderColor: cleanColor(input.borderColor, d.borderColor),
    pawColor: cleanColor(input.pawColor, d.pawColor),
    sound,
    gapMs,
  };
}

// Ruta dentro del almacén a partir del enlace público (para borrar fotos antiguas)
export function clickerPhotoPath(url: string | null): string | null {
  if (!url) return null;
  const marker = `/${CLICKER_PHOTO_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length));
}