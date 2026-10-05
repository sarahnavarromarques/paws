"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

// Pantallas donde NO se muestra el menú (sin sesión iniciada)
const HIDDEN_PATHS = [
  "/",
  "/login",
  "/register",
  "/reset-password",
  "/update-password",
];

type NavKey = "dashboard" | "pets" | "calendar" | "settings" | "credits";

const NAV_ITEMS: { href: string; key: NavKey; icon: string }[] = [
  { href: "/dashboard", key: "dashboard", icon: "🏠" },
  { href: "/pets", key: "pets", icon: "🐶" },
  { href: "/calendar", key: "calendar", icon: "📅" },
  { href: "/settings", key: "settings", icon: "⚙️" },
  { href: "/credits", key: "credits", icon: "📚" },
];

type PetRow = Database["public"]["Tables"]["pets"]["Row"];
type PetItem = Pick<PetRow, "id" | "name">;

export default function Sidebar() {
  const t = useTranslations("Sidebar");
  // Reutilizamos los textos de la ficha del perro (Habilidades, Grupos, Editar)
  const tPet = useTranslations("PetProfile");
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pets, setPets] = useState<PetItem[]>([]);
  const [expandedPets, setExpandedPets] = useState<Set<PetItem["id"]>>(
    () => new Set()
  );

  // Cerrar el menú cada vez que cambia la pantalla
  // (también cuando la navegación la hace el tutorial)
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Cargar los perros del usuario cada vez que se abre el menú
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const loadPets = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("pets")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (!cancelled && !error && data) {
        setPets(data);
      }
    };

    loadPets();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Al abrir el menú dentro de un perro, ese perro aparece desplegado
  useEffect(() => {
    if (!open) return;
    const match = pathname.match(/^\/pets\/(\d+)/);
    if (!match) return;
    const currentPetId = Number(match[1]);
    setExpandedPets((prev) => {
      if (prev.has(currentPetId)) return prev;
      const next = new Set(prev);
      next.add(currentPetId);
      return next;
    });
  }, [open, pathname]);

  // Cerrar con la tecla Escape
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Bloquear el scroll de la página mientras el menú está abierto
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (HIDDEN_PATHS.includes(pathname)) return null;

  // "Mascotas" solo se resalta en la lista general;
  // dentro de la ficha de un perro se resalta esa página del perro.
  const isActive = (href: string) => {
    if (href === "/pets") return pathname === "/pets";
    return pathname === href || pathname.startsWith(href + "/");
  };

  const isInsidePet = (petId: PetItem["id"]) => {
    const base = `/pets/${petId}`;
    return pathname === base || pathname.startsWith(base + "/");
  };

  const togglePet = (petId: PetItem["id"]) => {
    setExpandedPets((prev) => {
      const next = new Set(prev);
      if (next.has(petId)) {
        next.delete(petId);
      } else {
        next.add(petId);
      }
      return next;
    });
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    setLoggingOut(false);
    router.push("/login");
    router.refresh();
  };

  return (
    <>
      {/* Barra superior */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-gray-200 bg-white px-4">
        <button
          type="button"
          data-tour="menu-button"
          onClick={() => setOpen(true)}
          aria-label={t("openMenu")}
          aria-expanded={open}
          className="rounded-lg p-2 text-[#1e3a5f] hover:bg-gray-100"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-6 w-6"
          >
            <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Link href="/dashboard" className="text-lg font-bold text-[#1e3a5f]">
          🐾 PAWS
        </Link>
      </header>

      {/* Fondo oscuro */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Panel lateral */}
      <aside
        data-tour="sidebar-panel"
        aria-hidden={!open}
        aria-label={t("menuTitle")}
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-gray-200 px-4">
          <span className="text-lg font-bold text-[#1e3a5f]">
            🐾 {t("menuTitle")}
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("closeMenu")}
            tabIndex={open ? 0 : -1}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-5 w-5"
            >
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    tabIndex={open ? 0 : -1}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-3 text-base transition-colors ${
                      active
                        ? "bg-[#1e3a5f] font-semibold text-white"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <span className="text-xl">{item.icon}</span>
                    {t(item.key)}
                  </Link>

                  {/* Perros debajo de "Mascotas", cada uno desplegable */}
                  {item.key === "pets" && pets.length > 0 && (
                    <ul className="ml-6 mt-1 space-y-1 border-l border-gray-200 pl-3">
                      {pets.map((pet) => {
                        const base = `/pets/${pet.id}`;
                        const onProfile = pathname === base;
                        const inside = isInsidePet(pet.id);
                        const expanded = expandedPets.has(pet.id);

                        const subLinks = [
                          { href: `${base}/skills`, label: tPet("skills") },
                          { href: `${base}/groups`, label: tPet("skillGroups") },
                          { href: `${base}/edit`, label: tPet("editPet") },
                        ];

                        return (
                          <li key={pet.id}>
                            <div className="flex items-center gap-1">
                              <Link
                                href={base}
                                onClick={() => setOpen(false)}
                                tabIndex={open ? 0 : -1}
                                aria-current={onProfile ? "page" : undefined}
                                className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                                  onProfile
                                    ? "bg-[#1e3a5f] font-semibold text-white"
                                    : inside
                                    ? "font-semibold text-[#1e3a5f] hover:bg-gray-100"
                                    : "text-gray-600 hover:bg-gray-100"
                                }`}
                              >
                                <span>🐾</span>
                                <span className="truncate">{pet.name}</span>
                              </Link>

                              <button
                                type="button"
                                onClick={() => togglePet(pet.id)}
                                tabIndex={open ? 0 : -1}
                                aria-expanded={expanded}
                                aria-label={pet.name}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth={2.5}
                                  className={`h-4 w-4 transition-transform duration-200 ${
                                    expanded ? "rotate-90" : ""
                                  }`}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M9 6l6 6-6 6"
                                  />
                                </svg>
                              </button>
                            </div>

                            {expanded && (
                              <ul className="ml-4 mt-1 space-y-1 border-l border-gray-200 pl-3">
                                {subLinks.map((sub) => {
                                  const subActive = pathname === sub.href;
                                  return (
                                    <li key={sub.href}>
                                      <Link
                                        href={sub.href}
                                        onClick={() => setOpen(false)}
                                        tabIndex={open ? 0 : -1}
                                        aria-current={subActive ? "page" : undefined}
                                        className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                                          subActive
                                            ? "bg-[#1e3a5f] font-semibold text-white"
                                            : "text-gray-600 hover:bg-gray-100"
                                        }`}
                                      >
                                        {sub.label}
                                      </Link>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-gray-200 p-3">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            tabIndex={open ? 0 : -1}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-base text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <span className="text-xl">🚪</span>
            {loggingOut ? t("loggingOut") : t("logout")}
          </button>
        </div>
      </aside>
    </>
  );
}