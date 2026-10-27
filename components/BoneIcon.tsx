// Hueso dibujado (se ve igual en todos los dispositivos).
// Relleno blanco y borde del color del texto que lo rodea (currentColor):
// azul marino normalmente, ámbar cuando quedan pocos huesitos.
//
// Truco: primero se dibuja el hueso entero con un borde grueso del color,
// y encima el mismo hueso en blanco. Así solo se ve el contorno exterior,
// sin las líneas de dentro donde se juntan las formas.
function BoneShapes() {
  return (
    <>
      {/* Extremo izquierdo */}
      <circle cx="5" cy="4.5" r="4" />
      <circle cx="5" cy="11.5" r="4" />
      {/* Extremo derecho */}
      <circle cx="27" cy="4.5" r="4" />
      <circle cx="27" cy="11.5" r="4" />
      {/* Cuerpo */}
      <rect x="5" y="4" width="22" height="8" rx="2" />
    </>
  );
}

export default function BoneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="-2 -2 36 20" className={className} aria-hidden="true">
      {/* Contorno */}
      <g fill="currentColor" stroke="currentColor" strokeWidth="3.4">
        <BoneShapes />
      </g>
      {/* Relleno blanco */}
      <g fill="#ffffff">
        <BoneShapes />
      </g>
    </svg>
  );
}