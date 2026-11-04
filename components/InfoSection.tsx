// Bloque de información con título y lista de puntos
// (se usa en PAWS PRO y en la compra de huesitos)

type Props = {
  title: string;
  items: unknown;
  icon?: string;
};

// Los textos vienen de los archivos de idioma como lista (t.raw)
function toStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export default function InfoSection({ title, items, icon = "•" }: Props) {
  const list = toStringList(items);
  if (list.length === 0) return null;

  return (
    <section className="rounded-2xl bg-white p-6 shadow">
      <h3 className="text-lg font-bold text-[#1e3a5f]">{title}</h3>
      <ul className="mt-3 space-y-2">
        {list.map((item) => (
          <li key={item} className="flex gap-3 leading-relaxed text-slate-700">
            <span className="shrink-0">{icon}</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
