import Pawsi from "@/components/Pawsi";

type Props = {
  // Texto debajo de Pawsi (por ejemplo "Cargando…"). Opcional.
  text?: string;
  // "page": ocupa la pantalla · "card": dentro de una tarjeta
  variant?: "page" | "card";
};

// Pantalla de carga con Pawsi. Se usa en todas las cargas de la app.
export default function PawsiLoading({ text, variant = "page" }: Props) {
  // Quitamos los puntos finales del texto: los pone la animación
  const cleanText = (text ?? "").replace(/[.…\s]+$/, "");

  const content = (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-3 text-center"
    >
      <Pawsi pose="espera" size={variant === "page" ? 130 : 100} float />
      <p className="flex items-center gap-1 font-semibold text-slate-500">
        {cleanText}
        <span className="inline-flex gap-0.5" aria-hidden="true">
          <span className="animate-bounce [animation-delay:0ms]">.</span>
          <span className="animate-bounce [animation-delay:150ms]">.</span>
          <span className="animate-bounce [animation-delay:300ms]">.</span>
        </span>
      </p>
    </div>
  );

  if (variant === "card") {
    return <div className="py-6">{content}</div>;
  }

  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-slate-100 p-6">
      {content}
    </main>
  );
}