"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import Pawsi from "@/components/Pawsi";
import {
  CLICKER_SOUNDS,
  CLICKER_SOUND_IDS,
  DEFAULT_CLICKER_SETTINGS,
  GAP_MAX_MS,
  GAP_MIN_MS,
  PITCH_MAX,
  PITCH_MIN,
  VOLUME_MAX,
  VOLUME_MIN,
  isDoubleSound,
  pitchFactor,
  sanitizeClickerSettings,
  type ClickerSettings,
  type ClickerSoundId,
} from "@/lib/clicker-settings";

const supabase = createClient();

// Preferencia de vibración guardada en este dispositivo
const VIBRATION_KEY = "paws-clicker-vibration";

// Duración de cada chasquido (en segundos)
const SNAP_DURATION = 0.025;

// Diseño fijo del clicker
const CLICKER_BG = "#fefce8";
const CLICKER_BUTTON = "#bae6fd";
const CLICKER_BORDER = "#f2a65a";
const CLICKER_PAWS = "#fefce8";

// ---------------------------------------------------------------------------
// Textos de la personalización (español / inglés)
// ---------------------------------------------------------------------------

type CustomText = {
  customize: string;
  panelTitle: string;
  previewNote: string;
  soundTitle: string;
  soundHint: string;
  sounds: Record<ClickerSoundId, string>;
  gapTitle: string;
  gapHint: string;
  volumeTitle: string;
  pitchTitle: string;
  pitchLow: string;
  pitchHigh: string;
  save: string;
  saving: string;
  cancel: string;
  reset: string;
  saved: string;
  saveError: string;
};

const CUSTOM_TEXT: Record<"es" | "en", CustomText> = {
  es: {
    customize: "🔊 Personalizar sonido",
    panelTitle: "Personaliza el sonido",
    previewNote:
      "Puedes probar el clicker de arriba mientras eliges. Pulsa Guardar para conservarlo.",
    soundTitle: "Tipo de sonido",
    soundHint: "Toca un sonido para escucharlo.",
    sounds: {
      classic: "Clásico (clic-clac)",
      soft: "Clicker suave",
      metal: "Clicker metálico",
      single: "Clic simple",
      beep: "Pitido digital",
      doubleBeep: "Doble pitido",
      bell: "Campanita",
      wood: "Bloque de madera",
      tongue: "Chasquido de lengua",
      whistle: "Silbato corto",
    },
    gapTitle: "Tiempo entre clic y clac",
    gapHint: "Menos = más seguido · Más = más separado",
    volumeTitle: "Volumen",
    pitchTitle: "Tono",
    pitchLow: "Más grave",
    pitchHigh: "Más agudo",
    save: "Guardar",
    saving: "Guardando…",
    cancel: "Cancelar",
    reset: "Restablecer",
    saved: "Sonido guardado ✓",
    saveError: "No se pudo guardar. Inténtalo de nuevo.",
  },
  en: {
    customize: "🔊 Customize sound",
    panelTitle: "Customize the sound",
    previewNote:
      "You can try the clicker above while choosing. Press Save to keep it.",
    soundTitle: "Sound type",
    soundHint: "Tap a sound to hear it.",
    sounds: {
      classic: "Classic (click-clack)",
      soft: "Soft clicker",
      metal: "Metal clicker",
      single: "Single click",
      beep: "Digital beep",
      doubleBeep: "Double beep",
      bell: "Little bell",
      wood: "Wood block",
      tongue: "Tongue click",
      whistle: "Short whistle",
    },
    gapTitle: "Time between click and clack",
    gapHint: "Less = closer together · More = further apart",
    volumeTitle: "Volume",
    pitchTitle: "Pitch",
    pitchLow: "Lower",
    pitchHigh: "Higher",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    reset: "Reset",
    saved: "Sound saved ✓",
    saveError: "It could not be saved. Please try again.",
  },
};

// ---------------------------------------------------------------------------
// Sonido
// ---------------------------------------------------------------------------

type AudioContextConstructor = typeof AudioContext;

