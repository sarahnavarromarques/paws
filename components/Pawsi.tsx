// Pawsi, la mascota de PAWS.
// Uso: <Pawsi pose="hola" size={120} />
// Las imágenes están en public/mascot/

export type PawsiPose =
  | "hola"
  | "senala"
  | "piensa"
  | "celebra"
  | "espera"
  | "triste"
  | "premio";

type Props = {
  pose: PawsiPose;
  // Alto en píxeles (el ancho se ajusta solo)
  size?: number;
  className?: string;
  // Movimiento suave de "flotar" (para llamar la atención sin molestar)
  float?: boolean;
};

export default function Pawsi({ pose, size = 120, className = "", float = false }: Props) {
  return (
    <>
      {float && (
        <style>{`
          @keyframes pawsi-float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-6px); }
          }
          .pawsi-float { animation: pawsi-float 3s ease-in-out infinite; }
          @media (prefers-reduced-motion: reduce) {
            .pawsi-float { animation: none; }
          }
        `}</style>
      )}
      <img
        src={`/mascot/pawsi-${pose}.png`}
        alt="Pawsi"
        draggable={false}
        style={{ height: size, width: "auto" }}
        className={`pointer-events-none select-none object-contain ${
          float ? "pawsi-float" : ""
        } ${className}`}
      />
    </>
  );
}