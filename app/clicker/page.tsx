"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import Pawsi from "@/components/Pawsi";
import {
  CLICKER_EMOJIS,
  CLICKER_PHOTO_BUCKET,
  CLICKER_PHOTO_MAX_BYTES,
  CLICKER_SOUNDS,
  CLICKER_SOUND_IDS,
  COLOR_SWATCHES,
  DEFAULT_CLICKER_SETTINGS,
  GAP_MAX_MS,
  GAP_MIN_MS,
  clickerPhotoPath,
  isDoubleSound,
  sanitizeClickerSettings,
  type ClickerCenter,
  type ClickerSettings,
  type ClickerSoundId,
} from "@/lib/clicker-settings";

const supabase = createClient();

// Preferencia de vibración guardada en este dispositivo
const VIBRATION_KEY = "paws-clicker-vibration";

// Duración de cada chasquido (en segundos)
const SNAP_DURATION = 0.025;

// ---------------------------------------------------------------------------
// Textos de la personalización (español / inglés)
// ---------------------------------------------------------------------------

type CustomText = {
  customize: string;
  panelTitle: string;
  previewNote: string;
  centerTitle: string;
  centers: Record<ClickerCenter, string>;
  emojiCustom: string;
  photoUpload: string;
  photoChange: string;
  photoUploading: string;
  photoNone: string;
  colorsTitle: string;
  colorBg: string;
  colorButton: string;
  colorBorder: string;
  colorPaws: string;
  soundTitle: string;
  soundHint: string;
  sounds: Record<ClickerSoundId, string>;
  gapTitle: string;
  gapHint: string;
  save: string;
  saving: string;
  cancel: string;
  reset: string;
  saved: string;
  saveError: string;
  uploadError: string;
  notImage: string;
  tooBig: string;
};

const CUSTOM_TEXT: Record<"es" | "en", CustomText> = {
  es: {
    customize: "🎨 Personalizar",
    panelTitle: "Personaliza tu clicker",
    previewNote:
      "Los cambios se ven arriba al momento. Pulsa Guardar para conservarlos.",
    centerTitle: "Centro del botón",
    centers: { paws: "🐾 Huellas", emoji: "😊 Emoji", photo: "📷 Foto" },
    emojiCustom: "O escribe el que quieras:",
    photoUpload: "Subir foto",
    photoChange: "Cambiar foto",
    photoUploading: "Subiendo…",
    photoNone: "Todavía no has subido ninguna foto.",
    colorsTitle: "Colores",
    colorBg: "Fondo",
    colorButton: "Botón",
    colorBorder: "Borde",
    colorPaws: "Huellas",
    soundTitle: "Sonido",
    soundHint: "Toca un sonido para escucharlo.",
    sounds: {
      classic: "Clásico (clic-clac)",
      high: "Agudo",
      low: "Grave",
      wood: "Madera",
      beep: "Pitido corto",
      single: "Clic simple",
    },
    gapTitle: "Tiempo entre clic y clac",
    gapHint: "Menos = más seguido · Más = más separado",
    save: "Guardar",
    saving: "Guardando…",
    cancel: "Cancelar",
    reset: "Restablecer",
    saved: "Clicker guardado ✓",
    saveError: "No se pudo guardar. Inténtalo de nuevo.",
    uploadError: "No se pudo subir la foto. Inténtalo de nuevo.",
    notImage: "El archivo no es una imagen.",
    tooBig: "La foto pesa demasiado (máximo 5 MB).",
  },
  en: {
    customize: "🎨 Customize",
    panelTitle: "Customize your clicker",
    previewNote: "Changes show above right away. Press Save to keep them.",
    centerTitle: "Button centre",
    centers: { paws: "🐾 Paws", emoji: "😊 Emoji", photo: "📷 Photo" },
    emojiCustom: "Or type any emoji:",
    photoUpload: "Upload photo",
    photoChange: "Change photo",
    photoUploading: "Uploading…",
    photoNone: "You haven't uploaded a photo yet.",
    colorsTitle: "Colours",
    colorBg: "Background",
    colorButton: "Button",
    colorBorder: "Border",
    colorPaws: "Paws",
    soundTitle: "Sound",
    soundHint: "Tap a sound to hear it.",
    sounds: {
      classic: "Classic (click-clack)",
      high: "High",
      low: "Low",
      wood: "Wood",
      beep: "Short beep",
      single: "Single click",
    },
    gapTitle: "Time between click and clack",
    gapHint: "Less = closer together · More = further apart",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    reset: "Reset",
    saved: "Clicker saved ✓",
    saveError: "It could not be saved. Please try again.",
    uploadError: "The photo could not be uploaded. Please try again.",
    notImage: "The file is not an image.",
    tooBig: "The photo is too large (max 5 MB).",
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

// Un chasquido: ruido filtrado + un "ping" muy corto
function playSnap(
  ctx: AudioContext,
  noiseBuffer: AudioBuffer,
  start: number,
  frequency: number,
  volume: number,
  q: number
) {
  // Capa 1: ruido filtrado (la lámina)
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(volume, start);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, start + SNAP_DURATION);
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(start);
  noise.stop(start + SNAP_DURATION);

  // Capa 2: resonancia corta
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

// Pitido corto y limpio
function playBeep(ctx: AudioContext, start: number, frequency: number) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(frequency, start);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.4, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.08);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + 0.08);
}

