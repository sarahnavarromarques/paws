"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  // Cómo se muestra cada opción (por si quieres añadir sufijos como "kg")
  renderLabel?: (option: string) => string;
  disabled?: boolean;
};

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Selecciona una opción",
  renderLabel,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const label = (option: string) =>
    renderLabel ? renderLabel(option) : option;

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) =>
      label(option).toLowerCase().includes(q)
    );
  }, [options, query]);

  function handleSelect(option: string) {
    onChange(option);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-300 bg-white p-3 text-left outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:opacity-50"
      >
        <span className={value ? "text-slate-900" : "text-slate-400"}>
          {value ? label(value) : placeholder}
        </span>
        <span className="ml-2 text-slate-400">▾</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="p-2">
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar..."
              className="w-full rounded-lg border border-slate-300 p-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-500">
                No hay coincidencias.
              </p>
            ) : (
              filtered.map((option) => {
                const isSelected = option === value;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleSelect(option)}
                    className={`block w-full px-4 py-2 text-left text-sm transition ${
                      isSelected
                        ? "bg-blue-600 text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {label(option)}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}