"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale } from "next-intl";

import { saveUserLanguage, type AppLanguage } from "@/lib/language";

// ---------- Banderas dibujadas (se ven igual en todos los dispositivos) ----------

function FlagES({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 60 40"
      className={className}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <rect width="60" height="40" fill="#AA151B" />
      <rect y="10" width="60" height="20" fill="#F1BF00" />
    </svg>
  );
}

function FlagGB({ className }: { className?: string }) {
  // Identificador único para que varias banderas en pantalla no choquen
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, "");
  const clipAll = `gb-all-${id}`;
  const clipDiag = `gb-diag-${id}`;

  return (
    <svg
      viewBox="0 0 60 30"
      className={className}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <clipPath id={clipAll}>
        <path d="M0,0 v30 h60 v-30 z" />
      </clipPath>
      <clipPath id={clipDiag}>
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <g clipPath={`url(#${clipAll})`}>
        <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
        <path
          d="M0,0 L60,30 M60,0 L0,30"
          clipPath={`url(#${clipDiag})`}
          stroke="#C8102E"
          strokeWidth="4"
        />
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  );
}

const OPTIONS: { value: AppLanguage; name: string }[] = [
  { value: "es", name: "Español" },
  { value: "en", name: "English" },
];

function Flag({
  language,
  className,
}: {
  language: AppLanguage;
  className?: string;
}) {
  return language === "en" ? (
    <FlagGB className={className} />
  ) : (
    <FlagES className={className} />
  );
}

// ---------- Selector de idioma ----------
// Muestra la bandera del idioma actual. Al pulsarla, abre un menú para cambiarlo.
export default function LanguageSwitcher() {
  const locale = useLocale();
  const current: AppLanguage = locale === "en" ? "en" : "es";

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Cerrar el menú al pulsar fuera o con la tecla Escape
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (
        containerRef.current &&
        target instanceof Node &&
        !containerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function handleChange(language: AppLanguage) {
    if (saving) return;

    if (language === current) {
      setOpen(false);
      return;
    }

    setSaving(true);
    const saved = await saveUserLanguage(language);

    if (saved) {
      // Recarga completa para que el servidor sirva el nuevo idioma
      window.location.reload();
      return;
    }

    setSaving(false);
    setOpen(false);
  }

  const buttonLabel =
    current === "en" ? "Language: English" : "Idioma: Español";

  return (
    <div ref={containerRef} className="relative inline-block shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={saving}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={buttonLabel}
        title={buttonLabel}
        className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-1.5 shadow-sm transition hover:border-slate-300 disabled:opacity-60"
      >
        <Flag
          language={current}
          className="h-5 w-7 overflow-hidden rounded-[3px] ring-1 ring-black/10"
        />
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-4 w-4 text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {OPTIONS.map((option) => {
            const isActive = option.value === current;

            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                disabled={saving}
                onClick={() => void handleChange(option.value)}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-semibold transition disabled:opacity-60 ${
                  isActive
                    ? "bg-slate-50 text-[#1e3a5f]"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Flag
                  language={option.value}
                  className="h-4 w-6 overflow-hidden rounded-[2px] ring-1 ring-black/10"
                />
                <span className="flex-1">{option.name}</span>
                {isActive && <span aria-hidden="true">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}