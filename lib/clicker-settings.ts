// Personalización del clicker (solo sonido): opciones, valores por defecto y validación.
// Se guarda en profiles.clicker_settings (una por usuario).

export type ClickerSoundId =
  | "classic"
  | "soft"
  | "metal"
  | "single"
  | "beep"
  | "doubleBeep"
  | "bell"
  | "wood"
  | "tongue"
  | "whistle";

export type ClickerSettings = {
  sound: ClickerSoundId;
  gapMs: number; // tiempo entre "clic" y "clac"
  volume: number; // 10–100 %
  pitch: number; // -6 a +6 (semitonos): negativo = más grave, positivo = más agudo
};

export const DEFAULT_CLICKER_SETTINGS: ClickerSettings = {
  sound: "classic",
  gapMs: 90,
  volume: 100,
  pitch: 0,
};

export const GAP_MIN_MS = 20;
export const GAP_MAX_MS = 200;
export const VOLUME_MIN = 10;
export const VOLUME_MAX = 100;
export const PITCH_MIN = -6;
export const PITCH_MAX = 6;

// Definición de cada sonido (se genera con código, sin archivos de audio)
export type ClickerSoundDef =
  | {
      // Chasquido mecánico: ruido filtrado + pequeña resonancia
      kind: "snap";
      first: number;
      second: number | null;
      q: number;
      level: number;
      ring: number; // duración de la resonancia (segundos)
      ringLevel: number;
    }
  | {
      // Tono electrónico
      kind: "tone";
      frequency: number;
      second: number | null;
      wave: OscillatorType;
      duration: number;
    }
  | { kind: "bell"; frequency: number }
  | { kind: "whistle"; from: number; to: number; duration: number };

export const CLICKER_SOUNDS: Record<ClickerSoundId, ClickerSoundDef> = {
  classic: { kind: "snap", first: 4200, second: 3300, q: 4, level: 1, ring: 0.015, ringLevel: 0.35 },
  soft: { kind: "snap", first: 2600, second: 2100, q: 1.2, level: 0.55, ring: 0.012, ringLevel: 0.2 },
  metal: { kind: "snap", first: 5200, second: 4300, q: 12, level: 1, ring: 0.05, ringLevel: 0.5 },
  single: { kind: "snap", first: 4200, second: null, q: 4, level: 1, ring: 0.015, ringLevel: 0.35 },
  beep: { kind: "tone", frequency: 2000, second: null, wave: "sine", duration: 0.08 },
  doubleBeep: { kind: "tone", frequency: 2000, second: 2000, wave: "sine", duration: 0.05 },
  bell: { kind: "bell", frequency: 1800 },
  wood: { kind: "snap", first: 1300, second: 950, q: 1.5, level: 1, ring: 0.035, ringLevel: 0.6 },
  tongue: { kind: "snap", first: 1700, second: null, q: 0.9, level: 0.9, ring: 0.008, ringLevel: 0.15 },
  whistle: { kind: "whistle", from: 2400, to: 3000, duration: 0.3 },
};

// Orden en el que aparecen en pantalla
export const CLICKER_SOUND_IDS: ClickerSoundId[] = [
  "classic",
  "soft",
  "metal",
  "single",
  "beep",
  "doubleBeep",
  "bell",
  "wood",
  "tongue",
  "whistle",
];

// ¿El sonido tiene dos golpes? (si no, no tiene sentido el tiempo entre ambos)
export function isDoubleSound(id: ClickerSoundId): boolean {
  const def = CLICKER_SOUNDS[id];
  return (def.kind === "snap" || def.kind === "tone") && def.second !== null;
}

// Multiplicador de frecuencia según el tono elegido
export function pitchFactor(pitch: number): number {
  return Math.pow(2, pitch / 12);
}

// Sonidos de versiones anteriores que ya no existen como opción propia
const LEGACY_SOUNDS: Record<string, { sound: ClickerSoundId; pitch: number }> = {
  high: { sound: "classic", pitch: 5 },
  low: { sound: "classic", pitch: -6 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

// Comprueba lo que viene de la base de datos; lo que no sea válido vuelve al valor original.
// Los campos antiguos (colores, emoji, foto) se ignoran.
export function sanitizeClickerSettings(raw: unknown): ClickerSettings {
  const d = DEFAULT_CLICKER_SETTINGS;

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...d };
  }

  const input = raw as Record<string, unknown>;

  let sound: ClickerSoundId = d.sound;
  let pitchDefault = d.pitch;

  if (typeof input.sound === "string") {
    if ((CLICKER_SOUND_IDS as string[]).includes(input.sound)) {
      sound = input.sound as ClickerSoundId;
    } else if (LEGACY_SOUNDS[input.sound]) {
      sound = LEGACY_SOUNDS[input.sound].sound;
      pitchDefault = LEGACY_SOUNDS[input.sound].pitch;
    }
  }

  const gapMs = clamp(
    typeof input.gapMs === "number" ? input.gapMs : d.gapMs,
    GAP_MIN_MS,
    GAP_MAX_MS
  );

  const volume = clamp(
    typeof input.volume === "number" ? input.volume : d.volume,
    VOLUME_MIN,
    VOLUME_MAX
  );

  const pitch = clamp(
    typeof input.pitch === "number" ? input.pitch : pitchDefault,
    PITCH_MIN,
    PITCH_MAX
  );

  return { sound, gapMs, volume, pitch };
}