// ---------------------------------------------------------------------------
// Huella dibujada (se puede colorear, a diferencia del emoji)
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

// Fila de un color: muestras rápidas + selector libre
function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-gray-700">{label}</p>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {COLOR_SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            onClick={() => onChange(swatch)}
            aria-label={swatch}
            className={`h-8 w-8 rounded-full border-2 transition ${
              value === swatch
                ? "scale-110 border-[#1e3a5f]"
                : "border-gray-200 hover:scale-105"
            }`}
            style={{ backgroundColor: swatch }}
          />
        ))}
      </div>
    </div>
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
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  // Mientras se personaliza, el clicker de arriba muestra el borrador (vista previa)
  const active = panelOpen ? draft : saved;

  const activeRef = useRef<ClickerSettings>(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  // Al abrir la pantalla: vibración y personalización guardada
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

    const now = ctx.currentTime;
    const sound = CLICKER_SOUNDS[current.sound];

    if (sound.kind === "beep") {
      playBeep(ctx, now, sound.frequency);
      return;
    }

    // "Clic": fuerte
    playSnap(ctx, noiseRef.current, now, sound.first, 1, sound.q);

    // "Clac": algo más grave y suave, tras el tiempo elegido
    if (sound.second !== null) {
      playSnap(
        ctx,
        noiseRef.current,
        now + current.gapMs / 1000,
        sound.second,
        0.75,
        sound.q
      );
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

  async function handleUpload(file: File) {
    if (!userId) return;
    setNotice(null);

    if (!file.type.startsWith("image/")) {
      setNotice({ ok: false, text: tx.notImage });
      return;
    }

    if (file.size > CLICKER_PHOTO_MAX_BYTES) {
      setNotice({ ok: false, text: tx.tooBig });
      return;
    }

    setUploading(true);

    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/clicker-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(CLICKER_PHOTO_BUCKET)
      .upload(path, file, { upsert: true });

    if (uploadError) {
      console.error("Error subiendo la foto del clicker:", uploadError);
      setNotice({ ok: false, text: tx.uploadError });
      setUploading(false);
      return;
    }

    const { data: publicData } = supabase.storage
      .from(CLICKER_PHOTO_BUCKET)
      .getPublicUrl(path);

    updateDraft({ center: "photo", photoUrl: publicData.publicUrl });
    setUploading(false);
  }

  async function handleSave() {
    if (!userId) return;

    setSaving(true);
    setNotice(null);

    // Si eligió foto pero no subió ninguna, se guardan huellas
    const toSave: ClickerSettings =
      draft.center === "photo" && !draft.photoUrl
        ? { ...draft, center: "paws" }
        : draft;

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

    // Borrar la foto anterior si se ha cambiado o quitado (no bloquea)
    const oldPath = clickerPhotoPath(saved.photoUrl);
    if (oldPath && saved.photoUrl !== toSave.photoUrl) {
      void supabase.storage.from(CLICKER_PHOTO_BUCKET).remove([oldPath]);
    }

    setSaved(toSave);
    setDraft(toSave);
    setPanelOpen(false);
    setSaving(false);
    setNotice({ ok: true, text: tx.saved });
  }

  const vibrationActive = vibrationSupported && vibrationOn;
  const showPhoto = active.center === "photo" && active.photoUrl;

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
          style={{ backgroundColor: active.bgColor }}
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
              backgroundColor: active.buttonColor,
              borderColor: active.borderColor,
            }}
            className={`flex h-56 w-56 select-none items-center justify-center overflow-hidden rounded-full border-8 shadow-lg transition-transform duration-75 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1e3a5f]/40 ${
              pressed ? "scale-90 shadow-md" : "scale-100"
            }`}
          >
            {showPhoto ? (
              <img
                src={active.photoUrl ?? ""}
                alt=""
                draggable={false}
                className="pointer-events-none h-full w-full object-cover"
              />
            ) : active.center === "emoji" ? (
              <span className="pointer-events-none text-8xl leading-none drop-shadow">
                {active.emoji}
              </span>
            ) : (
              <span className="relative block h-28 w-28">
                <PawPrint
                  color={active.pawColor}
                  className="absolute bottom-0 left-0 h-16 w-16 -rotate-12 drop-shadow"
                />
                <PawPrint
                  color={active.pawColor}
                  className="absolute right-0 top-0 h-14 w-14 rotate-12 drop-shadow"
                />
              </span>
            )}
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

        {/* PANEL DE PERSONALIZACIÓN */}
        {panelOpen && (
          <div className="space-y-6 rounded-2xl bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-[#1e3a5f]">{tx.panelTitle}</h2>
              <p className="mt-1 text-sm text-gray-500">{tx.previewNote}</p>
            </div>

            {/* Centro del botón */}
            <section>
              <p className="mb-2 font-semibold text-[#1e3a5f]">{tx.centerTitle}</p>
              <div className="grid grid-cols-3 gap-2">
                {(["paws", "emoji", "photo"] as ClickerCenter[]).map((center) => (
                  <button
                    key={center}
                    type="button"
                    onClick={() => updateDraft({ center })}
                    className={`rounded-xl border-2 px-2 py-2 text-sm font-semibold transition ${
                      draft.center === center
                        ? "border-[#1e3a5f] bg-blue-50 text-[#1e3a5f]"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {tx.centers[center]}
                  </button>
                ))}
              </div>

              {draft.center === "emoji" && (
                <div className="mt-4">
                  <div className="grid grid-cols-8 gap-2">
                    {CLICKER_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => updateDraft({ emoji })}
                        className={`flex h-10 items-center justify-center rounded-lg text-2xl transition ${
                          draft.emoji === emoji
                            ? "bg-blue-100 ring-2 ring-[#1e3a5f]"
                            : "bg-gray-50 hover:bg-gray-100"
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <label className="mt-3 block text-sm text-gray-600">
                    {tx.emojiCustom}
                    <input
                      type="text"
                      value={draft.emoji}
                      maxLength={16}
                      onChange={(e) => {
                        const value = e.target.value.trim();
                        if (value) updateDraft({ emoji: value });
                      }}
                      className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-2xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    />
                  </label>
                </div>
              )}

              {draft.center === "photo" && (
                <div className="mt-4 flex items-center gap-4">
                  {draft.photoUrl ? (
                    <img
                      src={draft.photoUrl}
                      alt=""
                      className="h-16 w-16 rounded-full border-2 border-gray-200 object-cover"
                    />
                  ) : (
                    <p className="flex-1 text-sm text-gray-500">{tx.photoNone}</p>
                  )}
                  <label
                    className={`cursor-pointer rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 ${
                      uploading ? "pointer-events-none opacity-60" : ""
                    }`}
                  >
                    {uploading
                      ? tx.photoUploading
                      : draft.photoUrl
                      ? tx.photoChange
                      : tx.photoUpload}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleUpload(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              )}
            </section>

            {/* Colores */}
            <section className="space-y-4">
              <p className="font-semibold text-[#1e3a5f]">{tx.colorsTitle}</p>
              <ColorRow
                label={tx.colorBg}
                value={draft.bgColor}
                onChange={(bgColor) => updateDraft({ bgColor })}
              />
              <ColorRow
                label={tx.colorButton}
                value={draft.buttonColor}
                onChange={(buttonColor) => updateDraft({ buttonColor })}
              />
              <ColorRow
                label={tx.colorBorder}
                value={draft.borderColor}
                onChange={(borderColor) => updateDraft({ borderColor })}
              />
              {draft.center === "paws" && (
                <ColorRow
                  label={tx.colorPaws}
                  value={draft.pawColor}
                  onChange={(pawColor) => updateDraft({ pawColor })}
                />
              )}
            </section>

            {/* Sonido */}
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
                disabled={saving || uploading}
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