// Safari antiguo usa "webkitAudioContext"
function getAudioContextClass(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;
  const g = globalThis as typeof globalThis & {
    webkitAudioContext?: AudioContextConstructor;
  };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

// Un chasquido: ruido filtrado + una resonancia corta
function playSnap(
  ctx: AudioContext,
  out: AudioNode,
  noiseBuffer: AudioBuffer,
  start: number,
  frequency: number,
  level: number,
  q: number,
  ring: number,
  ringLevel: number
) {
  // Capa 1: ruido filtrado (la lámina)
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(level, start);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, start + SNAP_DURATION);
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(out);
  noise.start(start);
  noise.stop(start + SNAP_DURATION);

  // Capa 2: resonancia
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(frequency, start);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(level * ringLevel, start);
  oscGain.gain.exponentialRampToValueAtTime(0.001, start + ring);
  osc.connect(oscGain);
  oscGain.connect(out);
  osc.start(start);
  osc.stop(start + ring);
}

// Tono electrónico corto
function playTone(
  ctx: AudioContext,
  out: AudioNode,
  start: number,
  frequency: number,
  wave: OscillatorType,
  duration: number
) {
  const osc = ctx.createOscillator();
  osc.type = wave;
  osc.frequency.setValueAtTime(frequency, start);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.4, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(gain);
  gain.connect(out);
  osc.start(start);
  osc.stop(start + duration);
}

// Campanita: varios armónicos que se apagan poco a poco
function playBell(ctx: AudioContext, out: AudioNode, start: number, frequency: number) {
  const partials = [
    { ratio: 1, level: 0.35, decay: 0.7 },
    { ratio: 2.76, level: 0.15, decay: 0.4 },
    { ratio: 5.4, level: 0.08, decay: 0.25 },
  ];

  for (const p of partials) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency * p.ratio, start);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(p.level, start + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, start + p.decay);
    osc.connect(gain);
    gain.connect(out);
    osc.start(start);
    osc.stop(start + p.decay);
  }
}

// Silbato: tono que sube un poco, con un ligero temblor
function playWhistle(
  ctx: AudioContext,
  out: AudioNode,
  start: number,
  from: number,
  to: number,
  duration: number
) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(to, start + duration * 0.6);

  // Temblor del silbato
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 30;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = from * 0.015;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(0.3, start + 0.02);
  gain.gain.setValueAtTime(0.3, start + duration * 0.7);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

  osc.connect(gain);
  gain.connect(out);
  osc.start(start);
  lfo.start(start);
  osc.stop(start + duration);
  lfo.stop(start + duration);
}

// ---------------------------------------------------------------------------
// Huella dibujada
// ---------------------------------------------------------------------------

function PawPrint({ className, color }: { className?: string; color: string }) {
  return (
    <svg viewBox="0 0 64 64" fill={color} aria-hidden="true" className={className}>
      <ellipse cx="13" cy="26" rx="6" ry="8" transform="rotate(-25 13 26)" />
      <ellipse cx="25" cy="14" rx="6.5" ry="8.5" transform="rotate(-8 25 14)" />
      <ellipse cx="39" cy="14" rx="6.5" ry="8.5" transform="rotate(8 39 14)" />
      <ellipse cx="51" cy="26" rx="6" ry="8" transform="rotate(25 51 26)" />
      <path d="M32 31c-9 0-17 9-17 17 0 6 5 9 10 8 3-1 5-2 7-2s4 1 7 2c5 1 10-2 10-8 0-8-8-17-17-17z" />
    </svg>
  );
}

