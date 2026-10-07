"use client";

import { useEffect, useState } from "react";

type ImageLightboxProps = {
  src: string;
  alt: string;
  onClose: () => void;
  closeLabel: string;
  rotateHint: string;
};

type Size = { width: number; height: number };

// Margen alrededor de la imagen y espacio reservado para el botón de cerrar
const PADDING = 12;
const CLOSE_SPACE = 56;

function readViewport(): Size {
  return { width: window.innerWidth, height: window.innerHeight };
}

// Visor a pantalla completa. Si el móvil está en vertical y la imagen es
// ancha, la gira 90° para aprovechar todo el alto de la pantalla.
export default function ImageLightbox({
  src,
  alt,
  onClose,
  closeLabel,
  rotateHint,
}: ImageLightboxProps) {
  const [viewport, setViewport] = useState<Size>(readViewport);
  const [natural, setNatural] = useState<Size | null>(null);

  // Recalcular al girar el móvil o cambiar el tamaño de la ventana,
  // y bloquear el desplazamiento de la página de fondo
  useEffect(() => {
    function handleResize() {
      setViewport(readViewport());
    }

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Cerrar con la tecla Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const isPortrait = viewport.height > viewport.width;
  const imageIsWide = natural ? natural.width > natural.height : false;
  const rotate = isPortrait && imageIsWide;

  // Espacio disponible para la imagen (en su propia orientación)
  const availableWidth = rotate
    ? viewport.height - PADDING * 2 - CLOSE_SPACE
    : viewport.width - PADDING * 2;
  const availableHeight = rotate
    ? viewport.width - PADDING * 2
    : viewport.height - PADDING * 2 - CLOSE_SPACE;

  let displaySize: Size | null = null;

  if (natural && natural.width > 0 && natural.height > 0) {
    const scale = Math.min(
      availableWidth / natural.width,
      availableHeight / natural.height
    );
    displaySize = {
      width: Math.max(1, Math.floor(natural.width * scale)),
      height: Math.max(1, Math.floor(natural.height * scale)),
    };
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black"
      onClick={onClose}
    >
      <img
        src={src}
        alt={alt}
        onLoad={(e) => {
          const img = e.currentTarget;
          setNatural({ width: img.naturalWidth, height: img.naturalHeight });
        }}
        onClick={(e) => e.stopPropagation()}
        className="max-w-none select-none rounded-md transition-opacity duration-200"
        style={{
          width: displaySize ? displaySize.width : undefined,
          height: displaySize ? displaySize.height : undefined,
          opacity: displaySize ? 1 : 0,
          transform: rotate ? "rotate(90deg)" : undefined,
        }}
      />

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label={closeLabel}
        className="fixed right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-2xl font-bold text-white backdrop-blur transition hover:bg-white/25"
      >
        ✕
      </button>

      {rotate && (
        <p className="pointer-events-none fixed inset-x-0 bottom-3 text-center text-sm font-semibold text-white/70">
          {rotateHint}
        </p>
      )}
    </div>
  );
}