// Perro guía de PAWS: ilustración original en SVG con animaciones suaves
// (mueve la cola, parpadea y balancea las orejas). No usa imágenes externas.

type PawsMascotProps = {
  size?: number;
  className?: string;
};

export default function PawsMascot({ size = 120, className }: PawsMascotProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Paws"
    >
      {/* Sombra */}
      <ellipse cx="60" cy="114" rx="30" ry="4" fill="#0f172a" opacity="0.12" />

      {/* Cola */}
      <g>
        <path
          d="M84 96 C98 92 102 80 98 72"
          stroke="#1e3a5f"
          strokeWidth="7"
          strokeLinecap="round"
          fill="none"
        />
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="-12 84 96; 14 84 96; -12 84 96"
          dur="0.8s"
          repeatCount="indefinite"
        />
      </g>

      {/* Cuerpo */}
      <ellipse cx="60" cy="96" rx="26" ry="17" fill="#1e3a5f" />
      <ellipse cx="60" cy="99" rx="13" ry="10" fill="#ffffff" />

      {/* Patas delanteras */}
      <ellipse cx="49" cy="111" rx="7" ry="4.5" fill="#ffffff" />
      <ellipse cx="71" cy="111" rx="7" ry="4.5" fill="#ffffff" />

      {/* Oreja izquierda */}
      <g>
        <ellipse
          cx="34"
          cy="46"
          rx="10"
          ry="19"
          fill="#15304f"
          transform="rotate(22 34 46)"
        />
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="0 40 32; -6 40 32; 0 40 32"
          dur="2.4s"
          repeatCount="indefinite"
        />
      </g>

      {/* Oreja derecha */}
      <g>
        <ellipse
          cx="86"
          cy="46"
          rx="10"
          ry="19"
          fill="#15304f"
          transform="rotate(-22 86 46)"
        />
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="0 80 32; 6 80 32; 0 80 32"
          dur="2.4s"
          repeatCount="indefinite"
        />
      </g>

      {/* Cabeza */}
      <circle cx="60" cy="50" r="28" fill="#1e3a5f" />

      {/* Mancha blanca de la cara */}
      <path
        d="M60 30 C54 40 52 48 46 58 C44 70 52 76 60 76 C68 76 76 70 74 58 C68 48 66 40 60 30 Z"
        fill="#ffffff"
      />

      {/* Ojos */}
      <g>
        <ellipse cx="49" cy="48" rx="5" ry="5.5" fill="#ffffff" />
        <ellipse cx="71" cy="48" rx="5" ry="5.5" fill="#ffffff" />
        <ellipse cx="50" cy="49" rx="3" ry="3.4" fill="#0f172a">
          <animate
            attributeName="ry"
            values="3.4;3.4;0.4;3.4"
            keyTimes="0;0.92;0.96;1"
            dur="4s"
            repeatCount="indefinite"
          />
        </ellipse>
        <ellipse cx="70" cy="49" rx="3" ry="3.4" fill="#0f172a">
          <animate
            attributeName="ry"
            values="3.4;3.4;0.4;3.4"
            keyTimes="0;0.92;0.96;1"
            dur="4s"
            repeatCount="indefinite"
          />
        </ellipse>
        <circle cx="51.2" cy="47.6" r="1" fill="#ffffff" />
        <circle cx="71.2" cy="47.6" r="1" fill="#ffffff" />
      </g>

      {/* Nariz */}
      <ellipse cx="60" cy="60" rx="5" ry="3.6" fill="#0f172a" />

      {/* Boca y lengua */}
      <path
        d="M53 65 Q60 71 67 65"
        stroke="#0f172a"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M57 67.5 Q60 75 63 67.5 Z" fill="#f472b6" />

      {/* Mejillas */}
      <circle cx="44" cy="62" r="3" fill="#f9a8d4" opacity="0.6" />
      <circle cx="76" cy="62" r="3" fill="#f9a8d4" opacity="0.6" />

      {/* Collar con corazón */}
      <path
        d="M40 78 Q60 86 80 78"
        stroke="#f59e0b"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M60 92 C52 86 54 80 60 84 C66 80 68 86 60 92 Z"
        fill="#ea580c"
      />
    </svg>
  );
}