export default function ClickerPage() {
  const t = useTranslations("Clicker");
  const locale = useLocale();
  const tx = CUSTOM_TEXT[locale === "en" ? "en" : "es"];

  const audioRef = useRef<AudioContext | null>(null);
  const noiseRef = useRef<AudioBuffer | null>(null);
  const pressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [vibrationOn, setVibrationOn] = useState(true);
  const [vibrationSupported, setVibrationSupported] = useState(false);
  const [pressed, setPressed] = useState(false);

  // Personalización: lo guardado y el borrador mientras se edita
  const [userId, setUserId] = useState<string | null>(null);
  const [saved, setSaved] = useState<ClickerSettings>(DEFAULT_CLICKER_SETTINGS);
  const [draft, setDraft] = useState<ClickerSettings>(DEFAULT_CLICKER_SETTINGS);
  const [panelOpen, setPanelOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  // Mientras se personaliza, el clicker de arriba suena con el borrador
  const active = panelOpen ? draft : saved;

  const activeRef = useRef<ClickerSettings>(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  // Al abrir la pantalla: vibración y sonido guardado
  useEffect(() => {
    const supported =
      typeof navigator !== "undefined" &&
      typeof navigator.vibrate === "function";
    setVibrationSupported(supported);

    try {
      const savedVibration = window.localStorage.getItem(VIBRATION_KEY);
      if (savedVibration === "0") setVibrationOn(false);
      if (savedVibration === "1") setVibrationOn(true);
    } catch {
      // Si el navegador no deja guardar, se queda activada por defecto
    }

    async function loadSettings() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("clicker_settings")
        .eq("id", user.id)
        .maybeSingle();

      const settings = sanitizeClickerSettings(profile?.clicker_settings);
      setSaved(settings);
      setDraft(settings);
    }

    void loadSettings();
  }, []);

  // Al salir de la pantalla: liberar el audio
  useEffect(() => {
    return () => {
      if (pressTimeoutRef.current) clearTimeout(pressTimeoutRef.current);
      if (audioRef.current) {
        void audioRef.current.close();
        audioRef.current = null;
      }
    };
  }, []);

  // Sonido generado con código (sin archivo de audio).
  // El primer sonido suena en el instante exacto de la pulsación.
  const playClick = useCallback((settings?: ClickerSettings) => {
    const current = settings ?? activeRef.current;

    let ctx = audioRef.current;
    if (!ctx) {
      const AudioCtx = getAudioContextClass();
      if (!AudioCtx) return;
      ctx = new AudioCtx();
      audioRef.current = ctx;
    }
    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    if (!noiseRef.current) {
      const length = Math.floor(ctx.sampleRate * SNAP_DURATION);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        const decay = Math.pow(1 - i / length, 5);
        data[i] = (Math.random() * 2 - 1) * decay;
      }
      noiseRef.current = buffer;
    }
    const noise = noiseRef.current;

    // Volumen general
    const master = ctx.createGain();
    master.gain.value = current.volume / 100;
    master.connect(ctx.destination);

    const now = ctx.currentTime;
    const f = pitchFactor(current.pitch);
    const gap = current.gapMs / 1000;
    const sound = CLICKER_SOUNDS[current.sound];

    switch (sound.kind) {
      case "snap": {
        // "Clic": fuerte
        playSnap(ctx, master, noise, now, sound.first * f, sound.level, sound.q, sound.ring, sound.ringLevel);
        // "Clac": algo más grave y suave, tras el tiempo elegido
        if (sound.second !== null) {
          playSnap(
            ctx,
            master,
            noise,
            now + gap,
            sound.second * f,
            sound.level * 0.75,
            sound.q,
            sound.ring,
            sound.ringLevel
          );
        }
        break;
      }
      case "tone": {
        playTone(ctx, master, now, sound.frequency * f, sound.wave, sound.duration);
        if (sound.second !== null) {
          // Que no se pisen los dos pitidos
          const secondStart = now + Math.max(gap, sound.duration + 0.02);
          playTone(ctx, master, secondStart, sound.second * f, sound.wave, sound.duration);
        }
        break;
      }
      case "bell": {
        playBell(ctx, master, now, sound.frequency * f);
        break;
      }
      case "whistle": {
        playWhistle(ctx, master, now, sound.from * f, sound.to * f, sound.duration);
        break;
      }
    }
  }, []);

  const handlePress = useCallback(() => {
    playClick();

    if (vibrationOn && vibrationSupported) {
      navigator.vibrate(30);
    }

    // Pequeña animación del botón
    setPressed(true);
    if (pressTimeoutRef.current) clearTimeout(pressTimeoutRef.current);
    pressTimeoutRef.current = setTimeout(() => setPressed(false), 120);
  }, [playClick, vibrationOn, vibrationSupported]);

  const toggleVibration = () => {
    if (!vibrationSupported) return;
    const next = !vibrationOn;
    setVibrationOn(next);
    try {
      window.localStorage.setItem(VIBRATION_KEY, next ? "1" : "0");
    } catch {
      // Si no se puede guardar, solo se aplica mientras la pantalla esté abierta
    }
  };

  // --- Personalización ---

  function updateDraft(changes: Partial<ClickerSettings>) {
    setDraft((prev) => ({ ...prev, ...changes }));
  }

  function openPanel() {
    setDraft(saved);
    setNotice(null);
    setPanelOpen(true);
  }

  function cancelPanel() {
    setDraft(saved);
    setNotice(null);
    setPanelOpen(false);
  }

  function chooseSound(sound: ClickerSoundId) {
    const next = { ...draft, sound };
    setDraft(next);
    playClick(next);
  }

  async function handleSave() {
    if (!userId) return;

    setSaving(true);
    setNotice(null);

    const toSave: ClickerSettings = { ...draft };

    const { data: updatedRows, error } = await supabase
      .from("profiles")
      .update({ clicker_settings: toSave })
      .eq("id", userId)
      .select("id");

    let failed = Boolean(error);

    // Por si el usuario aún no tiene fila en profiles
    if (!error && (updatedRows ?? []).length === 0) {
      const { error: insertError } = await supabase
        .from("profiles")
        .insert({ id: userId, clicker_settings: toSave });
      failed = Boolean(insertError);
      if (insertError) console.error("Error creando el perfil:", insertError);
    }

    if (error) console.error("Error guardando el clicker:", error);

    if (failed) {
      setNotice({ ok: false, text: tx.saveError });
      setSaving(false);
      return;
    }

    setSaved(toSave);
    setDraft(toSave);
    setPanelOpen(false);
    setSaving(false);
    setNotice({ ok: true, text: tx.saved });
  }

  const vibrationActive = vibrationSupported && vibrationOn;
  const pitchLabel = `${draft.pitch > 0 ? "+" : ""}${draft.pitch}`;

  return (
    <main data-tour-section="clicker" className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <div>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-[#1e3a5f] hover:underline"
          >
            {t("backToDashboard")}
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-[#1e3a5f]">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-gray-600">{t("subtitle")}</p>
        </div>

        {/* Botón del clicker */}
        <div
          className="flex flex-col items-center gap-4 rounded-2xl p-8 shadow-sm"
          style={{ backgroundColor: CLICKER_BG }}
        >
          <button
            type="button"
            data-tour="clicker-button"
            aria-label={t("buttonAria")}
            // Se usa "pointerdown" para que suene en el instante exacto
            // en que se toca, no al levantar el dedo
            onPointerDown={(e) => {
              e.preventDefault();
              handlePress();
            }}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
                e.preventDefault();
                handlePress();
              }
            }}
            onContextMenu={(e) => e.preventDefault()}
            style={{
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
              backgroundColor: CLICKER_BUTTON,
              borderColor: CLICKER_BORDER,
            }}
            className={`flex h-56 w-56 select-none items-center justify-center overflow-hidden rounded-full border-8 shadow-lg transition-transform duration-75 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1e3a5f]/40 ${
              pressed ? "scale-90 shadow-md" : "scale-100"
            }`}
          >
            <span className="relative block h-28 w-28">
              <PawPrint
                color={CLICKER_PAWS}
                className="absolute bottom-0 left-0 h-16 w-16 -rotate-12 drop-shadow"
              />
              <PawPrint
                color={CLICKER_PAWS}
                className="absolute right-0 top-0 h-14 w-14 rotate-12 drop-shadow"
              />
            </span>
          </button>
          <p className="text-sm font-medium text-gray-500">{t("tapToClick")}</p>
        </div>

        {/* Aviso (guardado / error) */}
        {notice && !panelOpen && (
          <div
            className={`rounded-xl px-4 py-3 text-sm font-semibold ${
              notice.ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}
          >
            {notice.text}
          </div>
        )}

        {/* Botón Personalizar (solo con sesión iniciada) */}
        {userId && !panelOpen && (
          <button
            type="button"
            data-tour="clicker-customize"
            onClick={openPanel}
            className="rounded-2xl bg-white p-4 font-semibold text-[#1e3a5f] shadow-sm transition hover:bg-gray-50"
          >
            {tx.customize}
          </button>
        )}

        {/* PANEL DE PERSONALIZACIÓN DEL SONIDO */}
        {panelOpen && (
          <div className="space-y-6 rounded-2xl bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-[#1e3a5f]">{tx.panelTitle}</h2>
              <p className="mt-1 text-sm text-gray-500">{tx.previewNote}</p>
            </div>

            {/* Tipo de sonido */}
            <section>
              <p className="font-semibold text-[#1e3a5f]">{tx.soundTitle}</p>
              <p className="mb-2 text-sm text-gray-500">{tx.soundHint}</p>
              <div className="grid grid-cols-2 gap-2">
                {CLICKER_SOUND_IDS.map((sound) => (
                  <button
                    key={sound}
                    type="button"
                    onClick={() => chooseSound(sound)}
                    className={`rounded-xl border-2 px-3 py-2 text-left text-sm font-semibold transition ${
                      draft.sound === sound
                        ? "border-[#1e3a5f] bg-blue-50 text-[#1e3a5f]"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    🔊 {tx.sounds[sound]}
                  </button>
                ))}
              </div>
            </section>

            {/* Tiempo entre clic y clac */}
            {isDoubleSound(draft.sound) && (
              <section>
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-[#1e3a5f]">{tx.gapTitle}</p>
                  <span className="text-sm font-bold text-[#1e3a5f]">
                    {draft.gapMs} ms
                  </span>
                </div>
                <input
                  type="range"
                  min={GAP_MIN_MS}
                  max={GAP_MAX_MS}
                  step={5}
                  value={draft.gapMs}
                  onChange={(e) => updateDraft({ gapMs: Number(e.target.value) })}
                  onPointerUp={() => playClick(draft)}
                  className="mt-2 w-full accent-[#1e3a5f]"
                />
                <p className="text-xs text-gray-500">{tx.gapHint}</p>
              </section>
            )}

            {/* Volumen */}
            <section>
              <div className="flex items-center justify-between">
                <p className="font-semibold text-[#1e3a5f]">{tx.volumeTitle}</p>
                <span className="text-sm font-bold text-[#1e3a5f]">
                  {draft.volume} %
                </span>
              </div>
              <input
                type="range"
                min={VOLUME_MIN}
                max={VOLUME_MAX}
                step={5}
                value={draft.volume}
                onChange={(e) => updateDraft({ volume: Number(e.target.value) })}
                onPointerUp={() => playClick(draft)}
                className="mt-2 w-full accent-[#1e3a5f]"
              />
            </section>

            {/* Tono */}
            <section>
              <div className="flex items-center justify-between">
                <p className="font-semibold text-[#1e3a5f]">{tx.pitchTitle}</p>
                <span className="text-sm font-bold text-[#1e3a5f]">{pitchLabel}</span>
              </div>
              <input
                type="range"
                min={PITCH_MIN}
                max={PITCH_MAX}
                step={1}
                value={draft.pitch}
                onChange={(e) => updateDraft({ pitch: Number(e.target.value) })}
                onPointerUp={() => playClick(draft)}
                className="mt-2 w-full accent-[#1e3a5f]"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>{tx.pitchLow}</span>
                <span>{tx.pitchHigh}</span>
              </div>
            </section>

            {/* Aviso dentro del panel */}
            {notice && (
              <div
                className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                  notice.ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                }`}
              >
                {notice.text}
              </div>
            )}

            {/* Acciones */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="rounded-xl bg-[#1e3a5f] px-4 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {saving ? tx.saving : tx.save}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={cancelPanel}
                  disabled={saving}
                  className="rounded-xl bg-gray-100 px-4 py-2 font-semibold text-gray-700 transition hover:bg-gray-200 disabled:opacity-50"
                >
                  {tx.cancel}
                </button>
                <button
                  type="button"
                  onClick={() => setDraft({ ...DEFAULT_CLICKER_SETTINGS })}
                  disabled={saving}
                  className="rounded-xl bg-gray-100 px-4 py-2 font-semibold text-gray-700 transition hover:bg-gray-200 disabled:opacity-50"
                >
                  {tx.reset}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Interruptor de vibración */}
        <div data-tour="clicker-vibration" className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-[#1e3a5f]">
                📳 {t("vibrationLabel")}
              </p>
              <p className="text-sm text-gray-500">
                {vibrationActive ? t("vibrationOn") : t("vibrationOff")}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={vibrationActive}
              aria-label={t("vibrationLabel")}
              onClick={toggleVibration}
              disabled={!vibrationSupported}
              className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                vibrationActive ? "bg-[#1e3a5f]" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  vibrationActive ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          {!vibrationSupported && (
            <p className="mt-3 text-sm text-amber-700">
              {t("vibrationUnsupported")}
            </p>
          )}
        </div>

        {/* Consejos, con Pawsi disfrutando su premio */}
        <div className="flex items-center gap-4 rounded-2xl bg-blue-50 p-4 text-sm text-[#1e3a5f]">
          <Pawsi pose="premio" size={90} className="shrink-0" />
          <div className="space-y-2">
            <p>💡 {t("tip")}</p>
            <p className="text-gray-600">🔊 {t("soundHint")}</p>
          </div>
        </div>
      </div>
    </main>
  );
}