"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

// Preferencia de vibración guardada en este dispositivo
const VIBRATION_KEY = "paws-clicker-vibration";

// Duración de cada chasquido (en segundos)
const SNAP_DURATION = 0.025;

// Separación entre el "clic" y el "clac" (en segundos)
const SECOND_SNAP_DELAY = 0.09;

// Tono de cada chasquido (más alto = más agudo)
const FIRST_SNAP_FREQUENCY = 4200;
const SECOND_SNAP_FREQUENCY = 3300;

// Amarillo muy clarito (recuadro y huellas)
const LIGHT_YELLOW = "#fefce8";

type AudioContextConstructor = typeof AudioContext;

// Safari antiguo usa "webkitAudioContext"
function getAudioContextClass(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;
  const g = globalThis as typeof globalThis & {
    webkitAudioContext?: AudioContextConstructor;
  };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

// Un chasquido metálico: ruido filtrado + un "ping" muy corto
function playSnap(
  ctx: AudioContext,
  noiseBuffer: AudioBuffer,
  start: number,
  frequency: number,
  volume: number
) {
  // Capa 1: ruido filtrado (la lámina metálica)
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = frequency;
  filter.Q.value = 4;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(volume, start);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, start + SNAP_DURATION);
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(start);
  noise.stop(start + SNAP_DURATION);

  // Capa 2: resonancia corta del metal
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(frequency, start);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(volume * 0.35, start);
  oscGain.gain.exponentialRampToValueAtTime(0.001, start + 0.015);
  osc.connect(oscGain);
  oscGain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + 0.015);
}

// Huella dibujada (se puede colorear, a diferencia del emoji)
function PawPrint({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill={LIGHT_YELLOW}
      aria-hidden="true"
      className={className}
    >
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

  const audioRef = useRef<AudioContext | null>(null);
  const noiseRef = useRef<AudioBuffer | null>(null);
  const pressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [vibrationOn, setVibrationOn] = useState(true);
  const [vibrationSupported, setVibrationSupported] = useState(false);
  const [pressed, setPressed] = useState(false);

  // Al abrir la pantalla: comprobar si el móvil puede vibrar
  // y recuperar la preferencia guardada
  useEffect(() => {
    const supported =
      typeof navigator !== "undefined" &&
      typeof navigator.vibrate === "function";
    setVibrationSupported(supported);

    try {
      const saved = window.localStorage.getItem(VIBRATION_KEY);
      if (saved === "0") setVibrationOn(false);
      if (saved === "1") setVibrationOn(true);
    } catch {
      // Si el navegador no deja guardar, se queda activada por defecto
    }
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

  // Sonido "clic-clac" generado con código (sin archivo de audio).
  // El primer chasquido suena en el instante exacto de la pulsación.
  const playClick = useCallback(() => {
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

    const now = ctx.currentTime;

    // "Clic": agudo y fuerte (la lámina baja)
    playSnap(ctx, noiseRef.current, now, FIRST_SNAP_FREQUENCY, 1);
    // "Clac": algo más grave y suave (la lámina vuelve)
    playSnap(
      ctx,
      noiseRef.current,
      now + SECOND_SNAP_DELAY,
      SECOND_SNAP_FREQUENCY,
      0.75
    );
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

  const vibrationActive = vibrationSupported && vibrationOn;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6">
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
          style={{ backgroundColor: LIGHT_YELLOW }}
        >
          <button
            type="button"
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
            style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
            className={`flex h-56 w-56 select-none items-center justify-center rounded-full border-8 border-[#f2a65a] bg-sky-200 shadow-lg transition-transform duration-75 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#f2a65a]/50 ${
              pressed ? "scale-90 shadow-md" : "scale-100"
            }`}
          >
            <span className="relative block h-28 w-28">
              <PawPrint className="absolute bottom-0 left-0 h-16 w-16 -rotate-12 drop-shadow" />
              <PawPrint className="absolute right-0 top-0 h-14 w-14 rotate-12 drop-shadow" />
            </span>
          </button>
          <p className="text-sm font-medium text-gray-500">{t("tapToClick")}</p>
        </div>

        {/* Interruptor de vibración */}
        <div className="rounded-2xl bg-white p-4 shadow-sm">
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

        {/* Consejos */}
        <div className="space-y-2 rounded-2xl bg-blue-50 p-4 text-sm text-[#1e3a5f]">
          <p>💡 {t("tip")}</p>
          <p className="text-gray-600">🔊 {t("soundHint")}</p>
        </div>
      </div>
    </main>
  );
}